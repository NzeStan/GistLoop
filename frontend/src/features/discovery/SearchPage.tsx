import { Search as SearchIcon, UserRound } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { usePeopleSearch, useSearch } from "@/api/queries/discovery";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Form";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { CONTENT_LABELS, contentHref } from "@/lib/links";

import styles from "./Discovery.module.css";

type Tab =
  "all" | "social.post" | "community.community" | "events.event" | "marketplace.listing" | "podcast.episode" | "people";

const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "Top" },
  { value: "social.post", label: "Posts" },
  { value: "community.community", label: "Communities" },
  { value: "events.event", label: "Events" },
  { value: "marketplace.listing", label: "Listings" },
  { value: "podcast.episode", label: "Podcasts" },
  { value: "people", label: "People" },
];

export default function SearchPage() {
  const { status } = useAuth();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const tab = (params.get("tab") as Tab | null) ?? "all";
  const [draft, setDraft] = useState(q);
  const content = useSearch(tab === "people" ? "" : q, tab === "all" || tab === "people" ? undefined : tab);
  const people = usePeopleSearch(q, tab === "people" && status === "signed-in");

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setParams((prev) => {
      prev.set("q", draft.trim());
      return prev;
    });
  };

  const setTab = (value: Tab) =>
    setParams((prev) => {
      prev.set("tab", value);
      return prev;
    });

  return (
    <div>
      <Seo title={q ? `Search: ${q}` : "Search"} noIndex />
      <PageHeader title="Search" description="Find posts, communities, events, listings, podcasts and people." />
      <form role="search" className={styles.searchBar} onSubmit={onSubmit}>
        <label htmlFor="search-q" className="visually-hidden">
          Search
        </label>
        <Input
          id="search-q"
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Try “hackathon”, “football” or “textbooks”"
          maxLength={100}
        />
        <Button type="submit" leading={<SearchIcon size={16} />}>
          Search
        </Button>
      </form>
      <Tabs label="Result types" value={tab} onChange={setTab} items={TABS} />
      <Card style={{ marginTop: "var(--space-4)" }}>
        {q.trim().length < 2 ? (
          <EmptyState icon={SearchIcon} title="What are you looking for?">
            Type at least two characters to search.
          </EmptyState>
        ) : tab === "people" ? (
          status !== "signed-in" ? (
            <EmptyState icon={UserRound} title="Sign in to find people">
              <Link to={`/login?next=${encodeURIComponent(`/search?q=${q}&tab=people`)}`}>Sign in</Link> to search for
              people by name or handle.
            </EmptyState>
          ) : q.trim().length < 3 ? (
            <p className="muted">Type at least three characters to search for people.</p>
          ) : people.isPending ? (
            <Spinner />
          ) : people.isError ? (
            <ErrorState error={people.error} />
          ) : people.data.length === 0 ? (
            <EmptyState icon={UserRound} title="No one found">
              Try their name or @handle. Email addresses and phone numbers aren't searchable, to protect privacy.
            </EmptyState>
          ) : (
            <ul className={styles.results}>
              {people.data.map((person) => (
                <li key={person.id}>
                  <Link to={person.handle ? `/u/${person.handle}` : "#"} className={styles.result}>
                    <Avatar name={person.display_name} seed={person.id} src={person.avatar_url} />
                    <span>
                      <span className={styles.resultTitle}>{person.display_name}</span>
                      {person.handle && <span className="muted"> @{person.handle}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : content.isPending ? (
          <Spinner />
        ) : content.isError ? (
          <ErrorState error={content.error} onRetry={() => void content.refetch()} />
        ) : content.data.length === 0 ? (
          <EmptyState icon={SearchIcon} title={`No results for “${q}”`}>
            Check the spelling or try a broader term.
          </EmptyState>
        ) : (
          <ul className={styles.results}>
            {content.data.map((result) => {
              const href = contentHref(result.content_type, result.object_id);
              const body = (
                <>
                  <Badge tone="primary">{CONTENT_LABELS[result.content_type] ?? "Result"}</Badge>
                  <span>
                    <span className={styles.resultTitle}>{result.title}</span>
                    {result.snippet && <span className="muted"> — {result.snippet}</span>}
                  </span>
                </>
              );
              return (
                <li key={`${result.content_type}:${result.object_id}`}>
                  {href ? (
                    <Link to={href} className={styles.result}>
                      {body}
                    </Link>
                  ) : (
                    <div className={styles.result}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
