import { Check, Crown } from "lucide-react";
import { useState } from "react";

import { errorMessage } from "@/api/errors";
import {
  useAbandonSubscription,
  useMySubscription,
  usePlans,
  useSetCancelAtPeriodEnd,
  useSubscribe,
} from "@/api/queries/monetization";
import { startCheckout } from "@/api/queries/payments";
import type { components } from "@/api/schema";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader, PageHero } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Form";
import { PageLoader } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import styles from "@/features/content/Lists.module.css";
import { formatDate, formatMoney, humanize } from "@/lib/format";

type S = components["schemas"];
type Interval = S["IntervalEnum"];

const CURRENCY = "NGN";

/** Pay what's due on a subscription (the first period, or a renewal). */
async function payDue(sub: S["Subscription"]) {
  if (!sub.payment_due) return;
  await startCheckout(sub.payment_due.purpose, sub.payment_due.object_id);
}

/** /premium: plans for everyone; the member's own plan when signed in. */
export default function PremiumPage() {
  const { status } = useAuth();
  const signedIn = status === "signed-in";
  const plans = usePlans();
  const mine = useMySubscription(signedIn);
  const subscribe = useSubscribe();
  const toast = useToast();
  const [interval, setInterval] = useState<Interval>("month");
  const [choosing, setChoosing] = useState<string | null>(null);

  if (plans.isPending || (signedIn && mine.isPending)) return <PageLoader />;
  if (plans.isError) return <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />;

  const sub = mine.data?.subscription ?? null;
  const live = sub && sub.status !== "expired" && sub.status !== "abandoned" ? sub : null;
  const description = "Go ad-free, stand out with a badge and get more from GistLoop. Cancel any time.";

  const choose = (plan: string) => {
    setChoosing(plan);
    subscribe.mutate(
      { plan, interval, currency: CURRENCY },
      {
        onSuccess: (created) =>
          void payDue(created).catch((e) => {
            setChoosing(null);
            toast.error(errorMessage(e));
          }),
        onError: (e) => {
          setChoosing(null);
          toast.error(errorMessage(e));
        },
      },
    );
  };

  const grid = (
    <div className="stack">
      <Tabs
        label="Billing period"
        value={interval}
        onChange={setInterval}
        items={[
          { value: "month", label: "Monthly" },
          { value: "year", label: "Yearly" },
        ]}
      />
      <div className={styles.plans}>
        {plans.data.map((plan) => {
          const price = plan.prices.find((p) => p.interval === interval && p.currency === CURRENCY);
          const current = live?.plan === plan.key;
          return (
            <Card key={plan.key}>
              <div className={styles.plan}>
                <div className="cluster">
                  <h2 style={{ margin: 0, fontSize: "var(--text-xl)" }}>{plan.name}</h2>
                  {current && <Badge tone="success">Your plan</Badge>}
                </div>
                <p className="muted" style={{ margin: 0 }}>
                  {plan.description}
                </p>
                {price ? (
                  <div>
                    <span className={styles.price}>{formatMoney(price.amount_minor, price.currency)}</span>
                    <span className="muted"> / {interval}</span>
                  </div>
                ) : (
                  <span className="muted">Not available {interval === "year" ? "yearly" : "monthly"}</span>
                )}
                <ul className={styles.perks}>
                  {plan.entitlements.map((perk) => (
                    <li key={perk.key}>
                      <Check size={16} aria-hidden /> {perk.label}
                    </li>
                  ))}
                </ul>
                {!signedIn ? (
                  <ButtonLink to={`/register?next=${encodeURIComponent("/premium")}`} block>
                    Get {plan.name}
                  </ButtonLink>
                ) : current ? (
                  <Button block variant="secondary" disabled>
                    Current plan
                  </Button>
                ) : (
                  <Button
                    block
                    disabled={!price || (Boolean(live) && live!.status !== "pending_payment")}
                    loading={choosing === plan.key}
                    onClick={() => choose(plan.key)}
                  >
                    Get {plan.name}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
        Payments go through Paystack. Plans don't renew automatically: we'll remind you before the period ends.
      </p>
    </div>
  );

  if (!signedIn)
    return (
      <>
        <Seo title="Premium" description={description} />
        <PageHero eyebrow="Premium" title="More GistLoop, no adverts" description={description} />
        <div className="container" style={{ paddingBlock: "var(--space-8) var(--space-16)" }}>
          {grid}
        </div>
      </>
    );

  return (
    <>
      <Seo title="Premium" noIndex />
      <PageHeader title="Premium" description={description} />
      <div className="stack">
        {live && <MyPlan sub={live} />}
        {grid}
      </div>
    </>
  );
}

function MyPlan({ sub }: { sub: S["Subscription"] }) {
  const toast = useToast();
  const cancel = useSetCancelAtPeriodEnd();
  const abandon = useAbandonSubscription();
  const [paying, setPaying] = useState(false);
  const pay = async () => {
    setPaying(true);
    try {
      await payDue(sub);
    } catch (error) {
      setPaying(false);
      toast.error(errorMessage(error));
    }
  };
  const due = sub.payment_due;

  return (
    <Card>
      <div className="stack">
        <div className={styles.row}>
          <div className="cluster">
            <Crown size={20} aria-hidden />
            <strong>{sub.plan_name}</strong>
            <span className="muted">· billed {sub.interval === "year" ? "yearly" : "monthly"}</span>
          </div>
          <Badge tone={sub.status === "active" ? "success" : "warning"}>{humanize(sub.status)}</Badge>
        </div>
        {sub.status === "pending_payment" && (
          <Alert tone="warning">Your plan starts as soon as the first payment goes through.</Alert>
        )}
        {sub.status === "past_due" && (
          <Alert tone="warning">
            Your period ended. Pay now to keep your perks; they stop soon if the renewal isn't paid.
          </Alert>
        )}
        {sub.current_period_end && sub.status !== "pending_payment" && (
          <p className="muted" style={{ margin: 0 }}>
            {sub.cancel_at_period_end ? "Ends" : "Renews"} on {formatDate(sub.current_period_end)}
          </p>
        )}
        <div className="cluster">
          {due && (
            <Button loading={paying} onClick={() => void pay()}>
              Pay {formatMoney(due.amount_minor, due.currency)}
            </Button>
          )}
          {sub.status === "pending_payment" && (
            <Button
              variant="ghost"
              loading={abandon.isPending}
              onClick={() => abandon.mutate(undefined, { onError: (e) => toast.error(errorMessage(e)) })}
            >
              Cancel
            </Button>
          )}
          {(sub.status === "active" || sub.status === "past_due") && (
            <Button
              variant="ghost"
              loading={cancel.isPending}
              onClick={() =>
                cancel.mutate(!sub.cancel_at_period_end, {
                  onSuccess: () =>
                    toast.success(sub.cancel_at_period_end ? "Your plan will renew" : "Your plan won't renew"),
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              {sub.cancel_at_period_end ? "Keep my plan" : "Don't renew"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
