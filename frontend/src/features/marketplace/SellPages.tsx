import { ImagePlus, Package, X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { ApiError, errorMessage } from "@/api/errors";
import {
  type OrderAction,
  useCreateListing,
  useListingAction,
  useMarketCategories,
  useMyOrders,
  useOrderAction,
  useUploadListingImage,
} from "@/api/queries/marketplace";
import { startCheckout } from "@/api/queries/payments";
import type { MarketOrder } from "@/api/types";
import { PageHeader } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FilePicker } from "@/components/ui/FilePicker";
import { Alert, Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { formatMoney, humanize, timeAgo } from "@/lib/format";

import styles from "./Sell.module.css";

const MAX_PHOTOS = 8;
const toMinor = (naira: string) => Math.round(Number(naira || 0) * 100);

/** A picked photo, previewed locally until the listing exists and it can be uploaded. */
interface Photo {
  file: File;
  preview: string;
}

export function SellPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const categories = useMarketCategories();
  const create = useCreateListing();
  const uploadImage = useUploadListingImage();
  const publish = useListingAction();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    condition: "used",
    price: "",
    quantity: "1",
    city: "",
    location_note: "",
    allows_pickup: true,
    allows_delivery: false,
    delivery_fee: "",
    allows_cash_on_pickup: false,
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  // Release the local previews when the page goes away (removed photos are released on removal).
  const latest = useRef(photos);
  useEffect(() => {
    latest.current = photos;
  }, [photos]);
  useEffect(() => () => latest.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  const onPick = (files: File[]) => {
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) toast.error(`You can add up to ${MAX_PHOTOS} photos.`);
    setPhotos((current) => [
      ...current,
      ...files.slice(0, Math.max(room, 0)).map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      const listing = await create.mutateAsync({
        title: form.title,
        description: form.description,
        category: form.category,
        condition: form.condition as "new" | "like_new" | "used",
        price_minor: toMinor(form.price),
        currency: "NGN",
        quantity: Number(form.quantity) || 1,
        city: form.city,
        location_note: form.location_note,
        allows_pickup: form.allows_pickup,
        allows_delivery: form.allows_delivery,
        delivery_fee_minor: form.allows_delivery ? toMinor(form.delivery_fee) : 0,
        allows_cash_on_pickup: form.allows_pickup && form.allows_cash_on_pickup,
      });
      for (const photo of photos) {
        try {
          await uploadImage.mutateAsync({ listingId: listing.id, file: photo.file });
        } catch (error) {
          toast.error(`${photo.file.name}: ${errorMessage(error)}`);
        }
      }
      await publish.mutateAsync({ listingId: listing.id, action: "publish" });
      toast.success("Your listing is live!");
      navigate(`/marketplace/${listing.id}`);
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fieldErrors);
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Seo title="Sell something" noIndex />
      <PageHeader
        title="Sell something"
        description="List it in a minute. Online payments are held until the buyer confirms."
      />
      <Card>
        <form className={styles.form} onSubmit={(e) => void onSubmit(e)} noValidate>
          <Field label="Photos" hint={`Up to ${MAX_PHOTOS}. The first one is the cover.`}>
            <div className="stack">
              {photos.length > 0 && (
                <ul className={styles.photos}>
                  {photos.map((p, index) => (
                    <li key={p.preview}>
                      <img src={p.preview} alt={index === 0 ? `Cover: ${p.file.name}` : p.file.name} />
                      <button
                        type="button"
                        aria-label={`Remove photo ${index + 1}`}
                        onClick={() => {
                          URL.revokeObjectURL(p.preview);
                          setPhotos((current) => current.filter((x) => x !== p));
                        }}
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div>
                <FilePicker
                  multiple
                  leading={<ImagePlus size={16} />}
                  disabled={photos.length >= MAX_PHOTOS}
                  onPick={onPick}
                >
                  Add photos
                </FilePicker>
              </div>
            </div>
          </Field>
          <Field label="Title" error={errors.title}>
            <Input maxLength={120} value={form.title} onChange={(e) => set("title", e.target.value)} required />
          </Field>
          <Field label="Description" optional error={errors.description}>
            <Textarea rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <div className={styles.row}>
            <Field label="Category" error={errors.category}>
              <Select value={form.category} onChange={(e) => set("category", e.target.value)} required>
                <option value="">Choose…</option>
                {categories.data?.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Condition" error={errors.condition}>
              <Select value={form.condition} onChange={(e) => set("condition", e.target.value)}>
                <option value="new">New</option>
                <option value="like_new">Like new</option>
                <option value="used">Used</option>
              </Select>
            </Field>
          </div>
          <div className={styles.row}>
            <Field label="Price (₦)" error={errors.price_minor}>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                required
              />
            </Field>
            <Field label="Quantity" error={errors.quantity}>
              <Input type="number" min={1} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
            </Field>
          </div>
          <div className={styles.row}>
            <Field label="City" optional error={errors.city}>
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="Meeting point" optional hint="e.g. Faculty of Science gate" error={errors.location_note}>
              <Input value={form.location_note} onChange={(e) => set("location_note", e.target.value)} />
            </Field>
          </div>
          <fieldset className={styles.options}>
            <legend>How buyers get it</legend>
            <Checkbox
              label="Pickup"
              checked={form.allows_pickup}
              onChange={(e) => set("allows_pickup", e.target.checked)}
            />
            {form.allows_pickup && (
              <Checkbox
                label="Accept cash on pickup"
                checked={form.allows_cash_on_pickup}
                onChange={(e) => set("allows_cash_on_pickup", e.target.checked)}
              />
            )}
            <Checkbox
              label="Delivery"
              checked={form.allows_delivery}
              onChange={(e) => set("allows_delivery", e.target.checked)}
            />
          </fieldset>
          {form.allows_delivery && (
            <Field label="Delivery fee (₦)" optional error={errors.delivery_fee_minor}>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={form.delivery_fee}
                onChange={(e) => set("delivery_fee", e.target.value)}
              />
            </Field>
          )}
          {errors.non_field_errors && <Alert tone="error">{errors.non_field_errors}</Alert>}
          <div>
            <Button
              type="submit"
              loading={saving}
              disabled={
                !form.title.trim() || !form.category || !form.price || (!form.allows_pickup && !form.allows_delivery)
              }
            >
              Publish listing
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}

// -------------------------------------------------------------------- orders
const STATUS_TONE: Record<string, "neutral" | "primary" | "success" | "warning" | "danger"> = {
  pending_payment: "warning",
  placed: "primary",
  paid: "primary",
  fulfilled: "primary",
  completed: "success",
  cancelled: "neutral",
  disputed: "danger",
  refunded: "neutral",
};

export function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const role = params.get("role") === "seller" ? "seller" : "buyer";
  const orders = useMyOrders(role);

  return (
    <>
      <Seo title="Your orders" noIndex />
      <PageHeader title="Orders" description="Track what you've bought and sold." />
      <div className="stack">
        <Tabs
          label="Orders"
          value={role}
          onChange={(next) => setParams(next === "seller" ? { role: "seller" } : {})}
          items={[
            { value: "buyer", label: "Buying" },
            { value: "seller", label: "Selling" },
          ]}
        />
        {orders.isPending ? (
          <Spinner />
        ) : orders.isError ? (
          <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
        ) : orders.data.results.length === 0 ? (
          <EmptyState icon={Package} title={role === "buyer" ? "No purchases yet" : "No sales yet"}>
            {role === "buyer" ? (
              <Link to="/marketplace">Browse the marketplace</Link>
            ) : (
              <Link to="/marketplace/sell">List something</Link>
            )}
          </EmptyState>
        ) : (
          <ul className={styles.orders}>
            {orders.data.results.map((order) => (
              <li key={order.id}>
                <OrderCard order={order} role={role} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function OrderCard({ order: o, role }: { order: MarketOrder; role: "buyer" | "seller" }) {
  const act = useOrderAction();
  const toast = useToast();
  const [paying, setPaying] = useState(false);
  const run = (action: OrderAction, done: string) =>
    act.mutate(
      { orderId: o.id, action },
      { onSuccess: () => toast.success(done), onError: (error) => toast.error(errorMessage(error)) },
    );
  const pay = async () => {
    setPaying(true);
    try {
      await startCheckout("marketplace.order", o.id);
    } catch (error) {
      setPaying(false);
      toast.error(errorMessage(error));
    }
  };
  const other = role === "buyer" ? o.seller : o.buyer;

  return (
    <Card>
      <div className={styles.order}>
        <div className={styles.orderInfo}>
          <strong>
            {o.listing ? <Link to={`/marketplace/${o.listing}`}>{o.title}</Link> : o.title}
            {o.quantity > 1 && ` × ${o.quantity}`}
          </strong>
          <span className="muted">
            {formatMoney(o.total_minor, o.currency)} · {humanize(o.fulfilment)} · {role === "buyer" ? "from" : "to"}{" "}
            {other?.display_name ?? "someone"} · {timeAgo(o.created_at)}
          </span>
          <span className="muted">Ref {o.reference}</span>
        </div>
        <div className="cluster">
          <Badge tone={STATUS_TONE[o.status] ?? "neutral"}>{humanize(o.status)}</Badge>
          {role === "buyer" && o.status === "pending_payment" && (
            <Button size="sm" loading={paying} onClick={() => void pay()}>
              Pay now
            </Button>
          )}
          {role === "buyer" && (o.status === "paid" || o.status === "fulfilled") && (
            <Button
              size="sm"
              loading={act.isPending}
              onClick={() => run("confirm", "Thanks! The seller gets paid now.")}
            >
              I've received it
            </Button>
          )}
          {role === "seller" && o.status === "paid" && (
            <Button size="sm" loading={act.isPending} onClick={() => run("fulfil", "Marked as sent")}>
              Mark as sent
            </Button>
          )}
          {role === "seller" && o.status === "placed" && o.payment_method === "cash_on_pickup" && (
            <Button size="sm" loading={act.isPending} onClick={() => run("complete", "Order completed")}>
              Cash received
            </Button>
          )}
          {(o.status === "pending_payment" || o.status === "placed" || (role === "seller" && o.status === "paid")) && (
            <Button size="sm" variant="ghost" loading={act.isPending} onClick={() => run("cancel", "Order cancelled")}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
