/**
 * Every page renders through the real router against realistic API responses (shapes captured from
 * the live GistLoop API), as a visitor and as a signed-in member. Catches runtime crashes in pages
 * that type checks can't.
 */
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetAuthForTests } from "@/api/auth";

import { AppProviders, createQueryClient } from "./providers";
import { routes } from "./router";

const user = { id: "u1", handle: "amaka", display_name: "Amaka Eze" };
const post = {
  id: "p1",
  author: { id: "u2", handle: "tunde", display_name: "Tunde Bakare" },
  body: "Hackathon this weekend! #tech",
  visibility: "public",
  audience: null,
  hashtags: ["tech"],
  mentions: [],
  links: [],
  media: [],
  poll: {
    id: "poll1",
    allows_multiple: false,
    closes_at: null,
    closed: false,
    total_votes: 3,
    options: [{ id: "o1", text: "Yes", vote_count: 3, voted: false }],
  },
  repost_of: null,
  is_repost: false,
  location: null,
  comments_enabled: true,
  counts: { reactions: 2, comments: 1, reposts: 0 },
  viewer: { reaction: null, bookmarked: false, reposted: false, is_author: false },
  created_at: "2026-10-28T10:00:00Z",
  edited_at: null,
};
const community = {
  id: "c1",
  name: "Tech Gist",
  slug: "tech-gist",
  description: "Code and startups",
  rules: ["Be kind"],
  kind: "interest",
  privacy: "public",
  status: "active",
  parent: null,
  requires_scope_membership: false,
  is_official: true,
  posting_policy: "members",
  commenting_policy: "members",
  member_count: 5,
  viewer: { role: "member", status: "active" },
  created_at: "2026-10-01T10:00:00Z",
};
const eventSummary = {
  id: "e1",
  slug: "campus-hackathon",
  title: "Campus Hackathon",
  summary: "48 hours of building",
  category: "community",
  format: "in_person",
  status: "published",
  visibility: "public",
  host: null,
  venue: null,
  timezone: "Africa/Lagos",
  starts_at: "2030-11-06T10:00:00+01:00",
  ends_at: "2030-11-06T16:00:00+01:00",
  capacity: 120,
  spots_left: 12,
  is_free: true,
  cover_url: null,
  viewer: { registration_id: null, registration_status: null, role: null },
};
const event = {
  ...eventSummary,
  description: "Bring a laptop.",
  location_details: "Main Auditorium",
  online_url: null,
  registration_opens_at: null,
  registration_closes_at: null,
  waitlist_enabled: true,
  requires_approval: false,
  ticket_types: [],
  sessions: [
    {
      id: "s1",
      title: "Kick-off",
      description: "",
      starts_at: "2030-11-06T10:00:00+01:00",
      ends_at: "2030-11-06T11:00:00+01:00",
      location: "Hall A",
      speakers: [],
    },
  ],
  published_at: "2026-10-01T10:00:00Z",
  cancelled_at: null,
  cancellation_reason: "",
  is_hidden: false,
  can_manage: false,
  created_at: "2026-10-01T10:00:00Z",
};
const listing = {
  id: "l1",
  title: "Raspberry Pi kit",
  description: "Brand new",
  category: { key: "electronics", name: "Electronics", parent: null },
  condition: "new",
  price_minor: 6000000,
  currency: "NGN",
  quantity: 1,
  status: "active",
  visibility: "public",
  scope: null,
  city: "Lagos",
  location_note: "",
  allows_pickup: true,
  allows_delivery: true,
  delivery_fee_minor: 150000,
  allows_cash_on_pickup: true,
  images: [],
  seller: user,
  is_hidden: false,
  published_at: "2026-10-01T10:00:00Z",
  created_at: "2026-10-01T10:00:00Z",
};
const podcast = {
  id: "pod1",
  slug: "build-in-public",
  title: "Build in Public",
  description: "Student founders",
  author_name: "Tunde Bakare",
  category: "Technology",
  language: "en",
  explicit: false,
  website: "",
  visibility: "public",
  status: "published",
  host: null,
  has_cover: false,
  subscriber_count: 4,
  published_at: "2026-10-01T10:00:00Z",
  viewer: { subscribed: false, role: null },
  created_at: "2026-10-01T10:00:00Z",
};
const profile = {
  id: "u2",
  handle: "tunde",
  display_name: "Tunde Bakare",
  created_at: "2026-08-29T10:00:00Z",
  email: null,
  phone_number: null,
  extras: {
    social: {
      bio: "I build things",
      website: "https://tunde.dev",
      followers_count: 4,
      following_count: 4,
      posts_count: 2,
      requires_follow_approval: false,
      relationship: { following: null, followed_by: true },
    },
    communities: [{ id: "c1", name: "Tech Gist", slug: "tech-gist", role: "owner" }],
    seller: { store_name: "Tunde", rating: null, sales_count: 0 },
  },
};
const gist = {
  id: "g1",
  author: { anonymous: true },
  body: "Confession: thermodynamics.",
  visibility: "community",
  audience: { type: "community", id: "c1" },
  comments_enabled: true,
  counts: { reactions: 1, comments: 0 },
  viewer: { reaction: null, is_author: false },
  created_at: "2026-10-28T10:00:00Z",
};
const me = {
  ...user,
  email: "amaka@gistloop.test",
  pending_email: "",
  phone_number: null,
  email_verified: true,
  phone_verified: false,
  status: "active",
  locale: "",
  timezone: "",
  created_at: "2026-08-29T10:00:00Z",
  last_login: null,
};
const page = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results });
const cursor = (results: unknown[]) => ({ next: null, previous: null, results });

