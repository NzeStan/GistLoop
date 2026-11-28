import { Star, Store } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";

import { errorMessage } from "@/api/errors";
import { useListings, useOrderAction } from "@/api/queries/marketplace";
import { startCheckout } from "@/api/queries/payments";
import {
  type Review,
  useDisputeOrder,
  useMySeller,
  useOrder,
  useReplyToReview,
  useReviewOrder,
  useSeller,
  useSellerReviews,
  useUpdateSeller,
} from "@/api/queries/wallet";
import { useAuth } from "@/auth/AuthProvider";
import { ActionButton, KeyValues, Section, StatusBadge } from "@/components/Manage";
import m from "@/components/Manage.module.css";
import { PageHeader } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";
import { ShareMenu } from "@/components/ShareMenu";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { PageLoader, Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import browse from "@/features/content/Browse.module.css";
import { formatDateTime, formatMoney, humanize, timeAgo } from "@/lib/format";

import { ListingCard } from "./MarketplacePages";

function Stars({ rating }: { rating: number | null | undefined }) {
  if (rating == null) return <span className="muted">No ratings yet</span>;
  return (
    <span aria-label={`${rating.toFixed(1)} out of 5`} style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          aria-hidden
          fill={n <= Math.round(rating) ? "currentColor" : "none"}
          style={{ color: "var(--color-accent)" }}
        />
      ))}
      <span style={{ marginLeft: 4 }}>{rating.toFixed(1)}</span>
    </span>
  );
}

const FORMER = { id: "", handle: null, display_name: "Former member", avatar_url: null };

function ReviewItem({ review, canReply }: { review: Review; canReply: boolean }) {
  const reviewer = review.reviewer ?? FORMER;
  const reply = useReplyToReview();
  const toast = useToast();
  const [text, setText] = useState("");
  return (
    <li className={m.item} style={{ flexDirection: "column", alignItems: "stretch" }}>
      <span className="cluster" style={{ justifyContent: "space-between" }}>
        <span className="cluster">
          <Avatar name={reviewer.display_name} seed={reviewer.id} src={reviewer.avatar_url} size="sm" />
          <strong>{reviewer.display_name}</strong>
          <Stars rating={review.rating} />
        </span>
        <span className={m.small}>{timeAgo(review.created_at)}</span>
      </span>
      {review.comment && <p className="pre-wrap">{review.comment}</p>}
      {review.seller_reply ? (
        <p className={m.small} style={{ borderLeft: "3px solid var(--color-border)", paddingLeft: "var(--space-3)" }}>
          <strong>Seller:</strong> {review.seller_reply}
        </p>
      ) : (
        canReply && (
          <form
            className="cluster"
            onSubmit={(e) => {
              e.preventDefault();
              reply.mutate(
                { id: review.id, reply: text.trim() },
                { onSuccess: () => toast.success("Reply posted"), onError: (err) => toast.error(errorMessage(err)) },
              );
            }}
          >
            <label htmlFor={`reply-${review.id}`} className="visually-hidden">
              Reply to this review
            </label>
            <Input
              id={`reply-${review.id}`}
              placeholder="Reply publicly"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button type="submit" size="sm" loading={reply.isPending} disabled={!text.trim()}>
              Reply
            </Button>
          </form>
        )
      )}
    </li>
  );
}

