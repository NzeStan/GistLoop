import { CalendarDays, MapPin, Ticket, Video } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { type EventFilters, useEvents, useMyRegistrations } from "@/api/queries/events";
import type { EventSummary } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { Seo } from "@/components/Seo";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox, Input, Select } from "@/components/ui/Form";
import { Img } from "@/components/ui/Img";
import { Skeleton } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { brand } from "@/config/brand";
import styles from "@/features/content/Browse.module.css";
import { BrowseShell } from "@/features/content/BrowseShell";
import { Sponsored } from "@/features/promotions/Sponsored";
import { useDebounced } from "@/lib/hooks";
import { formatDate, formatTime, humanize } from "@/lib/format";

export function EventCard({ event }: { event: EventSummary }) {
  const registered = event.viewer?.registration_status;
  return (
    <Card padded={false} interactive>
      <Link to={`/events/${event.slug}`} className={styles.tile}>
        <Img src={event.cover_url} fallback={brand.assets.fallbacks.eventCover} alt="" className={styles.tileMedia} />
        <div className={styles.tileBody}>
          <div className="cluster" style={{ "--cluster-gap": "var(--space-2)" } as React.CSSProperties}>
            <Badge tone="primary">{formatDate(event.starts_at, event.timezone)}</Badge>
            {event.is_free ? <Badge tone="success">Free</Badge> : <Badge>Paid</Badge>}
            {registered && (
              <Badge tone="accent">{registered === "confirmed" ? "You're going" : humanize(registered)}</Badge>
            )}
          </div>
          <h3 className={styles.tileTitle}>{event.title}</h3>
          <p className={styles.tileText}>{event.summary}</p>
          <div className={styles.tileMeta}>
            <span className={styles.metaItem}>
              <CalendarDays size={15} aria-hidden /> {formatTime(event.starts_at, event.timezone)}
            </span>
            <span className={styles.metaItem}>
              {event.format === "online" ? <Video size={15} aria-hidden /> : <MapPin size={15} aria-hidden />}
              {event.venue?.name ?? humanize(event.format)}
            </span>
            {event.spots_left !== null && event.spots_left <= 20 && (
              <span className={styles.metaItem}>
                <Ticket size={15} aria-hidden /> {event.spots_left === 0 ? "Full" : `${event.spots_left} left`}
              </span>
            )}
          </div>
        </div>
      </Link>
    </Card>
  );
}

export default function EventsPage() {
  const { status } = useAuth();
  const [q, setQ] = useState("");
  const [format, setFormat] = useState<EventFilters["format"] | "">("");
  const [free, setFree] = useState(false);
  const filters: EventFilters = { q: useDebounced(q), format: format || undefined, free };
  const events = useEvents(filters);
  const mine = useMyRegistrations(status === "signed-in");

  return (
    <BrowseShell
      eyebrow="Events"
      title="What's happening on campus"
      description="Lectures, hackathons, open mics, matches and meetups. RSVP in a tap and never miss what everyone's talking about."
      actions={
        status === "signed-in" ? (
          <div className="cluster">
            <ButtonLink to="/events/tickets" variant="secondary">
              Your tickets
            </ButtonLink>
            <ButtonLink to="/events/new">Create an event</ButtonLink>
          </div>
        ) : undefined
      }
    >
      <Seo title="Events" description="Discover campus events, hackathons, meetups and more on GistLoop." />
      {mine.data && mine.data.length > 0 && (
        <Card style={{ marginBottom: "var(--space-6)" }}>
          <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-3)" }}>Your upcoming events</h2>
          <ul
            className="stack"
            style={{ listStyle: "none", padding: 0, "--stack-gap": "var(--space-2)" } as React.CSSProperties}
          >
            {mine.data.slice(0, 4).map((reg) => (
              <li key={reg.id}>
                <Link to={`/events/${reg.event.slug}`}>{reg.event.title}</Link>
                <span className="muted"> · {formatDate(reg.event.starts_at, reg.event.timezone)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className={styles.toolbar}>
        <label htmlFor="event-search" className="visually-hidden">
          Search events
        </label>
        <Input
          id="event-search"
          type="search"
          placeholder="Search events"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label htmlFor="event-format" className="visually-hidden">
          Format
        </label>
        <Select
          id="event-format"
          value={format}
          onChange={(e) => setFormat(e.target.value as EventFilters["format"] | "")}
        >
          <option value="">Any format</option>
          <option value="in_person">In person</option>
          <option value="online">Online</option>
          <option value="hybrid">Hybrid</option>
        </Select>
        <Checkbox
          label="Free only"
          checked={free}
          onChange={(e) => setFree(e.target.checked)}
          style={{ alignSelf: "center" }}
        />
      </div>
      <Sponsored placement="events" />
      {events.isPending ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height="20rem" radius="var(--radius-lg)" />
          ))}
        </div>
      ) : events.isError ? (
        <ErrorState error={events.error} onRetry={() => void events.refetch()} />
      ) : events.data.results.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No upcoming events found">
          Try different filters, or check back soon.
        </EmptyState>
      ) : (
        <div className={styles.grid}>
          {events.data.results.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </BrowseShell>
  );
}
