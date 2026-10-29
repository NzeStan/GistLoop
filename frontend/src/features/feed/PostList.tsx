import type { InfiniteData, UseInfiniteQueryResult } from "@tanstack/react-query";
import { MessagesSquare } from "lucide-react";
import type { ReactNode } from "react";

import type { Post } from "@/api/types";
import { LoadMore } from "@/components/LoadMore";
import { EmptyState, ErrorState } from "@/components/ui/States";

import { PostCard, PostSkeleton } from "./PostCard";
import styles from "./Post.module.css";

type Query = UseInfiniteQueryResult<InfiniteData<{ results: Post[] }>, Error>;

export function PostList({
  query,
  empty,
}: {
  query: Query;
  empty?: { title: string; body?: ReactNode; action?: ReactNode };
}) {
  if (query.isPending) {
    return (
      <div className={styles.list} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <PostSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const posts = query.data.pages.flatMap((page) => page.results);
  if (posts.length === 0) {
    return (
      <EmptyState icon={MessagesSquare} title={empty?.title ?? "Nothing here yet"} action={empty?.action}>
        {empty?.body ?? "When there's something to see, it'll show up here."}
      </EmptyState>
    );
  }
  return (
    <div className={styles.list}>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      <LoadMore
        hasMore={query.hasNextPage}
        loading={query.isFetchingNextPage}
        onLoad={() => void query.fetchNextPage()}
      />
    </div>
  );
}