/** /sellers/:handle: a seller's shop, listings and reviews. */
export function SellerPage() {
  const { handle } = useParams();
  const { me } = useAuth();
  const seller = useSeller(handle);
  const reviews = useSellerReviews(handle);
  const listings = useListings({ seller: seller.data?.user?.id }, Boolean(seller.data?.user?.id));
  if (seller.isPending) return <PageLoader />;
  if (seller.isError) return <ErrorState error={seller.error} />;
  const s = seller.data;
  const user = s.user ?? FORMER;
  const mine = me?.id === user.id;
  return (
    <div className="stack">
      <Seo title={`${s.store_name || user.display_name}: shop`} description={s.about.slice(0, 160)} />
      <Card>
        <div className="cluster" style={{ justifyContent: "space-between" }}>
          <span className="cluster">
            <Avatar name={user.display_name} seed={user.id} src={user.avatar_url} size="lg" />
            <span className="stack" style={{ "--stack-gap": "var(--space-1)" } as React.CSSProperties}>
              <h1 style={{ fontSize: "var(--text-2xl)" }}>{s.store_name || user.display_name}</h1>
              <span className="cluster">
                <Stars rating={s.rating} />
                <span className="muted">
                  {s.rating_count} reviews · {s.sales_count} sales · selling since {timeAgo(s.created_at)}
                </span>
              </span>
              {user.handle && <Link to={`/u/${user.handle}`}>@{user.handle}</Link>}
            </span>
          </span>
          <ShareMenu title={s.store_name || user.display_name} path={`/sellers/${handle}`} />
        </div>
        {s.about && (
          <p className="pre-wrap" style={{ marginTop: "var(--space-3)" }}>
            {s.about}
          </p>
        )}
      </Card>
      {listings.data && listings.data.results.length > 0 && (
        <section className="stack">
          <h2 style={{ fontSize: "var(--text-lg)" }}>For sale</h2>
          <div className={browse.grid}>
            {listings.data.results.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}
      <Section title="Reviews">
        {reviews.isPending ? (
          <Spinner />
        ) : (reviews.data ?? []).length === 0 ? (
          <p className="muted">No reviews yet.</p>
        ) : (
          <ul className={m.list}>
            {reviews.data!.map((r) => (
              <ReviewItem key={r.id} review={r} canReply={mine} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/** Your shop name and description (on the Sell page). */
export function ShopSettings() {
  const seller = useMySeller();
  const update = useUpdateSeller();
  const toast = useToast();
  const [form, setForm] = useState<{ store_name: string; about: string } | null>(null);
  if (seller.isPending) return <Spinner />;
  const values = form ?? { store_name: seller.data?.store_name ?? "", about: seller.data?.about ?? "" };
  return (
    <Section
      title={
        <>
          <Store size={18} aria-hidden /> Your shop
        </>
      }
      description={
        seller.data?.user?.handle ? (
          <>
            Buyers see this on <Link to={`/sellers/${seller.data.user?.handle}`}>your shop page</Link>.
          </>
        ) : (
          "Buyers see this on your shop page."
        )
      }
    >
      <form
        className={m.form}
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate(values, {
            onSuccess: () => (setForm(null), toast.success("Shop saved")),
            onError: (err) => toast.error(errorMessage(err)),
          });
        }}
      >
        <Field label="Shop name">
          <Input
            value={values.store_name}
            maxLength={100}
            onChange={(e) => setForm({ ...values, store_name: e.target.value })}
          />
        </Field>
        <Field label="About your shop" optional>
          <Textarea
            value={values.about}
            maxLength={1000}
            onChange={(e) => setForm({ ...values, about: e.target.value })}
          />
        </Field>
        <div>
          <Button type="submit" loading={update.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Section>
  );
}

/** /marketplace/orders/:orderId */
export function OrderPage() {
  const { orderId = "" } = useParams();
  const { me } = useAuth();
  const order = useOrder(orderId);
  const act = useOrderAction();
  const dispute = useDisputeOrder(orderId);
  const review = useReviewOrder(orderId);
  const toast = useToast();
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [paying, setPaying] = useState(false);
  if (order.isPending) return <PageLoader />;
  if (order.isError) return <ErrorState error={order.error} />;
  const o = order.data;
  const role = me?.id === o.buyer?.id ? "buyer" : "seller";
  const other = role === "buyer" ? o.seller : o.buyer;
  const run = (action: "cancel" | "confirm" | "fulfil" | "complete", done: string) =>
    act.mutateAsync({ orderId: o.id, action }).then(() => toast.success(done));
  return (
    <div className="stack">
      <Seo title={`Order ${o.reference}`} noIndex />
      <PageHeader
        eyebrow={<Link to="/marketplace/orders">← Your orders</Link>}
        title={o.title}
        description={
          <span className="cluster">
            <StatusBadge status={o.status} /> Ref {o.reference}
          </span>
        }
      />
      <Section title="Order">
        <KeyValues
          items={[
            ["Item", o.listing ? <Link to={`/marketplace/${o.listing}`}>{o.title}</Link> : o.title],
            ["Quantity", o.quantity],
            ["Price", formatMoney(o.unit_price_minor, o.currency)],
            ["Delivery", o.delivery_fee_minor ? formatMoney(o.delivery_fee_minor, o.currency) : humanize(o.fulfilment)],
            ["Total", <strong key="t">{formatMoney(o.total_minor, o.currency)}</strong>],
            ["Payment", o.payment_method === "online" ? "Paystack (held safely until you confirm)" : "Cash on pickup"],
            [
              role === "buyer" ? "Seller" : "Buyer",
              other?.handle ? <Link to={`/u/${other.handle}`}>{other.display_name}</Link> : other?.display_name,
            ],
            ["Delivery details", o.delivery_details],
            ["Placed", formatDateTime(o.created_at)],
            ["Paid", o.paid_at && formatDateTime(o.paid_at)],
            ["Sent", o.fulfilled_at && formatDateTime(o.fulfilled_at)],
            [
              "Completes automatically",
              o.status === "fulfilled" && o.auto_complete_at ? formatDateTime(o.auto_complete_at) : null,
            ],
            ["Completed", o.completed_at && formatDateTime(o.completed_at)],
            [
              "Cancelled",
              o.cancelled_at && `${formatDateTime(o.cancelled_at)}${o.cancel_reason ? ` (${o.cancel_reason})` : ""}`,
            ],
            ["Dispute", o.disputed_at && `${formatDateTime(o.disputed_at)}: ${o.dispute_reason}`],
            [
              "Resolution",
              typeof o.resolution === "string" ? o.resolution : o.resolution ? JSON.stringify(o.resolution) : null,
            ],
          ]}
        />
        <div className="cluster">
          {role === "buyer" && o.status === "pending_payment" && (
            <Button
              loading={paying}
              onClick={() => {
                setPaying(true);
                startCheckout("marketplace.order", o.id).catch((e) => (setPaying(false), toast.error(errorMessage(e))));
              }}
            >
              Pay now
            </Button>
          )}
          {role === "buyer" && (o.status === "paid" || o.status === "fulfilled") && (
            <ActionButton variant="primary" run={() => run("confirm", "Thanks! The seller gets paid now.")}>
              I've received it
            </ActionButton>
          )}
          {role === "seller" && o.status === "paid" && (
            <ActionButton run={() => run("fulfil", "Marked as sent")}>Mark as sent</ActionButton>
          )}
          {role === "seller" && o.status === "placed" && o.payment_method === "cash_on_pickup" && (
            <ActionButton run={() => run("complete", "Order completed")}>Cash received</ActionButton>
          )}
          {(o.status === "pending_payment" || o.status === "placed" || (role === "seller" && o.status === "paid")) && (
            <ActionButton variant="ghost" confirm="Cancel this order?" run={() => run("cancel", "Order cancelled")}>
              Cancel order
            </ActionButton>
          )}
          {role === "buyer" && (o.status === "paid" || o.status === "fulfilled") && (
            <ActionButton
              variant="danger"
              reason="What went wrong? GistLoop holds the money while we look into it."
              run={(reason) => dispute.mutateAsync(reason)}
              success="Dispute opened. We'll be in touch."
            >
              Report a problem
            </ActionButton>
          )}
        </div>
      </Section>
      {role === "buyer" && o.status === "completed" && !o.reviewed && (
        <Section title="Review the seller">
          <form
            className={m.form}
            onSubmit={(e) => {
              e.preventDefault();
              review.mutate(
                { rating: Number(rating), comment },
                {
                  onSuccess: () => toast.success("Thanks for your review"),
                  onError: (err) => toast.error(errorMessage(err)),
                },
              );
            }}
          >
            <Field label="Rating">
              <Select value={rating} onChange={(e) => setRating(e.target.value)}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {"★".repeat(n)} ({n})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Comment" optional>
              <Textarea maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
            </Field>
            {review.isError && <Alert tone="error">{errorMessage(review.error)}</Alert>}
            <div>
              <Button type="submit" loading={review.isPending}>
                Post review
              </Button>
            </div>
          </form>
        </Section>
      )}
      {o.status === "completed" && o.reviewed && <p className="muted">You've reviewed this order. Thank you.</p>}
      {!o && <EmptyState title="Order not found" />}
    </div>
  );
}
