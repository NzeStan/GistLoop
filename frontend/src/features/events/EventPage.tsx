import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, CalendarDays, Clock, MapPin, Share2, Ticket, Users, Video } from "lucide-react";
import { useState } from "react";
import { Navigate, useParams } from "react-router";

import { api, unwrap } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { useCancelRegistration, useEvent, useRegisterForEvent } from "@/api/queries/events";
import { startCheckout } from "@/api/queries/payments";
import type { EventDetail } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { Seo } from "@/components/Seo";
import { Badge } from "@/components/ui/Badge";
import { AnchorButton, Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert, Field, Select } from "@/components/ui/Form";
import { Img } from "@/components/ui/Img";
import { PageLoader } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { brand } from "@/config/brand";
import styles from "@/features/content/Browse.module.css";
import { formatDate, formatMoney, formatRange, formatTime, humanize } from "@/lib/format";
import { safeUrl } from "@/lib/links";

function RegistrationPanel({ event }: { event: EventDetail }) {
  const { status } = useAuth();
  const register = useRegisterForEvent(event.slug);
  const cancel = useCancelRegistration(event.slug);
  const toast = useToast();
  const tickets = event.ticket_types.filter((t) => t.is_active && t.on_sale);
  const [ticket, setTicket] = useState(tickets[0]?.id ?? "");
  const state = event.viewer?.registration_status;
  const [now] = useState(() => Date.now());
  const [paying, setPaying] = useState(false);
  const pay = async (registrationId: string) => {
    setPaying(true);
    try {
      await startCheckout("events.registration", registrationId);
    } catch (error) {
      setPaying(false);
      toast.error(errorMessage(error));
    }
  };
  const ended = Date.parse(event.ends_at) < now;
  const cancelled = event.status === "cancelled";

  if (cancelled) return <Alert tone="warning">This event was cancelled. {event.cancellation_reason}</Alert>;
  if (ended) return <Alert tone="info">This event has ended.</Alert>;
  if (status !== "signed-in") {
    return (
      <ButtonLink to={`/login?next=/events/${event.slug}`} block size="lg">
        Sign in to register
      </ButtonLink>
    );
  }

  if (state === "pending_payment" && event.viewer?.registration_id) {
    const registrationId = event.viewer.registration_id;
    return (
      <div className="stack">
        <Alert tone="warning">Your seat is held while you pay. Finish paying to get your ticket.</Alert>
        <Button size="lg" block loading={paying} onClick={() => void pay(registrationId)}>
          Pay for your ticket
        </Button>
        <Button
          variant="ghost"
          block
          loading={cancel.isPending}
          onClick={() => cancel.mutate(event.id, { onError: (e) => toast.error(errorMessage(e)) })}
        >
          Release my seat
        </Button>
      </div>
    );
  }

  if (state && state !== "cancelled" && state !== "declined" && state !== "expired") {
    return (
      <div className="stack">
        <Alert tone="success">
          {state === "confirmed"
            ? "You're going! We'll remind you before it starts."
            : state === "waitlisted"
              ? "You're on the waitlist. We'll let you know if a spot opens up."
              : state === "pending"
                ? "Your registration is waiting for the organisers' approval."
                : `Registration: ${humanize(state)}`}
        </Alert>
        {safeUrl(event.online_url) && state === "confirmed" && (
          <AnchorButton
            href={safeUrl(event.online_url)!}
            target="_blank"
            rel="noopener noreferrer"
            leading={<Video size={16} />}
            block
          >
            Join online
          </AnchorButton>
        )}
        <Button
          variant="secondary"
          block
          loading={cancel.isPending}
          onClick={() =>
            cancel.mutate(event.id, {
              onSuccess: () => toast.success("Registration cancelled"),
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
        >
          Cancel registration
        </Button>
      </div>
    );
  }

  const full = event.spots_left === 0 && !event.waitlist_enabled;
  const selected = tickets.find((t) => t.id === ticket);
  const selectedPaid = selected && !selected.is_free ? selected : undefined;
  return (
    <div className="stack">
      {tickets.length > 1 && (
        <Field label="Ticket">
          <Select value={ticket} onChange={(e) => setTicket(e.target.value)}>
            {tickets.map((t) => (
              <option key={t.id} value={t.id} disabled={t.remaining === 0}>
                {t.name} · {t.is_free ? "Free" : formatMoney(t.price_minor, t.currency)}
                {t.remaining === 0 ? " (sold out)" : ""}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {register.isError && <Alert tone="error">{errorMessage(register.error)}</Alert>}
      <Button
        size="lg"
        block
        disabled={full}
        loading={register.isPending || paying}
        onClick={() =>
          register.mutate(
            { eventId: event.id, ticketType: ticket || undefined },
            {
              onSuccess: (r) => {
                if (r.status === "pending_payment") void pay(r.id);
                else toast.success(r.status === "waitlisted" ? "You're on the waitlist" : "You're registered!");
              },
            },
          )
        }
      >
        {full
          ? "Sold out"
          : event.spots_left === 0
            ? "Join the waitlist"
            : event.requires_approval
              ? "Request a spot"
              : selectedPaid
                ? `Buy ticket · ${formatMoney(selectedPaid.price_minor, selectedPaid.currency)}`
                : "Register"}
      </Button>
    </div>
  );
}

function EventView({ event }: { event: EventDetail }) {
  const toast = useToast();
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: event.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* dismissed */
    }
  };
  const where = event.venue
    ? [event.venue.name, event.venue.address, event.venue.city].filter(Boolean).join(", ")
    : event.location_details || humanize(event.format);

  return (
    <article>
      <Seo title={event.title} description={event.summary} image={event.cover_url ?? undefined} />
      <Card padded={false} className={styles.detailHero}>
        <Img
          src={event.cover_url}
          fallback={brand.assets.fallbacks.eventCover}
          alt=""
          className={styles.detailCover}
          loading="eager"
        />
        <div className={styles.detailHead}>
          <div className="stack" style={{ "--stack-gap": "var(--space-2)" } as React.CSSProperties}>
            <div className="cluster" style={{ "--cluster-gap": "var(--space-2)" } as React.CSSProperties}>
              <Badge tone="primary">{humanize(event.format)}</Badge>
              {event.is_free ? <Badge tone="success">Free</Badge> : <Badge>Paid</Badge>}
              {event.category && <Badge>{humanize(event.category)}</Badge>}
            </div>
            <h1 className={styles.detailTitle}>{event.title}</h1>
            <p className="muted">{event.summary}</p>
          </div>
          <div className="cluster">
            <AnchorButton
              href={`/api/v1/events/${event.id}/calendar.ics`}
              download
              variant="secondary"
              leading={<CalendarPlus size={16} />}
            >
              Add to calendar
            </AnchorButton>
            <Button variant="ghost" icon aria-label="Share event" onClick={share}>
              <Share2 size={18} />
            </Button>
          </div>
        </div>
      </Card>

      <div className={styles.detailLayout}>
        <Card>
          <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-3)" }}>About this event</h2>
          <p className="pre-wrap">{event.description || event.summary}</p>
          {event.sessions.length > 0 && (
            <>
              <h3 style={{ fontSize: "var(--text-lg)", margin: "var(--space-6) 0 var(--space-3)" }}>Schedule</h3>
              <ul className={styles.facts}>
                {event.sessions.map((s) => (
                  <li key={s.id}>
                    <Clock size={16} aria-hidden />
                    <span>
                      <strong>{formatTime(s.starts_at, event.timezone)}</strong> · {s.title}
                      {s.location && <span className="muted"> · {s.location}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
        <Card>
          <ul className={styles.facts} style={{ marginBottom: "var(--space-5)" }}>
            <li>
              <CalendarDays size={18} aria-hidden />
              <span>{formatRange(event.starts_at, event.ends_at, event.timezone)}</span>
            </li>
            <li>
              {event.format === "online" ? <Video size={18} aria-hidden /> : <MapPin size={18} aria-hidden />}
              <span>{where}</span>
            </li>
            {event.capacity !== null && (
              <li>
                <Users size={18} aria-hidden />
                <span>
                  {event.spots_left === 0
                    ? "Fully booked"
                    : `${event.spots_left ?? event.capacity} of ${event.capacity} spots left`}
                </span>
              </li>
            )}
            {event.ticket_types.length > 0 && (
              <li>
                <Ticket size={18} aria-hidden />
                <span>
                  {event.ticket_types
                    .map((t) => `${t.name}: ${t.is_free ? "Free" : formatMoney(t.price_minor, t.currency)}`)
                    .join(" · ")}
                </span>
              </li>
            )}
            {event.registration_closes_at && (
              <li>
                <Clock size={18} aria-hidden />
                <span>Registration closes {formatDate(event.registration_closes_at, event.timezone)}</span>
              </li>
            )}
          </ul>
          <RegistrationPanel event={event} />
        </Card>
      </div>
    </article>
  );
}

/** /events/:slug */
export default function EventPage() {
  const { slug } = useParams();
  const event = useEvent(slug);
  if (event.isPending) return <PageLoader />;
  if (event.isError) return <ErrorState error={event.error} onRetry={() => void event.refetch()} />;
  return <EventView event={event.data} />;
}

/** /events/id/:eventId (links from trending, search and notifications) → canonical slug URL. */
export function EventByIdPage() {
  const { eventId } = useParams();
  const event = useQuery({
    queryKey: ["eventById", eventId],
    enabled: Boolean(eventId),
    queryFn: () => unwrap(api.GET("/api/v1/events/{event_id}/", { params: { path: { event_id: eventId! } } })),
  });
  if (event.isPending) return <PageLoader />;
  if (event.isError) return <ErrorState error={event.error} />;
  return <Navigate to={`/events/${event.data.slug}`} replace />;
}
