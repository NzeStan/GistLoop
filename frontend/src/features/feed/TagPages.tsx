import { Hash } from "lucide-react";
import { useParams } from "react-router";

import { useBookmarks, useHashtagPosts } from "@/api/queries/social";
import { PageHeader } from "@/components/PageHeader";
import { Seo } from "@/components/Seo";
import { ButtonLink } from "@/components/ui/Button";

import { PostList } from "./PostList";

export function HashtagPage() {
  const { tag = "" } = useParams();
  const posts = useHashtagPosts(tag);
  return (
    <div>
      <Seo title={`#${tag}`} description={`Conversations about #${tag} on GistLoop.`} />
      <PageHeader
        eyebrow={
          <>
            <Hash size={14} aria-hidden /> Hashtag
          </>
        }
        title={`#${tag}`}
      />
      <PostList
        query={posts}
        empty={{ title: `No posts with #${tag} yet`, body: "Start the conversation with a post." }}
      />
    </div>
  );
}

export function BookmarksPage() {
  const posts = useBookmarks();
  return (
    <div>
      <Seo title="Bookmarks" noIndex />
      <PageHeader title="Bookmarks" description="Posts you've saved for later. Only you can see these." />
      <PostList
        query={posts}
        empty={{
          title: "No bookmarks yet",
          body: "Tap the bookmark icon on any post to save it here.",
          action: <ButtonLink to="/feed">Browse the feed</ButtonLink>,
        }}
      />
    </div>
  );
}
