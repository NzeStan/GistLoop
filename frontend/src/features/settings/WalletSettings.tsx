import { Banknote, Receipt } from "lucide-react";
import { useState } from "react";

import { errorMessage } from "@/api/errors";
import { PAYMENT_PURPOSES } from "@/api/queries/payments";
import {
  type PaymentIntent,
  useBalance,
  useCancelPayout,
  useMyPayments,
  useMyPayouts,
  usePaymentProviders,
  useRefunds,
  useRequestPayout,
} from "@/api/queries/wallet";
import { ActionButton, DataTable, Section, StatusBadge } from "@/components/Manage";
import m from "@/components/Manage.module.css";
import { Button } from "@/components/ui/Button";
import { Alert, Field, Input } from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime, formatMoney } from "@/lib/format";

function Refunds({ payment }: { payment: PaymentIntent }) {
  const refunds = useRefunds(payment.reference);
  if (refunds.isPending) return <Spinner />;
  if (!refunds.data?.length) return <span className={m.small}>No refunds.</span>;
  return (
    <ul className={m.list}>
      {refunds.data.map((r) => (
        <li key={r.reference} className={m.small}>
          {formatMoney(r.amount_minor, payment.currency)} <StatusBadge status={r.status} />{" "}
          {formatDateTime(r.created_at)}
          {r.reason && ` · ${r.reason}`}
        </li>
      ))}
    </ul>
  );
}

function Payments() {
  const payments = useMyPayments();
  const providers = usePaymentProviders();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Section
      title={
        <>
          <Receipt size={18} aria-hidden /> Your payments
        </>
      }
      description={
        providers.data?.length
          ? `Payments are processed by ${providers.data.map((p) => p.label).join(", ")}. GistLoop never sees your card.`
          : "Tickets, orders, adverts and premium plans you've paid for."
      }
    >
      {payments.isPending ? (
        <Spinner />
      ) : payments.isError ? (
        <ErrorState error={payments.error} />
      ) : payments.data.results.length === 0 ? (
        <p className="muted">No payments yet.</p>
      ) : (
        <DataTable
          caption="Payments"
          rows={payments.data.results}
          rowKey={(p) => p.reference}
          columns={[
            {
              header: "What",
              cell: (p) => (
                <>
                  {p.description || PAYMENT_PURPOSES[p.purpose]?.label || p.purpose}
                  <div className={m.small}>Ref {p.reference}</div>
                  {open === p.reference && <Refunds payment={p} />}
                </>
              ),
            },
            { header: "Amount", end: true, cell: (p) => formatMoney(p.amount_minor, p.currency) },
            { header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
            { header: "Date", cell: (p) => formatDateTime(p.paid_at ?? p.created_at) },
            {
              header: <span className="visually-hidden">Refunds</span>,
              cell: (p) =>
                p.amount_refunded_minor > 0 ? (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => setOpen(open === p.reference ? null : p.reference)}
                  >
                    {formatMoney(p.amount_refunded_minor, p.currency)} refunded
                  </button>
                ) : null,
            },
          ]}
        />
      )}
    </Section>
  );
}

function Payouts() {
  const balance = useBalance();
  const payouts = useMyPayouts();
  const request = useRequestPayout();
  const cancel = useCancelPayout();
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const naira = balance.data?.find((b) => b.currency === "NGN") ?? balance.data?.[0];
  return (
    <Section
      title={
        <>
          <Banknote size={18} aria-hidden /> Earnings and payouts
        </>
      }
      description="Money from your sales and paid events. It becomes available once buyers confirm or the event ends."
    >
      {balance.isPending ? (
        <Spinner />
      ) : (
        <div className={m.statGrid}>
          <div className={m.stat}>
            <span className={m.statValue}>{formatMoney(naira?.available ?? 0, naira?.currency ?? "NGN")}</span>
            <span className={m.small}>Available to withdraw</span>
          </div>
          <div className={m.stat}>
            <span className={m.statValue}>{formatMoney(naira?.held ?? 0, naira?.currency ?? "NGN")}</span>
            <span className={m.small}>Held until delivery is confirmed</span>
          </div>
          <div className={m.stat}>
            <span className={m.statValue}>{formatMoney(naira?.payout ?? 0, naira?.currency ?? "NGN")}</span>
            <span className={m.small}>Being paid out</span>
          </div>
        </div>
      )}
      {(naira?.available ?? 0) > 0 && (
        <form
          className="cluster"
          onSubmit={(e) => {
            e.preventDefault();
            request.mutate(
              {
                amount_minor: Math.round(Number(amount) * 100),
                currency: naira?.currency ?? "NGN",
                destination: destination.trim(),
              },
              {
                onSuccess: () => (
                  setAmount(""),
                  toast.success("Payout requested. We'll send it within 2 working days.")
                ),
                onError: (err) => toast.error(errorMessage(err)),
              },
            );
          }}
        >
          <Field label="Amount (₦)">
            <Input
              type="number"
              min={1}
              max={(naira?.available ?? 0) / 100}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Bank account" hint="Bank name, account number and account name.">
            <Input value={destination} maxLength={120} onChange={(e) => setDestination(e.target.value)} />
          </Field>
          <Button type="submit" loading={request.isPending} disabled={!amount || !destination.trim()}>
            Request payout
          </Button>
        </form>
      )}
      {request.isError && <Alert tone="error">{errorMessage(request.error)}</Alert>}
      {payouts.data && payouts.data.length > 0 && (
        <DataTable
          caption="Payouts"
          rows={payouts.data}
          rowKey={(p) => p.id}
          columns={[
            { header: "Amount", cell: (p) => formatMoney(p.amount_minor, p.currency) },
            { header: "To", cell: (p) => <span className={m.small}>{p.destination}</span> },
            { header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
            {
              header: "When",
              cell: (p) => (
                <>
                  {formatDateTime(p.created_at)}
                  {p.note && <div className={m.small}>{p.note}</div>}
                </>
              ),
            },
            {
              header: <span className="visually-hidden">Actions</span>,
              end: true,
              cell: (p) =>
                p.status === "requested" ? (
                  <ActionButton variant="ghost" run={() => cancel.mutateAsync(p.id)} success="Payout cancelled">
                    Cancel
                  </ActionButton>
                ) : null,
            },
          ]}
        />
      )}
    </Section>
  );
}

/** /settings/wallet */
export default function WalletSettings() {
  return (
    <>
      <Payments />
      <Payouts />
    </>
  );
}
