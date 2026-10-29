import { Lock, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";

import { errorMessage } from "@/api/errors";
import { useCommunity, useJoinCommunity } from "@/api/queries/communities";
import { useAudiencePosts } from "@/api/queries/social";
import { useAuth } from "@/auth/AuthProvider";
import { Seo } from "@/components/Seo";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageLoader } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import styles from "@/features/content/Browse.module.css";
import { Composer } from "@/features/feed/Composer";
import { PostList } from "@/features/feed/PostList";
import { GistBoard } from "@/features/gist/GistBoard";
import { pluralize } from "@/lib/format";

type Tab = "posts" | "gist" | "about";

export default function CommunityPage() {
  const { communityId } = useParams();
  const { status } = useAuth();
  const community = useCommunity(communityId);
  const join = useJoinCommunity();
  const toast = useToast();
  const [params] = useSearchParams();
  const initial = params.get("tab");
  const [tab, setTab] = useState<Tab>(initial === "gist" || initial === "about" ? initial : "posts");
  const posts = useAudiencePosts("community", communityId);

  if (community.isPending) return <PageLoader />;
  if (community.isError) return <ErrorState error={community.error} onRetry={() => void community.refetch()} />;

  const c = community.data;
  const viewer = (c.viewer ?? {}) as { role?: string | null; status?: string | null };
  const member = viewer.status === "active";
  const pending = viewer.status === "pending";
  const rules = Array.isArray(c.rules) ? (c.rules as string[]) : [];

  const toggle = () =>
    join.mutate(
      { id: c.id, member },
      {
        onSuccess: () =>
          toast.success(
            member ? `You left ${c.name}` : c.privacy === "public" ? `Welcome to ${c.name}!` : "Request sent",
          ),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  return (
    <div>
      <Seo title={c.name} description={c.description || `${c.name} on GistLoop`} />
      <Card padded={false} className={styles.detailHero}>
        <div className={styles.detailHead}>
          <div className={styles.communityHead}>
            <span
              className={styles.communityIcon}
              aria-hidden
              style={{ width: "4rem", height: "4rem", fontSize: "var(--text-2xl)" }}
            >
              {c.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="stack" style={{ "--stack-gap": "var(--space-1)" } as React.CSSProperties}>
              <h1 className={styles.detailTitle}>{c.name}</h1>
              <div className="cluster" style={{ "--cluster-gap": "var(--space-2)" } as React.CSSProperties}>
                <span className="muted">
                  <Users size={14} aria-hidden style={{ display: "inline", verticalAlign: "-2px" }} />{" "}
                  {pluralize(c.member_count, "member")}
                </span>
                {c.is_official && (
                  <Badge tone="primary">
                    <ShieldCheck size={12} aria-hidden /> Official
                  </Badge>
                )}
                {c.privacy !== "public" && (
                  <Badge>
                    <Lock size={12} aria-hidden /> {c.privacy === "private" ? "Private" : "Approval needed"}
                  </Badge>
                )}
                {viewer.role && viewer.role !== "member" && <Badge tone="accent">{viewer.role}</Badge>}
              </div>
            </div>
          </div>
          {status === "signed-in" ? (
            <Button
              variant={member ? "secondary" : "primary"}
              loading={join.isPending}
              disabled={pending}
              onClick={toggle}
            >
              {member
                ? "Leave"
                : pending
                  ? "Request pending"
                  : c.privacy === "public"
                    ? "Join community"
                    : "Ask to join"}
            </Button>
          ) : (
            <ButtonLink to={`/login?next=/c/${c.id}`}>Sign in to join</ButtonLink>
          )}
        </div>
        {c.description && (
          <p className="muted" style={{ padding: "0 var(--space-6) var(--space-5)" }}>
            {c.description}
          </p>
        )}
      </Card>

      <div style={{ marginTop: "var(--space-5)" }}>
        <Tabs
          label="Community sections"
          value={tab}
          onChange={setTab}
          items={[
            { value: "posts", label: "Posts" },
            { value: "gist", label: "Anonymous gist" },
            { value: "about", label: "About" },
          ]}
        />
      </div>

      <div style={{ marginTop: "var(--space-5)" }} className="stack">
        {tab === "posts" && (
          <>
            {member && <Composer audience={{ type: "community", id: c.id, name: c.name }} />}
            <PostList
              query={posts}
              empty={{
                title: "No posts yet",
                body: member ? "Start the first conversation." : "Join to start the conversation.",
              }}
            />
          </>
        )}
        {tab === "gist" &&
          (status !== "signed-in" ? (
            <Card>
              <p>
                <Link to={`/login?next=/c/${c.id}`}>Sign in</Link> and join {c.name} to read and share anonymous gist.
              </p>
            </Card>
          ) : member ? (
            <GistBoard communityId={c.id} canPost={member} />
          ) : (
            <Card>
              <p>Anonymous gist is for members only. Join {c.name} to read and share.</p>
            </Card>
          ))}
        {tab === "about" && (
          <Card>
            <h2 style={{ fontSize: "var(--text-lg)" }}>About {c.name}</h2>
            <p className="muted" style={{ marginTop: "var(--space-2)" }}>
              {c.description || "No description yet."}
            </p>
            <h3 style={{ fontSize: "var(--text-base)", marginTop: "var(--space-5)" }}>Community rules</h3>
            {rules.length ? (
              <ol style={{ paddingLeft: "1.2em", marginTop: "var(--space-2)" }}>
                {rules.map((rule, i) => (
                  <li key={i}>{rule}</li>
                ))}
              </ol>
            ) : (
              <p className="muted" style={{ marginTop: "var(--space-2)" }}>
                This community follows the <Link to="/guidelines">GistLoop community guidelines</Link>.
              </p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
