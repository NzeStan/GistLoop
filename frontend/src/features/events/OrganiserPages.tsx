import { ImagePlus, Ticket } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import { ApiError, errorMessage } from "@/api/errors";
import {
  useCreateEvent,
  useCreateTicketType,
  useMyTickets,
  usePublishEvent,
  useUploadEventCover,
} from "@/api/queries/events";
import { startCheckout } from "@/api/queries/payments";
import type { EventRegistration } from "@/api/types";
import { PageHeader } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FilePicker } from "@/components/ui/FilePicker";
import { Alert, Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import styles from "@/features/marketplace/Sell.module.css";
import { formatMoney, formatRange, humanize } from "@/lib/format";

/** A datetime-local value ("2026-11-02T18:00") as an ISO timestamp in the browser's time zone. */
const toIso = (local: string) => (local ? new Date(local).toISOString() : "");

export function CreateEventPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreateEvent();
  const uploadCover = useUploadEventCover();
  const createTicket = useCreateTicketType();
  const publish = usePublishEvent();
  const [cover, setCover] = useState<{ file: File; preview: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    title: "",
    summary: "",
    description: "",
    format: "in_person" as "in_person" | "online" | "hybrid",
    venue: "",
    location_details: "",
    online_url: "",
    starts_at: "",
    ends_at: "",
    capacity: "",
    price: "",
    requires_approval: false,
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => () => (cover ? URL.revokeObjectURL(cover.preview) : undefined), [cover]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      const created = await create.mutateAsync({
        title: form.title,
        summary: form.summary,
        description: form.description,
        format: form.format,
        location_details: [form.venue, form.location_details].filter(Boolean).join(" · "),
        online_url: form.format === "in_person" ? "" : form.online_url,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        starts_at: toIso(form.starts_at),
        ends_at: toIso(form.ends_at),
        capacity: form.capacity ? Number(form.capacity) : null,
        requires_approval: form.requires_approval,
        waitlist_enabled: Boolean(form.capacity),
      });
      if (cover) {
        try {
          await uploadCover.mutateAsync({ eventId: created.id, file: cover.file });
        } catch (error) {
          toast.error(`Cover: ${errorMessage(error)}`);
        }
      }
      const price = Math.round(Number(form.price || 0) * 100);
      if (price > 0) {
        await createTicket.mutateAsync({
          eventId: created.id,
          body: { name: "General admission", price_minor: price, currency: "NGN" },
        });
      }
      const published = await publish.mutateAsync(created.id);
      toast.success("Your event is live!");
      navigate(`/events/${published.slug}`);
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fieldErrors);
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Seo title="Create an event" noIndex />
      <PageHeader title="Create an event" description="Publish it, sell tickets and check people in at the door." />
      <Card>
        <form className={styles.form} onSubmit={(e) => void onSubmit(e)} noValidate>
          <Field label="Cover image" optional hint="A wide image works best (16:9).">
            <div className="stack">
              {cover && <img src={cover.preview} alt="" className={styles.cover} />}
              <div>
                <FilePicker
                  leading={<ImagePlus size={16} />}
                  onPick={([file]) => file && setCover({ file, preview: URL.createObjectURL(file) })}
                >
                  {cover ? "Change cover" : "Add a cover"}
                </FilePicker>
              </div>
            </div>
          </Field>
          <Field label="Title" error={errors.title}>
            <Input maxLength={200} value={form.title} onChange={(e) => set("title", e.target.value)} required />
          </Field>
          <Field label="Summary" optional hint="One line shown on event cards." error={errors.summary}>
            <Input maxLength={300} value={form.summary} onChange={(e) => set("summary", e.target.value)} />
          </Field>
          <Field label="Description" optional error={errors.description}>
            <Textarea rows={6} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <div className={styles.row}>
            <Field label="Starts" error={errors.starts_at}>
              <Input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => set("starts_at", e.target.value)}
                required
              />
            </Field>
            <Field label="Ends" error={errors.ends_at}>
              <Input
                type="datetime-local"
                value={form.ends_at}
                min={form.starts_at || undefined}
                onChange={(e) => set("ends_at", e.target.value)}
                required
              />
            </Field>
          </div>
          <Field label="Format" error={errors.format}>
            <Select value={form.format} onChange={(e) => set("format", e.target.value as typeof form.format)}>
              <option value="in_person">In person</option>
              <option value="online">Online</option>
              <option value="hybrid">Hybrid</option>
            </Select>
          </Field>
          {form.format !== "online" && (
            <div className={styles.row}>
              <Field label="Venue" error={errors.venue}>
                <Input value={form.venue} onChange={(e) => set("venue", e.target.value)} />
              </Field>
              <Field label="Directions" optional error={errors.location_details}>
                <Input value={form.location_details} onChange={(e) => set("location_details", e.target.value)} />
              </Field>
            </div>
          )}
          {form.format !== "in_person" && (
            <Field label="Online link" hint="Shown only to people with a confirmed place." error={errors.online_url}>
              <Input
                type="url"
                placeholder="https://"
                value={form.online_url}
                onChange={(e) => set("online_url", e.target.value)}
              />
            </Field>
          )}
          <div className={styles.row}>
            <Field label="Capacity" optional hint="Leave empty for unlimited." error={errors.capacity}>
              <Input type="number" min={1} value={form.capacity} onChange={(e) => set("capacity", e.target.value)} />
            </Field>
            <Field label="Ticket price (₦)" optional hint="Leave empty for a free event." error={errors.price_minor}>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
              />
            </Field>
          </div>
          <Checkbox
            label="I'll approve each registration"
            checked={form.requires_approval}
            onChange={(e) => set("requires_approval", e.target.checked)}
          />
          {errors.non_field_errors && <Alert tone="error">{errors.non_field_errors}</Alert>}
          <div>
            <Button
              type="submit"
              loading={saving}
              disabled={
                !form.title.trim() ||
                !form.starts_at ||
                !form.ends_at ||
                (form.format !== "online" && !form.venue.trim() && !form.location_details.trim()) ||
                (form.format !== "in_person" && !form.online_url.trim())
              }
            >
              Publish event
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}

