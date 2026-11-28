import { UserPlus, Users } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";

import { useProfile } from "@/api/queries/account";
import {
  type Relation,
  useAnswerFollowRequest,
  useFollowRequests,
  usePeople,
  useRelationList,
  useRemoveFollower,
  useSetRelation,
} from "@/api/queries/relationships";
import type { UserSummary } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { LoadMore } from "@/components/LoadMore";
import m from "@/components/Manage.module.css";
import { ActionButton, Section } from "@/components/Manage";
import { PageHeader } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { PageLoader, Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { timeAgo } from "@/lib/format";

export function PersonRow({ person, children }: { person: UserSummary; children?: React.ReactNode }) {
  return (
    <li className={m.item}>
      <span className="cluster" style={{ "--cluster-gap": "var(--space-3)", flex: "1 1 14rem" } as React.CSSProperties}>
        <Avatar name={person.display_name} seed={person.id} src={person.avatar_url} />
        <span className={m.itemMain}>
          {person.handle ? (
            <Link to={`/u/${person.handle}`}>{person.display_name}</Link>
          ) : (
            <strong>{person.display_name}</strong>
          )}
          {person.handle && <span className={m.small}>@{person.handle}</span>}
        </span>
      </span>
      {children && <div className={m.rowActions}>{children}</div>}
    </li>
  );
}

/** /u/:handle/followers and /u/:handle/following */
export function PeoplePage({ which }: { which: "followers" | "following" }) {
  const { handle } = useParams();
  const navigate = useNavigate();
  const { me } = useAuth();
  const profile = useProfile(handle);
  const people = usePeople(profile.data?.id, which);
  const remove = useRemoveFollower();
  if (profile.isPending) return <PageLoader />;
  if (profile.isError) return <ErrorState error={profile.error} />;
  const p = profile.data;
  const mine = me?.id === p.id;
  const rows = people.data?.pages.flatMap((page) => page.results) ?? [];
  return (
    <div className="stack">
      <Seo title={`${p.display_name}: ${which}`} noIndex />
      <PageHeader eyebrow={<Link to={`/u/${p.handle}`}>← {p.display_name}</Link>} title={p.display_name} />
      <Tabs
        label="People"
        value={which}
        onChange={(v) => navigate(`/u/${p.handle}/${v}`)}
        items={[
          { value: "followers", label: "Followers" },
          { value: "following", label: "Following" },
        ]}
      />
      <Card>
        {people.isPending ? (
          <Spinner />
        ) : people.isError ? (
          <ErrorState error={people.error} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title={which === "followers" ? "No followers yet" : "Not following anyone yet"} />
        ) : (
          <ul className={m.list}>
            {rows.map((person) => (
              <PersonRow key={person.id} person={person}>
                {mine && which === "followers" && (
                  <ActionButton
                    confirm={`Remove ${person.display_name} from your followers? They won't be told.`}
                    run={() => remove.mutateAsync(person.id)}
                    success="Removed"
                  >
                    Remove
                  </ActionButton>
                )}
              </PersonRow>
            ))}
          </ul>
        )}
        <LoadMore
          hasMore={people.hasNextPage}
          loading={people.isFetchingNextPage}
          onLoad={() => void people.fetchNextPage()}
        />
      </Card>
    </div>
  );
}

export const FollowersPage = () => <PeoplePage which="followers" />;
export const FollowingPage = () => <PeoplePage which="following" />;

/** Follow requests for a private account (shown in settings and from notifications). */
export function FollowRequests() {
  const requests = useFollowRequests();
  const answer = useAnswerFollowRequest();
  return (
    <Section
      title="Follow requests"
      description="Your account asks before people can follow you (Privacy settings). Approve or decline them here."
    >
      {requests.isPending ? (
        <Spinner />
      ) : requests.isError ? (
        <ErrorState error={requests.error} />
      ) : requests.data.length === 0 ? (
        <EmptyState icon={UserPlus} title="No requests" />
      ) : (
        <ul className={m.list}>
          {requests.data.map((r) => (
            <PersonRow key={r.id} person={r.user as UserSummary}>
              <span className={m.small}>{timeAgo(r.created_at)}</span>
              <ActionButton
                variant="primary"
                run={() => answer.mutateAsync({ followId: r.id, approve: true })}
                success="Approved"
              >
                Approve
              </ActionButton>
              <ActionButton run={() => answer.mutateAsync({ followId: r.id, approve: false })} success="Declined">
                Decline
              </ActionButton>
            </PersonRow>
          ))}
        </ul>
      )}
    </Section>
  );
}

const RELATION_COPY: Record<Relation, { title: string; description: string; undo: string }> = {
  block: { title: "Blocked", description: "They can't see or interact with you.", undo: "Unblock" },
  mute: { title: "Muted", description: "Their posts are hidden from your feeds.", undo: "Unmute" },
  restrict: {
    title: "Restricted",
    description: "Their comments on your posts are only visible to them; messages arrive as requests.",
    undo: "Unrestrict",
  },
};

function RelationSection({ relation }: { relation: Relation }) {
  const list = useRelationList(relation);
  const set = useSetRelation();
  const copy = RELATION_COPY[relation];
  return (
    <Section title={copy.title} description={copy.description}>
      {list.isPending ? (
        <Spinner />
      ) : list.isError ? (
        <ErrorState error={list.error} />
      ) : list.data.length === 0 ? (
        <p className="muted">Nobody.</p>
      ) : (
        <ul className={m.list}>
          {list.data.map((person) => (
            <PersonRow key={person.id} person={person}>
              <ActionButton run={() => set.mutateAsync({ userId: person.id, relation, on: false })} success="Done">
                {copy.undo}
              </ActionButton>
            </PersonRow>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** /settings/people: follow requests and the people you've blocked, muted or restricted. */
export function PeopleSettings() {
  return (
    <>
      <FollowRequests />
      <RelationSection relation="block" />
      <RelationSection relation="mute" />
      <RelationSection relation="restrict" />
    </>
  );
}
