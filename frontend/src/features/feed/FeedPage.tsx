import { useState } from "react";

import { type FeedName, useFeed } from "@/api/queries/social";
import { ButtonLink } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { Seo } from "@/components/Seo";
import { Sponsored } from "@/features/promotions/Sponsored";

import { Composer } from "./Composer";
import { PostList } from "./PostList";

const TABS: { value: FeedName; label: string }[] = [
  { value: "home", label: "Following" },
  { value: "explore", label: "Latest" },
  { value: "trending", label: "Trending" },
];

export default function FeedPage() {
  const [tab, setTab] = useState<FeedName>("home");
  const feed = useFeed(tab);
  return (
    <div className="stack" style={{ "--stack-gap": "var(--space-5)" } as React.CSSProperties}>
      <Seo title="Home" noIndex />
      <h1 className="visually-hidden">Your feed</h1>
      <Composer />
      <Tabs label="Feeds" value={tab} onChange={setTab} items={TABS} />
      <Sponsored placement="feed" />
      <PostList
        query={feed}
        empty={
          tab === "home"
            ? {
                title: "Your feed is quiet",
                body: "Follow people and join communities to fill it with conversations.",
                action: <ButtonLink to="/communities">Find communities</ButtonLink>,
              }
            : { title: "No posts yet", body: "Be the first to start the conversation." }
        }
      />
    </div>
  );
}
