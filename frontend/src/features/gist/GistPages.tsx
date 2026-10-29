import { useQuery } from "@tanstack/react-query";
import { EyeOff, MessageCircleQuestion } from "lucide-react";
import { Link, useParams } from "react-router";

import { useMyCommunities } from "@/api/queries/communities";
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

/** /gist: your communities' anonymous boards in one place. */
export function GistHubPage() {
  const mine = useMyCommunities();
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
        description="Every community has an anonymous board for members. Ask the awkward question, share the confession, warn about the scam."
      />
      <GistSafetyNote />
      {mine.isPending ? (
        <Spinner />
      ) : mine.isError ? (
        <ErrorState error={mine.error} onRetry={() => void mine.refetch()} />
      ) : mine.data.length === 0 ? (
        <EmptyState
          icon={MessageCircleQuestion}
          title="Join a community first"
          action={<ButtonLink to="/communities">Browse communities</ButtonLink>}
        >
          Anonymous gist happens inside communities, so only members can read it.
        </EmptyState>
      ) : (
        <div className={styles.grid}>
          {mine.data.map(({ community }) => (
            <Card key={community.id} padded={false} interactive>
              <Link to={`/c/${community.id}?tab=gist`} className={styles.tile}>
                <div className={styles.tileBody}>
                  <div className={styles.communityHead}>
                    <span className={styles.communityIcon} aria-hidden>
                      {community.name.slice(0, 1).toUpperCase()}
                    </span>
                    <h2 className={styles.tileTitle}>{community.name}</h2>
                  </div>
                  <p className={styles.tileText}>Open the anonymous board →</p>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/** /gist/p/:postId: a single anonymous post (members of its community only). */
export function GistPostPage() {
  const { postId } = useParams();
  const post = useQuery({
    queryKey: ["gistPost", postId],
    enabled: Boolean(postId),
    queryFn: () => request<AnonymousPost>("GET", `/api/v1/anonymous/posts/${postId}/`),
  });
  if (post.isPending) return <PageLoader />;
  if (post.isError) return <ErrorState error={post.error} />;
  const communityId = post.data.audience?.id ?? "";
  return (
    <div className="stack">
      <Seo title="Anonymous gist" noIndex />
      {communityId && (
        <p>
          <Link to={`/c/${communityId}`}>← Back to the community</Link>
        </p>
      )}
      <GistCard post={post.data} communityId={communityId} expanded />
    </div>
  );
}