// -------------------------------------------------------------------- tickets
export function MyTicketsPage() {
  const tickets = useMyTickets();
  return (
    <>
      <Seo title="Your tickets" noIndex />
      <PageHeader title="Your tickets" description="Show the ticket code at the door." />
      {tickets.isPending ? (
        <Spinner />
      ) : tickets.isError ? (
        <ErrorState error={tickets.error} onRetry={() => void tickets.refetch()} />
      ) : tickets.data.length === 0 ? (
        <EmptyState icon={Ticket} title="No tickets yet">
          <Link to="/events">Find something to go to</Link>
        </EmptyState>
      ) : (
        <ul className={styles.orders}>
          {tickets.data.map((r) => (
            <li key={r.id}>
              <TicketCard registration={r} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function TicketCard({ registration: r }: { registration: EventRegistration }) {
  const toast = useToast();
  const [paying, setPaying] = useState(false);
  const pay = async () => {
    setPaying(true);
    try {
      await startCheckout("events.registration", r.id);
    } catch (error) {
      setPaying(false);
      toast.error(errorMessage(error));
    }
  };
  return (
    <Card>
      <div className={styles.order}>
        <div className={styles.orderInfo}>
          <strong>
            <Link to={`/events/${r.event.slug}`}>{r.event.title}</Link>
          </strong>
          <span className="muted">
            {formatRange(r.event.starts_at, r.event.ends_at)}
            {r.ticket_type && ` · ${r.ticket_type.name}`}
            {r.amount_minor > 0 && ` · ${formatMoney(r.amount_minor, r.currency)}`}
          </span>
          {r.ticket_code && (
            <span>
              Ticket code: <code>{r.ticket_code}</code>
            </span>
          )}
        </div>
        <div className="cluster">
          <Badge tone={r.status === "confirmed" ? "success" : r.status === "pending_payment" ? "warning" : "neutral"}>
            {humanize(r.status)}
          </Badge>
          {r.status === "pending_payment" && (
            <Button size="sm" loading={paying} onClick={() => void pay()}>
              Pay now
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
