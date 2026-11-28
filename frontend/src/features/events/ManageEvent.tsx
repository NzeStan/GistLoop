import { CalendarDays, Download, Plus, ScanLine } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { errorMessage } from "@/api/errors";
import {
  type EventSession,
  type EventUpdate,
  type ManagedEvent,
  type TicketType,
  downloadAttendees,
  useAddOrganizer,
  useAddTicketType,
  useAttendees,
  useCancelEvent,
  useCheckIn,
  useDecideRegistration,
  useDeleteEvent,
  useDeleteSession,
  useDeleteTicketType,
  useEventCover,
  useManagedEvent,
  useMyOrganisedEvents,
  useOrganizers,
  usePublishManagedEvent,
  useRemoveOrganizer,
  useSaveSession,
  useSaveVenue,
  useSessions,
  useTransferEvent,
  useUpdateEvent,
  useUpdateTicketType,
  useVenues,
} from "@/api/queries/eventAdmin";
import { ActionButton, DataTable, NoAccess, Section, StatusBadge } from "@/components/Manage";
import m from "@/components/Manage.module.css";
import { PageHeader } from "@/components/PageHeader";
import { PersonPicker } from "@/components/PersonPicker";
import { Seo } from "@/components/Seo";
import { ShareMenu } from "@/components/ShareMenu";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FilePicker } from "@/components/ui/FilePicker";
import { Alert, Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { PageLoader, Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime, formatMoney, formatRange, humanize } from "@/lib/format";
import { useDebounced } from "@/lib/hooks";

/** "2026-03-01T18:00" for <input type="datetime-local"> from an ISO date. */
const toLocal = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocal = (value: string) => (value ? new Date(value).toISOString() : null);

/** /events/mine: events you organise. */
export function MyEventsPage() {
  const events = useMyOrganisedEvents();
  return (
    <div className="stack">
      <Seo title="Your events" noIndex />
      <PageHeader
        eyebrow={<Link to="/events">← Events</Link>}
        title="Events you organise"
        actions={
          <ButtonLink to="/events/new" leading={<Plus size={16} />}>
            Create an event
          </ButtonLink>
        }
      />
      <Card>
        {events.isPending ? (
          <Spinner />
        ) : events.isError ? (
          <ErrorState error={events.error} />
        ) : events.data.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No events yet" />
        ) : (
          <ul className={m.list}>
            {events.data.map((e) => (
              <li key={e.id} className={m.item}>
                <div className={m.itemMain}>
                  <Link to={`/events/manage/${e.id}`}>
                    <strong>{e.title}</strong>
                  </Link>
                  <span className="cluster" style={{ "--cluster-gap": "var(--space-2)" } as React.CSSProperties}>
                    <StatusBadge status={e.status} />
                    <span className={m.small}>{formatRange(e.starts_at, e.ends_at)}</span>
                  </span>
                </div>
                <ButtonLink size="sm" variant="secondary" to={`/events/manage/${e.id}`}>
                  Manage
                </ButtonLink>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function VenuePicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const [q, setQ] = useState("");
  const venues = useVenues(useDebounced(q));
  const save = useSaveVenue();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [venue, setVenue] = useState({ name: "", address: "", city: "", capacity: "" });
  return (
    <div className="stack" style={{ "--stack-gap": "var(--space-2)" } as React.CSSProperties}>
      <div className="cluster">
        <Field label="Venue" optional>
          <Select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
            <option value="">No saved venue</option>
            {venues.data?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.city && `, ${v.city}`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Find a venue" optional>
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Jaja Hall" />
        </Field>
        <Button type="button" variant="ghost" size="sm" onClick={() => setAdding((v) => !v)}>
          New venue
        </Button>
      </div>
      {adding && (
        <div className={m.formRow}>
          <Field label="Venue name">
            <Input value={venue.name} onChange={(e) => setVenue((v) => ({ ...v, name: e.target.value }))} />
          </Field>
          <Field label="Address" optional>
            <Input value={venue.address} onChange={(e) => setVenue((v) => ({ ...v, address: e.target.value }))} />
          </Field>
          <Field label="City" optional>
            <Input value={venue.city} onChange={(e) => setVenue((v) => ({ ...v, city: e.target.value }))} />
          </Field>
          <Field label="Capacity" optional>
            <Input
              type="number"
              value={venue.capacity}
              onChange={(e) => setVenue((v) => ({ ...v, capacity: e.target.value }))}
            />
          </Field>
          <div>
            <Button
              type="button"
              loading={save.isPending}
              disabled={!venue.name.trim()}
              onClick={() =>
                save.mutate(
                  {
                    body: {
                      name: venue.name.trim(),
                      address: venue.address,
                      city: venue.city,
                      country: "NG",
                      capacity: venue.capacity ? Number(venue.capacity) : null,
                    },
                  },
                  {
                    onSuccess: (v) => (onChange(v.id), setAdding(false), toast.success("Venue saved")),
                    onError: (e) => toast.error(errorMessage(e)),
                  },
                )
              }
            >
              Save venue
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Details({ event }: { event: ManagedEvent }) {
  const update = useUpdateEvent(event.id);
  const toast = useToast();
  const [form, setForm] = useState({
    title: event.title,
    summary: event.summary,
    description: event.description,
    category: event.category,
    format: event.format,
    visibility: event.visibility,
    venue: event.venue?.id ?? null,
    location_details: event.location_details,
    online_url: event.online_url ?? "",
    starts_at: toLocal(event.starts_at),
    ends_at: toLocal(event.ends_at),
    registration_opens_at: toLocal(event.registration_opens_at),
    registration_closes_at: toLocal(event.registration_closes_at),
    capacity: event.capacity ? String(event.capacity) : "",
    waitlist_enabled: event.waitlist_enabled,
    requires_approval: event.requires_approval,
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const body: EventUpdate = {
      ...form,
      online_url: form.online_url || "",
      starts_at: fromLocal(form.starts_at) ?? undefined,
      ends_at: fromLocal(form.ends_at) ?? undefined,
      registration_opens_at: fromLocal(form.registration_opens_at),
      registration_closes_at: fromLocal(form.registration_closes_at),
      capacity: form.capacity ? Number(form.capacity) : null,
    };
    update.mutate(body, { onSuccess: () => toast.success("Saved"), onError: (err) => toast.error(errorMessage(err)) });
  };
  return (
    <Section title="Event details">
      <form className={m.form} onSubmit={onSubmit}>
        <Field label="Title">
          <Input value={form.title} onChange={set("title")} required />
        </Field>
        <Field label="One-line summary">
          <Input value={form.summary} maxLength={300} onChange={set("summary")} />
        </Field>
        <Field label="Description">
          <Textarea rows={6} value={form.description} onChange={set("description")} />
        </Field>
        <div className={m.formRow}>
          <Field label="Category">
            <Input value={form.category} onChange={set("category")} />
          </Field>
          <Field label="Format">
            <Select value={form.format} onChange={set("format")}>
              <option value="in_person">In person</option>
              <option value="online">Online</option>
              <option value="hybrid">Hybrid</option>
            </Select>
          </Field>
          <Field label="Who can see it">
            <Select value={form.visibility} onChange={set("visibility")}>
              <option value="public">Everyone</option>
              <option value="unlisted">Only people with the link</option>
              <option value="audience">Only the host's members</option>
            </Select>
          </Field>
          <Field label="Starts">
            <Input type="datetime-local" value={form.starts_at} onChange={set("starts_at")} required />
          </Field>
          <Field label="Ends">
            <Input type="datetime-local" value={form.ends_at} onChange={set("ends_at")} required />
          </Field>
          <Field label="Registration opens" optional>
            <Input type="datetime-local" value={form.registration_opens_at} onChange={set("registration_opens_at")} />
          </Field>
          <Field label="Registration closes" optional>
            <Input type="datetime-local" value={form.registration_closes_at} onChange={set("registration_closes_at")} />
          </Field>
          <Field label="Capacity" optional>
            <Input type="number" min={1} value={form.capacity} onChange={set("capacity")} />
          </Field>
        </div>
        {form.format !== "online" && (
          <>
            <VenuePicker value={form.venue} onChange={(venue) => setForm((f) => ({ ...f, venue }))} />
            <Field label="Directions or room" optional>
              <Input value={form.location_details} onChange={set("location_details")} />
            </Field>
          </>
        )}
        {form.format !== "in_person" && (
          <Field label="Online link" hint="Only confirmed attendees see it.">
            <Input type="url" value={form.online_url} onChange={set("online_url")} />
          </Field>
        )}
        <Checkbox
          label="Waitlist when full"
          checked={form.waitlist_enabled}
          onChange={(e) => setForm((f) => ({ ...f, waitlist_enabled: e.target.checked }))}
        />
        <Checkbox
          label="I approve each registration"
          checked={form.requires_approval}
          onChange={(e) => setForm((f) => ({ ...f, requires_approval: e.target.checked }))}
        />
        <div>
          <Button type="submit" loading={update.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Section>
  );
}

function SessionForm({ eventId, session, onDone }: { eventId: string; session?: EventSession; onDone: () => void }) {
  const save = useSaveSession(eventId);
  const [form, setForm] = useState({
    title: session?.title ?? "",
    description: session?.description ?? "",
    location: session?.location ?? "",
    starts_at: toLocal(session?.starts_at),
    ends_at: toLocal(session?.ends_at),
    speakers: Array.isArray(session?.speakers)
      ? (session.speakers as { name: string }[]).map((s) => s.name).join(", ")
      : "",
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  return (
    <form
      className={m.form}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(
          {
            sessionId: session?.id,
            body: {
              title: form.title,
              description: form.description,
              location: form.location,
              starts_at: fromLocal(form.starts_at)!,
              ends_at: fromLocal(form.ends_at)!,
              speakers: form.speakers
                .split(",")
                .map((name) => name.trim())
                .filter(Boolean)
                .map((name) => ({ name })),
            },
          },
          { onSuccess: onDone },
        );
      }}
    >
      <div className={m.formRow}>
        <Field label="Session title">
          <Input value={form.title} onChange={set("title")} required />
        </Field>
        <Field label="Starts">
          <Input type="datetime-local" value={form.starts_at} onChange={set("starts_at")} required />
        </Field>
        <Field label="Ends">
          <Input type="datetime-local" value={form.ends_at} onChange={set("ends_at")} required />
        </Field>
        <Field label="Room" optional>
          <Input value={form.location} onChange={set("location")} />
        </Field>
        <Field label="Speakers" hint="Separate names with commas." optional>
          <Input value={form.speakers} onChange={set("speakers")} />
        </Field>
      </div>
      <Field label="About this session" optional>
        <Textarea value={form.description} onChange={set("description")} />
      </Field>
      {save.isError && <Alert tone="error">{errorMessage(save.error)}</Alert>}
      <div className="cluster">
        <Button type="submit" loading={save.isPending}>
          Save session
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Agenda({ event }: { event: ManagedEvent }) {
  const sessions = useSessions(event.id);
  const remove = useDeleteSession(event.id);
  const [editing, setEditing] = useState<EventSession | "new" | null>(null);
  return (
    <Section
      title="Agenda"
      description="Talks, panels and breaks, shown on the event page."
      actions={
        <Button leading={<Plus size={16} />} onClick={() => setEditing("new")}>
          Add session
        </Button>
      }
    >
      {editing && (
        <SessionForm
          eventId={event.id}
          session={editing === "new" ? undefined : editing}
          onDone={() => setEditing(null)}
        />
      )}
      {sessions.isPending ? (
        <Spinner />
      ) : (
        <ul className={m.list}>
          {sessions.data?.map((s) => (
            <li key={s.id} className={m.item}>
              <div className={m.itemMain}>
                <strong>{s.title}</strong>
                <span className={m.small}>
                  {formatRange(s.starts_at, s.ends_at)}
                  {s.location && ` · ${s.location}`}
                </span>
              </div>
              <div className={m.rowActions}>
                <Button size="sm" variant="secondary" onClick={() => setEditing(s)}>
                  Edit
                </Button>
                <ActionButton variant="danger" run={() => remove.mutateAsync(s.id)} success="Session removed">
                  Remove
                </ActionButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function TicketRow({ eventId, ticket }: { eventId: string; ticket: TicketType }) {
  const update = useUpdateTicketType(eventId);
  const remove = useDeleteTicketType(eventId);
  const toast = useToast();
  const [price, setPrice] = useState(String(ticket.price_minor / 100));
  const [quantity, setQuantity] = useState(ticket.quantity ? String(ticket.quantity) : "");
  return (
    <li className={m.item}>
      <div className={m.itemMain}>
        <strong>{ticket.name}</strong>
        <span className={m.small}>
          {ticket.is_free ? "Free" : formatMoney(ticket.price_minor, ticket.currency)}
          {ticket.remaining != null && ` · ${ticket.remaining} left`}
          {!ticket.is_active && " · off sale"}
        </span>
      </div>
      <div className={m.rowActions}>
        <Input
          aria-label="Price (₦)"
          type="number"
          min={0}
          style={{ width: "7rem" }}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <Input
          aria-label="Quantity"
          type="number"
          min={0}
          placeholder="Unlimited"
          style={{ width: "7rem" }}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <Button
          size="sm"
          variant="secondary"
          loading={update.isPending}
          onClick={() =>
            update.mutate(
              {
                ticketId: ticket.id,
                body: { price_minor: Math.round(Number(price) * 100), quantity: quantity ? Number(quantity) : null },
              },
              { onSuccess: () => toast.success("Ticket updated"), onError: (e) => toast.error(errorMessage(e)) },
            )
          }
        >
          Save
        </Button>
        <ActionButton
          run={() => update.mutateAsync({ ticketId: ticket.id, body: { is_active: !ticket.is_active } })}
          success={ticket.is_active ? "Taken off sale" : "Back on sale"}
        >
          {ticket.is_active ? "Stop selling" : "Sell again"}
        </ActionButton>
        <ActionButton
          variant="danger"
          confirm={`Delete "${ticket.name}"?`}
          run={() => remove.mutateAsync(ticket.id)}
          success="Deleted"
        >
          Delete
        </ActionButton>
      </div>
    </li>
  );
}

function Tickets({ event }: { event: ManagedEvent }) {
  const add = useAddTicketType(event.id);
  const toast = useToast();
  const [form, setForm] = useState({ name: "", price: "", quantity: "" });
  return (
    <Section
      title="Tickets"
      description="Paid tickets are checked out with Paystack; money is released after the event."
    >
      <ul className={m.list}>
        {event.ticket_types.map((t) => (
          <TicketRow key={t.id} eventId={event.id} ticket={t} />
        ))}
      </ul>
      <form
        className="cluster"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate(
            {
              name: form.name.trim(),
              price_minor: form.price ? Math.round(Number(form.price) * 100) : 0,
              currency: "NGN",
              quantity: form.quantity ? Number(form.quantity) : null,
            },
            {
              onSuccess: () => (setForm({ name: "", price: "", quantity: "" }), toast.success("Ticket added")),
              onError: (err) => toast.error(errorMessage(err)),
            },
          );
        }}
      >
        <Field label="New ticket">
          <Input
            placeholder="e.g. VIP"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>
        <Field label="Price (₦)" optional>
          <Input
            type="number"
            min={0}
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
        </Field>
        <Field label="How many" optional>
          <Input
            type="number"
            min={1}
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
          />
        </Field>
        <Button type="submit" loading={add.isPending} disabled={!form.name.trim()}>
          Add ticket
        </Button>
      </form>
    </Section>
  );
}

function Attendees({ event }: { event: ManagedEvent }) {
  const [status, setStatus] = useState("");
  const [checkedIn, setCheckedIn] = useState("");
  const attendees = useAttendees(event.id, { status, checked_in: checkedIn });
  const decide = useDecideRegistration(event.id);
  const toast = useToast();
  return (
    <Section
      title="Attendees"
      actions={
        <Button
          variant="secondary"
          leading={<Download size={16} />}
          onClick={() => downloadAttendees(event.id, event.slug).catch((e) => toast.error(errorMessage(e)))}
        >
          Download CSV
        </Button>
      }
    >
      <div className="cluster">
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Every status</option>
          {["confirmed", "pending_approval", "pending_payment", "waitlisted", "cancelled", "declined"].map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </Select>
        <Select aria-label="Checked in" value={checkedIn} onChange={(e) => setCheckedIn(e.target.value)}>
          <option value="">Checked in or not</option>
          <option value="yes">Checked in</option>
          <option value="no">Not checked in</option>
        </Select>
      </div>
      {attendees.isPending ? (
        <Spinner />
      ) : attendees.isError ? (
        <ErrorState error={attendees.error} />
      ) : attendees.data.results.length === 0 ? (
        <p className="muted">Nobody yet.</p>
      ) : (
        <DataTable
          caption="Attendees"
          rows={attendees.data.results}
          rowKey={(a) => a.id}
          columns={[
            {
              header: "Person",
              cell: (a) => (
                <>
                  {a.user?.handle ? (
                    <Link to={`/u/${a.user.handle}`}>{a.user.display_name}</Link>
                  ) : (
                    (a.user?.display_name ?? "Former member")
                  )}
                  {a.email && <div className={m.small}>{a.email}</div>}
                </>
              ),
            },
            { header: "Ticket", cell: (a) => a.ticket_type?.name ?? "–" },
            { header: "Status", cell: (a) => <StatusBadge status={a.status} /> },
            { header: "Checked in", cell: (a) => (a.checked_in_at ? formatDateTime(a.checked_in_at) : "–") },
            {
              header: <span className="visually-hidden">Actions</span>,
              end: true,
              cell: (a) =>
                a.status === "pending_approval" ? (
                  <div className={m.rowActions}>
                    <ActionButton
                      variant="primary"
                      run={() => decide.mutateAsync({ registrationId: a.id, approve: true })}
                      success="Approved"
                    >
                      Approve
                    </ActionButton>
                    <ActionButton
                      reason="Reason (sent to them)"
                      run={(reason) => decide.mutateAsync({ registrationId: a.id, approve: false, reason })}
                      success="Declined"
                    >
                      Decline
                    </ActionButton>
                  </div>
                ) : null,
            },
          ]}
        />
      )}
    </Section>
  );
}

function CheckIn({ event }: { event: ManagedEvent }) {
  const check = useCheckIn(event.id);
  const [code, setCode] = useState("");
  const [last, setLast] = useState<string | null>(null);
  return (
    <Section
      title={
        <>
          <ScanLine size={18} aria-hidden /> Check-in
        </>
      }
      description="Type or scan the code on each attendee's ticket."
    >
      <form
        className="cluster"
        onSubmit={(e) => {
          e.preventDefault();
          check.mutate(code.trim(), {
            onSuccess: (r) => {
              setLast(
                `${r.attendee?.display_name ?? "Attendee"}${r.ticket_type ? ` (${r.ticket_type})` : ""} checked in`,
              );
              setCode("");
            },
          });
        }}
      >
        <label htmlFor="ticket-code" className="visually-hidden">
          Ticket code
        </label>
        <Input
          id="ticket-code"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Ticket code"
        />
        <Button type="submit" loading={check.isPending} disabled={!code.trim()}>
          Check in
        </Button>
      </form>
      {last && !check.isError && <Alert tone="success">{last}</Alert>}
      {check.isError && <Alert tone="error">{errorMessage(check.error)}</Alert>}
    </Section>
  );
}

function Team({ event }: { event: ManagedEvent }) {
  const organizers = useOrganizers(event.id);
  const add = useAddOrganizer(event.id);
  const remove = useRemoveOrganizer(event.id);
  const transfer = useTransferEvent(event.id);
  const toast = useToast();
  const [role, setRole] = useState<"organizer" | "checkin">("organizer");
  return (
    <Section title="Team" description="Organisers can edit the event; check-in staff can only check people in.">
      <div className={m.formRow}>
        <PersonPicker
          label="Add someone"
          action="Add"
          onPick={(p) =>
            add.mutate(
              { user_id: p.id, role },
              {
                onSuccess: () => toast.success(`${p.display_name} added`),
                onError: (e) => toast.error(errorMessage(e)),
              },
            )
          }
        />
        <Field label="As">
          <Select value={role} onChange={(e) => setRole(e.target.value as "organizer" | "checkin")}>
            <option value="organizer">Organiser</option>
            <option value="checkin">Check-in staff</option>
          </Select>
        </Field>
      </div>
      <ul className={m.list}>
        {organizers.data
          ?.flatMap((o) => (o.user ? [{ ...o, user: o.user }] : []))
          .map((o) => (
            <li key={o.user.id} className={m.item}>
              <div className={m.itemMain}>
                <strong>{o.user.display_name}</strong>
                <span className={m.small}>{humanize(o.role)}</span>
              </div>
              {o.role !== "owner" && (
                <div className={m.rowActions}>
                  <ActionButton
                    confirm={`Hand the event to ${o.user.display_name}? You'll stay as an organiser.`}
                    run={() => transfer.mutateAsync(o.user.id)}
                    success="Ownership transferred"
                  >
                    Make owner
                  </ActionButton>
                  <ActionButton variant="danger" run={() => remove.mutateAsync(o.user.id)} success="Removed">
                    Remove
                  </ActionButton>
                </div>
              )}
            </li>
          ))}
      </ul>
    </Section>
  );
}

function Overview({ event }: { event: ManagedEvent }) {
  const publish = usePublishManagedEvent(event.id);
  const cancel = useCancelEvent(event.id);
  const remove = useDeleteEvent();
  const cover = useEventCover(event.id);
  const navigate = useNavigate();
  const toast = useToast();
  return (
    <>
      <Section title="Status" description={<StatusBadge status={event.status} />}>
        <div className="cluster">
          {event.status === "draft" && (
            <ActionButton variant="primary" run={() => publish.mutateAsync()} success="Your event is live">
              Publish
            </ActionButton>
          )}
          {event.status === "published" && (
            <ActionButton
              variant="danger"
              reason="Why is it cancelled? (sent to everyone registered)"
              run={(reason) => cancel.mutateAsync(reason)}
              success="Event cancelled. Attendees were told and paid tickets are refunded."
            >
              Cancel event
            </ActionButton>
          )}
          <ButtonLink to={`/events/${event.slug}`} variant="secondary">
            View page
          </ButtonLink>
          <ShareMenu title={event.title} path={`/events/${event.slug}`} />
          {event.status === "draft" && (
            <ActionButton
              variant="danger"
              confirm="Delete this draft for good?"
              run={async () => {
                await remove.mutateAsync(event.id);
                navigate("/events/mine");
              }}
            >
              Delete draft
            </ActionButton>
          )}
        </div>
      </Section>
      <Section title="Cover image">
        <div className="cluster">
          <FilePicker
            maxMb={10}
            loading={cover.isPending}
            onPick={(files) =>
              files[0] &&
              cover.mutate(files[0], {
                onSuccess: () => toast.success("Cover updated"),
                onError: (e) => toast.error(errorMessage(e)),
              })
            }
          >
            {event.cover_url ? "Change cover" : "Upload cover"}
          </FilePicker>
          {event.cover_url && (
            <ActionButton variant="ghost" run={() => cover.mutateAsync(null)} success="Cover removed">
              Remove cover
            </ActionButton>
          )}
        </div>
      </Section>
    </>
  );
}

type Tab = "overview" | "details" | "agenda" | "tickets" | "attendees" | "checkin" | "team";

/** /events/manage/:eventId */
export function ManageEventPage() {
  const { eventId } = useParams();
  const event = useManagedEvent(eventId);
  const [tab, setTab] = useState<Tab | null>(null);
  if (event.isPending) return <PageLoader />;
  if (event.isError) return <ErrorState error={event.error} />;
  const e = event.data;
  const role = e.viewer?.role ?? "";
  if (!["owner", "organizer", "checkin"].includes(role)) return <NoAccess />;
  const checkinOnly = role === "checkin";
  const items: { value: Tab; label: string }[] = checkinOnly
    ? [
        { value: "checkin", label: "Check-in" },
        { value: "attendees", label: "Attendees" },
      ]
    : [
        { value: "overview", label: "Overview" },
        { value: "details", label: "Details" },
        { value: "agenda", label: "Agenda" },
        { value: "tickets", label: "Tickets" },
        { value: "attendees", label: "Attendees" },
        { value: "checkin", label: "Check-in" },
        { value: "team", label: "Team" },
      ];
  const current = tab ?? items[0]!.value;
  return (
    <div className="stack">
      <Seo title={`Manage ${e.title}`} noIndex />
      <PageHeader
        eyebrow={<Link to="/events/mine">← Your events</Link>}
        title={e.title}
        description={formatRange(e.starts_at, e.ends_at)}
      />
      <Tabs label="Manage event" value={current} onChange={setTab} items={items} />
      {current === "overview" && <Overview event={e} />}
      {current === "details" && <Details key={e.id} event={e} />}
      {current === "agenda" && <Agenda event={e} />}
      {current === "tickets" && <Tickets event={e} />}
      {current === "attendees" && <Attendees event={e} />}
      {current === "checkin" && <CheckIn event={e} />}
      {current === "team" && <Team event={e} />}
    </div>
  );
}
