import { useQuery } from "@tanstack/react-query";
import { EyeOff, GraduationCap, MessageCircleQuestion } from "lucide-react";
import { Link, useParams } from "react-router";

import { useMyCommunities } from "@/api/queries/communities";
import { useGistShareStatus } from "@/api/queries/gist";
import { useMyMemberships } from "@/api/queries/institutions";
import { request } from "@/api/http";
import type { AnonymousPost } from "@/api/types";
import { PageHeader } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageLoader, Spinner } from "@/components/ui/Spinner";
import { EmptyState, ErrorState } from "@/components/ui/States";
import styles from "@/features/content/Browse.module.css";

import { GistCard, GistSafetyNote } from "./GistBoard";

function BoardTile({ to, name, hint, icon }: { to: string; name: string; hint: string; icon?: React.ReactNode }) {
  return (
    <Card padded={false} interactive>
      <Link to={to} className={styles.tile}>
        <div className={styles.tileBody}>
          <div className={styles.communityHead}>
            <span className={styles.communityIcon} aria-hidden>
              {icon ?? name.slice(0, 1).toUpperCase()}
            </span>
            <h2 className={styles.tileTitle}>{name}</h2>
          </div>
          <p className={styles.tileText}>{hint}</p>
        </div>
      </Link>
    </Card>
  );
}

/** /gist: the anonymous boards of your communities and your schools, in one place. */
export function GistHubPage() {
  const mine = useMyCommunities();
  const schools = useMyMemberships();
  const verified = (schools.data ?? []).filter((m) => m.status === "verified");
  const loading = mine.isPending || schools.isPending;
  const empty = !loading && (mine.data?.length ?? 0) === 0 && verified.length === 0;
  return (
    <div className="stack">
      <Seo title="Anonymous gist" noIndex />
      <PageHeader
        eyebrow={
          <>
            <EyeOff size={14} aria-hidden /> Anonymous gist
          </>
        }
        title="Say it without saying who"
        description="Every community and every school has an anonymous board for its members. Ask the awkward question, share the confession, warn about the scam."
      />
      <GistSafetyNote />
      {loading ? (
        <Spinner />
      ) : mine.isError ? (
        <ErrorState error={mine.error} onRetry={() => void mine.refetch()} />
      ) : empty ? (
        <EmptyState
          icon={MessageCircleQuestion}
          title="Join a community or your school first"
          action={
            <div className="cluster">
              <ButtonLink to="/communities">Browse communities</ButtonLink>
              <ButtonLink to="/settings/schools" variant="secondary">
                Add your school
              </ButtonLink>
            </div>
          }
        >
          Anonymous gist happens inside communities and schools, so only members can read it.
        </EmptyState>
      ) : (
        <div className={styles.grid}>
          {verified.map((m) => (
            <BoardTile
              key={m.id}
              to={`/schools/${m.institution.id}?tab=gist`}
              name={m.institution.short_name || m.institution.name}
              hint="Your school's anonymous board →"
              icon={<GraduationCap size={18} />}
            />
          ))}
          {mine.data?.map(({ community }) => (
            <BoardTile
              key={community.id}
              to={`/c/${community.id}?tab=gist`}
              name={community.name}
              hint="Open the anonymous board →"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function backLink(post: AnonymousPost): { to: string; label: string } | null {
  if (!post.audience) return null;
  if (post.audience.type === "community")
    return { to: `/c/${post.audience.id}?tab=gist`, label: "Back to the community" };
  if (post.audience.type === "institution")
    return { to: `/schools/${post.audience.id}?tab=gist`, label: "Back to the school" };
  return { to: "/gist", label: "Back to gist" };
}

/** /gist/p/:postId: a single anonymous post (members of its audience only). */
export function GistPostPage() {
  const { postId } = useParams();
  const post = useQuery({
    queryKey: ["gistPost", postId],
    enabled: Boolean(postId),
    queryFn: () => request<AnonymousPost>("GET", `/api/v1/anonymous/posts/${postId}/`),
  });
  const share = useGistShareStatus(post.data?.viewer.is_author ? [post.data.id] : []);
  if (post.isPending) return <PageLoader />;
  if (post.isError) return <ErrorState error={post.error} />;
  const back = backLink(post.data);
  return (
    <div className="stack">
      <Seo title="Anonymous gist" noIndex />
      {back && (
        <p>
          <Link to={back.to}>← {back.label}</Link>
        </p>
      )}
      <GistCard post={post.data} expanded shareStatus={share.data?.[post.data.id]} />
    </div>
  );
}