const order = {
  id: "o1",
  reference: "ORD-1",
  listing: "l1",
  title: "Raspberry Pi kit",
  unit_price_minor: 4500000,
  quantity: 1,
  delivery_fee_minor: 0,
  total_minor: 4500000,
  currency: "NGN",
  fulfilment: "pickup",
  payment_method: "online",
  delivery_details: null,
  status: "pending_payment",
  buyer: user,
  seller: { id: "u2", handle: "tunde", display_name: "Tunde Bakare", avatar_url: null },
  expires_at: null,
  paid_at: null,
  fulfilled_at: null,
  auto_complete_at: null,
  completed_at: null,
  cancelled_at: null,
  cancel_reason: "",
  disputed_at: null,
  dispute_reason: "",
  resolution: "",
  reviewed: false,
  created_at: "2026-10-28T10:00:00Z",
};

const API: [RegExp, unknown][] = [
  [
    /\/api\/v1\/payments\/PAY_1\/verify\//,
    {
      reference: "PAY_1",
      purpose: "marketplace.order",
      object_id: "o1",
      description: "Raspberry Pi kit",
      amount_minor: 4500000,
      currency: "NGN",
      provider: "paystack",
      status: "succeeded",
      checkout_url: "https://checkout.paystack.com/x",
      amount_refunded_minor: 0,
      failure_reason: "",
      expires_at: "2026-10-28T11:00:00Z",
      paid_at: "2026-10-28T10:05:00Z",
      created_at: "2026-10-28T10:00:00Z",
    },
  ],
  [/\/api\/v1\/marketplace\/me\/orders\//, page([order])],
  [/\/api\/v1\/social\/feeds\/trending\//, { offset: 0, limit: 20, results: [post] }],
  [/\/api\/v1\/social\/(feeds|users\/[^/]+\/posts|audiences|hashtags\/[^/]+\/posts|me\/bookmarks)/, cursor([post])],
  [
    /\/api\/v1\/social\/posts\/[^/]+\/comments\//,
    [
      {
        id: "cm1",
        post: "p1",
        parent: null,
        author: user,
        body: "Count me in",
        reaction_count: 0,
        reply_count: 0,
        viewer_reaction: null,
        created_at: "2026-10-28T10:00:00Z",
        edited_at: null,
      },
    ],
  ],
  [/\/api\/v1\/social\/posts\/[^/]+\/$/, post],
  [/\/api\/v1\/social\/hashtags\/$/, [{ name: "tech", posts_count: 2 }]],
  [
    /\/api\/v1\/social\/me\/profile\//,
    {
      bio: "Hi",
      website: "",
      requires_follow_approval: false,
      allow_mentions_from: "everyone",
      default_post_visibility: "public",
      followers_count: 1,
      following_count: 1,
      posts_count: 1,
    },
  ],
  [/\/api\/v1\/communities\/c1\//, community],
  [/\/api\/v1\/communities\//, page([community])],
  [
    /\/api\/v1\/me\/communities\//,
    page([{ community, role: "member", status: "active", joined_at: "2026-10-01T10:00:00Z" }]),
  ],
  [/\/api\/v1\/anonymous\/posts\//, cursor([gist])],
  [/\/api\/v1\/events\/by-slug\//, event],
  [/\/api\/v1\/me\/event-registrations\//, page([])],
  [/\/api\/v1\/events\//, page([eventSummary])],
  [/\/api\/v1\/marketplace\/categories\//, [{ key: "electronics", name: "Electronics", parent: null }]],
  [/\/api\/v1\/marketplace\/listings\/l1\//, listing],
  [/\/api\/v1\/marketplace\/listings\//, page([listing])],
  [/\/api\/v1\/podcasts\/by-slug\//, podcast],
  [
    /\/api\/v1\/podcasts\/[^/]+\/episodes\//,
    page([
      {
        id: "ep1",
        podcast: "pod1",
        slug: "ep-1",
        title: "Pilot",
        summary: "First one",
        show_notes: "",
        episode_type: "full",
        number: 1,
        season: null,
        explicit: false,
        duration_seconds: 1800,
        has_audio: true,
        has_video: false,
        has_transcript: true,
        guests: [],
        status: "published",
        publish_at: null,
        published_at: "2026-10-01T10:00:00Z",
        created_at: "2026-10-01T10:00:00Z",
      },
    ]),
  ],
  [/\/api\/v1\/podcasts\//, page([podcast])],
  [/\/api\/v1\/users\/by-handle\//, profile],
  [/\/api\/v1\/trending\//, [{ content_type: "community.community", object_id: "c1", score: 3, title: "Tech Gist" }]],
  [/\/api\/v1\/search\/people\//, [{ id: "u2", handle: "tunde", display_name: "Tunde Bakare" }]],
  [
    /\/api\/v1\/search\//,
    [{ content_type: "social.post", object_id: "p1", title: "Hackathon this weekend", snippet: "", score: 1 }],
  ],
  [/\/api\/v1\/notifications\/counts\//, { unread: 3, unseen: 1 }],
  [
    /\/api\/v1\/notifications\/categories\//,
    [
      {
        key: "reactions",
        label: "Reactions",
        mandatory: false,
        bypass_quiet_hours: false,
        channels: ["in_app", "email"],
      },
    ],
  ],
  [
    /\/api\/v1\/notifications\//,
    cursor([
      {
        id: "n1",
        verb: "social.reaction",
        category: "reactions",
        title: "Chidi reacted to your post",
        actor: user,
        actor_count: 1,
        target: { type: "social.post", id: "p1", available: true },
        data: {},
        url: "",
        is_read: false,
        is_seen: false,
        read_at: null,
        created_at: "2026-10-28T10:00:00Z",
        last_activity_at: "2026-10-28T10:00:00Z",
      },
    ]),
  ],
  [
    /\/api\/v1\/me\/notifications\//,
    {
      in_app_enabled: true,
      email_enabled: true,
      push_enabled: false,
      sms_enabled: false,
      marketing_emails: false,
      digest_frequency: "never",
      quiet_hours_start: null,
      quiet_hours_end: null,
      categories: {},
      updated_at: "2026-10-01T10:00:00Z",
    },
  ],
  [
    /\/api\/v1\/me\/privacy\//,
    {
      profile_visibility: "public",
      show_email: false,
      show_phone: false,
      show_affiliations: true,
      discoverable_by_email: false,
      discoverable_by_phone: false,
      searchable: true,
      updated_at: "2026-10-01T10:00:00Z",
    },
  ],
  [
    /\/api\/v1\/me\/sessions\//,
    [
      {
        id: "s1",
        auth_method: "password",
        device_name: "Chrome on Windows",
        user_agent: "Mozilla",
        ip_address: "127.0.0.1",
        created_at: "2026-10-28T10:00:00Z",
        last_seen_at: "2026-10-28T10:00:00Z",
        expires_at: "2026-11-28T10:00:00Z",
        revoked_at: null,
        current: true,
      },
    ],
  ],
  [/\/api\/v1\/me\/$/, me],
  [/\/api\/v1\/site\/contact\/topics\//, [{ value: "general", label: "General question" }]],
];

const signedInTokens = {
  token_type: "Bearer",
  access: "access",
  access_expires_at: new Date(Date.now() + 300_000).toISOString(),
  refresh_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  session_id: "s1",
};

function mockApi(signedIn: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url;
      const respond = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
      if (url.includes("/bff/auth/refresh/")) return signedIn ? respond(signedInTokens) : respond({}, 401);
      const match = API.find(([pattern]) => pattern.test(url));
      return match ? respond(match[1]) : respond({ error: { code: "not_found", message: "Not found." } }, 404);
    }),
  );
}

async function visit(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders client={createQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return router;
}

const PUBLIC: [string, RegExp][] = [
  ["/", /Catch the conversation/],
  ["/about", /building the place where campus talks/i],
  ["/features", /Everything campus life needs/],
  ["/contact", /We'd love to hear from you/],
  ["/help", /How can we help/],
  ["/careers", /Help us build/],
  ["/press", /in the news/],
  ["/safety", /Staying safe/],
  ["/terms", /Terms of Service/],
  ["/privacy", /Privacy Policy/],
  ["/cookies", /Cookie Policy/],
  ["/guidelines", /Community Guidelines/],
  ["/communities", /Tech Gist/],
  ["/c/c1", /Tech Gist/],
  ["/events", /Campus Hackathon/],
  ["/events/campus-hackathon", /Bring a laptop/],
  ["/marketplace", /Raspberry Pi kit/],
  ["/marketplace/l1", /Sign in to buy/],
  ["/podcasts", /Build in Public/],
  ["/podcasts/build-in-public", /Pilot/],
  ["/posts/p1", /Count me in/],
  ["/u/tunde", /I build things/],
  ["/tags/tech", /#tech/],
  ["/login", /Welcome back/],
  ["/register", /Join GistLoop/],
  ["/forgot-password", /Forgot your password/],
  ["/nowhere", /This conversation has moved on/],
];

const MEMBER: [string, RegExp][] = [
  ["/feed", /Hackathon this weekend/],
  ["/gist", /Say it without saying who/],
  ["/c/c1?tab=gist", /Confession: thermodynamics/],
  ["/notifications", /Chidi reacted to your post/],
  ["/search?q=hack", /Hackathon this weekend/],
  ["/bookmarks", /Hackathon this weekend/],
  ["/settings", /Public profile/],
  ["/settings/account", /Email address/],
  ["/settings/privacy", /Profile visibility/],
  ["/settings/notifications", /Channels/],
  ["/settings/security", /Chrome on Windows/],
  ["/settings/data", /Download your data/],
  ["/marketplace/sell", /Publish listing/],
  ["/marketplace/orders", /Pay now/],
  ["/events/new", /Publish event/],
  ["/events/tickets", /No tickets yet/],
  ["/payments/return?reference=PAY_1", /Payment received/],
];

describe("every page renders", () => {
  beforeEach(() => __resetAuthForTests());
  afterEach(() => vi.unstubAllGlobals());

  it.each(PUBLIC)("visitor: %s", async (path, expected) => {
    mockApi(false);
    await visit(path);
    expect((await screen.findAllByText(expected, {}, { timeout: 4000 })).length).toBeGreaterThan(0);
    expect(screen.queryByText("Something went wrong")).toBeNull();
  });

  it.each(MEMBER)("member: %s", async (path, expected) => {
    localStorage.setItem("gistloop-signed-in", "1");
    mockApi(true);
    await visit(path);
    expect((await screen.findAllByText(expected, {}, { timeout: 4000 })).length).toBeGreaterThan(0);
    expect(screen.queryByText("Something went wrong")).toBeNull();
  });

  it("sends visitors to sign in from member pages, and back afterwards", async () => {
    mockApi(false);
    const router = await visit("/settings/privacy");
    await screen.findByText("Welcome back");
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent("/settings/privacy")}`);
  });
});
