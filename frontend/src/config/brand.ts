/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  GistLoop brand configuration: the ONE file to edit to rebrand the website.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  • Colours: change `colors.primary` and `colors.accent`. Every shade, hover state, focus ring,
 *    gradient and dark-mode variant across the site is derived from these two values.
 *  • Images and logos: every asset is a full URL, so point each one at your CDN. Until then they
 *    use placeholder images. Swap one line at a time; nothing else needs to change.
 *  • Name, tagline, contact details and social links are used everywhere (header, footer, emails
 *    copy, SEO tags, the web app manifest), so they also live here.
 *
 *  This file is read at build time (favicon, social-sharing tags, theme colour, manifest) and at
 *  runtime (logos and images), so keep it plain data: no imports from the rest of the app.
 */

/** Your CDN, e.g. "https://cdn.gistloop.com/brand". Used by `asset()` below. */
export const CDN_BASE = "https://cdn.gistloop.example/brand";

/** Placeholder images until the real files are on the CDN (https://placehold.co). */
const placeholder = (width: number, height: number, text: string, bg = "6D28D9", fg = "FFFFFF") =>
  `https://placehold.co/${width}x${height}/${bg}/${fg}/png?text=${encodeURIComponent(text)}&font=poppins`;

/** Build a URL on your CDN: asset("logo.svg") → `${CDN_BASE}/logo.svg`. */
export const asset = (path: string) => `${CDN_BASE}/${path.replace(/^\//, "")}`;

export const brand = {
  name: "GistLoop",
  tagline: "Catch the conversation.",
  description:
    "GistLoop is where campus life talks: the feed, communities, anonymous gist, events, a student marketplace and podcasts, all in one safe place.",
  /** The public address of the website (used for canonical links and social sharing). */
  siteUrl: "https://gistloop.example",
  locale: "en-NG",
  currency: "NGN",
  timeZone: "Africa/Lagos",

  colors: {
    /** Main brand colour: buttons, links, highlights. Keep it dark enough for white text. */
    primary: "#6D28D9",
    /** Supporting colour: badges, gradients, small accents. */
    accent: "#FF6B57",
  },

  font: {
    /** CSS font stack. The first family is loaded from `stylesheet`. */
    family: '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    stylesheet: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
  },

  assets: {
    // Replace each placeholder with your CDN file, e.g. logo: asset("logo.svg").
    logo: placeholder(180, 48, "GistLoop"),
    logoOnDark: placeholder(180, 48, "GistLoop", "FFFFFF", "6D28D9"),
    logoMark: placeholder(64, 64, "GL"),
    favicon: placeholder(64, 64, "GL"),
    appleTouchIcon: placeholder(180, 180, "GL"),
    icon192: placeholder(192, 192, "GL"),
    icon512: placeholder(512, 512, "GL"),
    socialShare: placeholder(1200, 630, "GistLoop — Catch the conversation."),

    hero: placeholder(1200, 900, "Campus conversations", "EDE9FE", "4C1D95"),
    aboutStory: placeholder(1200, 800, "Our story", "FFE4DE", "9A3412"),
    appPreview: placeholder(900, 1100, "App preview", "EDE9FE", "4C1D95"),
    features: {
      feed: placeholder(800, 600, "The feed", "EDE9FE", "4C1D95"),
      communities: placeholder(800, 600, "Communities", "FFE4DE", "9A3412"),
      gist: placeholder(800, 600, "Anonymous gist", "EDE9FE", "4C1D95"),
      events: placeholder(800, 600, "Events", "FFE4DE", "9A3412"),
      marketplace: placeholder(800, 600, "Marketplace", "EDE9FE", "4C1D95"),
      podcasts: placeholder(800, 600, "Podcasts", "FFE4DE", "9A3412"),
    },
    team: {
      founder: placeholder(400, 400, "Founder", "EDE9FE", "4C1D95"),
      design: placeholder(400, 400, "Design", "FFE4DE", "9A3412"),
      engineering: placeholder(400, 400, "Engineering", "EDE9FE", "4C1D95"),
      community: placeholder(400, 400, "Community", "FFE4DE", "9A3412"),
    },
    /** Shown when an event, listing or podcast has no image of its own. */
    fallbacks: {
      eventCover: placeholder(1200, 630, "Event", "EDE9FE", "4C1D95"),
      listing: placeholder(800, 800, "Listing", "F4F4F5", "71717A"),
      podcastCover: placeholder(600, 600, "Podcast", "FFE4DE", "9A3412"),
    },
    partners: [
      placeholder(160, 56, "Partner", "F4F4F5", "71717A"),
      placeholder(160, 56, "Partner", "F4F4F5", "71717A"),
      placeholder(160, 56, "Partner", "F4F4F5", "71717A"),
      placeholder(160, 56, "Partner", "F4F4F5", "71717A"),
      placeholder(160, 56, "Partner", "F4F4F5", "71717A"),
    ],
  },

  contact: {
    email: "hello@gistloop.example",
    support: "support@gistloop.example",
    safety: "safety@gistloop.example",
    press: "press@gistloop.example",
    phone: "+234 800 000 0000",
    address: "Yaba, Lagos, Nigeria",
    hours: "Monday to Friday, 9am to 6pm WAT",
  },

  social: {
    x: "https://x.com/gistloop",
    instagram: "https://instagram.com/gistloop",
    tiktok: "https://tiktok.com/@gistloop",
    linkedin: "https://linkedin.com/company/gistloop",
    youtube: "https://youtube.com/@gistloop",
  },

  legal: {
    companyName: "GistLoop Technologies Ltd",
    /** Shown on legal pages. Update when the policies change. */
    policiesUpdated: "2026-10-28",
  },
} as const;

export type Brand = typeof brand;
