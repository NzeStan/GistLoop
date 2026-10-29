/**
 * Domain types. Most come straight from the generated OpenAPI schema. A few University endpoints
 * describe their responses as free-form objects (posts, feeds, anonymous gist) or as plain arrays
 * when they are paginated at runtime, so those shapes are written out here from the live API.
 */
import type { components } from "./schema";

type S = components["schemas"];

export type Me = S["Me"];
export type UserSummary = S["UserSummary"];
export type PublicProfile = S["PublicProfile"];
export type SocialProfile = S["SocialProfile"];
export type Comment = S["Comment"];
export type Community = S["Community"];
export type EventSummary = S["EventsEventList"];
export type EventDetail = S["EventsEvent"];
export type EventRegistration = S["EventsMyRegistration"];
export type TicketType = S["EventsTicketType"];
export type Listing = S["MarketListing"];
export type MarketCategory = S["MarketCategory"];
export type MarketOrder = S["MarketOrder"];
export type Podcast = S["PodcastShow"];
export type Episode = S["PodcastEpisode"];
export type Notification = S["Notification"];
export type NotificationCounts = S["NotificationCounts"];
export type TrendingItem = S["TrendingItem"];
export type SearchResult = S["SearchResult"];
export type SearchPerson = S["SearchPerson"];
export type Session = S["Session"];
export type PrivacySettings = S["PrivacySettings"];
export type SocialVisibility = S["SocialVisibilityEnum"];
export type ContactTopic = S["SiteTopic"];

/** Page-number pagination (most lists). */
export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Cursor pagination (feeds, timelines, notifications). */
export interface CursorPage<T> {
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Offset pagination (ranked feeds such as "trending"). */
export interface OffsetPage<T> {
  offset: number;
  limit: number;
  results: T[];
}

export interface PostMedia {
  id: string;
  url: string;
  mime_type: string;
  size: number;
  width: number | null;
  height: number | null;
  alt_text: string;
}

export interface PollOption {
  id: string;
  text: string;
  vote_count: number;
  voted: boolean;
}

export interface Poll {
  id: string;
  allows_multiple: boolean;
  closes_at: string | null;
  closed: boolean;
  total_votes: number;
  options: PollOption[];
}

export interface Post {
  id: string;
  author: UserSummary;
  body: string;
  visibility: SocialVisibility;
  audience: { type: string; id: string } | null;
  hashtags: string[];
  mentions: { id: string; handle: string | null }[];
  links: string[];
  media: PostMedia[];
  poll: Poll | null;
  repost_of: (Partial<Post> & { id: string; unavailable?: boolean }) | null;
  is_repost: boolean;
  location: string | null;
  comments_enabled: boolean;
  counts: { reactions: number; comments: number; reposts: number };
  viewer: { reaction: string | null; bookmarked: boolean; reposted: boolean; is_author: boolean };
  created_at: string;
  edited_at: string | null;
  status?: string;
  moderation_reason?: string | null;
}

export interface AnonymousPost {
  id: string;
  author: { anonymous: true };
  body: string;
  visibility: string;
  audience: { type: string; id: string } | null;
  comments_enabled: boolean;
  counts: { reactions: number; comments: number };
  viewer: { reaction: string | null; is_author: boolean };
  created_at: string;
  status?: string;
  moderation_reason?: string | null;
}

export interface AnonymousComment {
  id: string;
  post: string;
  author: { anonymous: true; pseudonym: string; is_op: boolean };
  body: string;
  viewer: { is_author: boolean };
  created_at: string;
}

export interface MyCommunity {
  community: Community;
  role: string;
  status: string;
  joined_at: string;
}

export interface Hashtag {
  name: string;
  posts_count: number;
}

/** `PublicProfile.extras`, contributed by the installed modules. */
export interface ProfileExtras {
  social?: {
    bio: string;
    website: string;
    followers_count: number;
    following_count: number;
    posts_count: number;
    requires_follow_approval: boolean;
    /** Present when a signed-in viewer looks at someone else's profile. */
    relationship?: { following: "active" | "pending" | null; followed_by: boolean };
  };
  communities?: { id: string; name: string; slug: string; role: string }[];
  seller?: { store_name: string; rating: number | null; sales_count: number };
  institutions?: unknown[];
}

/** Lists may arrive paginated or (for small collections) as plain arrays. */
export function asPage<T>(data: unknown): Page<T> {
  if (Array.isArray(data)) return { count: data.length, next: null, previous: null, results: data as T[] };
  const page = data as Partial<Page<T>>;
  return {
    count: page.count ?? page.results?.length ?? 0,
    next: page.next ?? null,
    previous: page.previous ?? null,
    results: page.results ?? [],
  };
}

/** The `cursor` (or `page`) query value from a pagination link. */
export function nextParam(url: string | null, name: "cursor" | "page"): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url, window.location.origin).searchParams.get(name) ?? undefined;
  } catch {
    return undefined;
  }
}
