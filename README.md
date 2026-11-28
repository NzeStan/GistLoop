# GistLoop

**Catch the conversation.**

GistLoop is the website for a campus social platform: a feed, communities, anonymous gist, events, a
student marketplace and podcasts. The React frontend talks to a small Django API that is assembled from
the [University platform](https://github.com/NzeStan/University) packages, installed straight from PyPI.

```
Browser ──► nginx (one origin) ──┬──► React website (static files)
                                 ├──► /api/…  ─┐
                                 └──► /bff/…  ─┴──► Django (gistloop) ──► university-* packages (PyPI)
                                                          │
                                                   PostgreSQL · Redis · Celery
```

| Folder | What it is |
| --- | --- |
| [`frontend/`](frontend/) | The website: React 19, TypeScript, Vite, React Router, TanStack Query |
| [`backend/`](backend/) | The API: Django + the `university-*` packages, plus browser sign-in (password, code, Google/Yahoo/GitHub), contact and newsletter, YouTube podcasts and posting to GistLoop's social media |
| [`deploy/`](deploy/) | Production Dockerfiles, nginx (with security headers) and a compose stack |

---

## Quick start (development)

You need **Python 3.12+** and **Node 20.19+**. Docker is optional (for PostgreSQL, Redis and a fake inbox).

```bash
# 1. Optional services: PostgreSQL, Redis, Mailpit (emails at http://localhost:8025)
docker compose up -d

# 2. The API
cd backend
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
copy .env.example .env            # macOS/Linux: cp .env.example .env
#   (no Docker? delete DATABASE_URL, REDIS_URL and EMAIL_HOST in .env to use SQLite and console email)
python manage.py migrate
python manage.py university_import_institutions data/institutions-ng.json   # Nigerian schools
python manage.py seed_demo        # demo people, posts, communities, events, listings, podcasts
python manage.py runserver

# 3. The website (in a second terminal)
cd frontend
npm install
npm run dev                       # http://localhost:5173
```

Sign in with any demo account, e.g. **amaka@gistloop.test**, password **GistLoop-demo-2026**.

**Signing up a new account locally:** without `EMAIL_HOST`, emails (including the verification
link) are printed in the API's terminal, not sent. Open the link from there, or skip it with
`python manage.py verify_user you@example.com` (development only: it refuses to run unless
`DJANGO_DEBUG=true`).

---

## Rebranding: one file

Everything visual lives in **[`frontend/src/config/brand.ts`](frontend/src/config/brand.ts)**:

- **Colours:** change `colors.primary` and `colors.accent`. Every shade, hover state, focus ring,
  gradient and the whole dark theme are derived from those two values
  ([`styles/tokens.css`](frontend/src/styles/tokens.css)), and they're baked into the page at build
  time, so there's no flash of the wrong colours.
- **Logos and images:** every asset is a full URL. They start as placeholders; point each one at your
  CDN (set `CDN_BASE` and use `asset("logo.svg")`, or paste any URL). Favicon, app icons and the
  social-sharing image are injected into the HTML and the web manifest automatically.
- **Name, tagline, font, contact details, social links and legal entity** are used everywhere:
  header, footer, legal pages, SEO tags and the manifest.

If an image fails to load, the site falls back gracefully (the logo becomes a styled wordmark).

---

## What's on the website

**Public pages:** home, features, about, contact (form → API → your inbox), help centre / FAQ,
careers, press kit, safety centre, terms, privacy (NDPA 2023), cookies, community guidelines,
newsletter (double opt-in), 404 and error pages.

**Browse without an account:** communities, events, marketplace, opportunities, podcasts, posts,
profiles, hashtags, search, premium plans and people's "ask me anonymously" pages.

**Members:** schools (join, verify, school and campus feeds and gist, announcements; school admins
manage members and structure), sign in with a code or Google/Yahoo/GitHub, two-step sign-in, phone
number, linked accounts, API keys and account activity, follower lists, follow requests, block / mute /
restrict, polls, quote reposts, places on posts, editing posts and comments, replies, comment likes,
community management (members, requests, roles, bans, invitations, invite links, settings, stats),
event management (details, agenda, tickets, attendees, CSV export, check-in, team, venues), seller
shops with reviews, order details and disputes, payment history, earnings and payouts, the creator
hub (accounts, verification, media kit, stats) and sponsorship campaigns, the podcast studio,
your reports and appeals; feed (following, latest, trending), posting with photos (up to 4 per post) and
visibility controls, likes, reposts, bookmarks, comments, polls, reporting; profile photos;
communities (join, post, anonymous gist board); events (register, waitlist, calendar export, create
an event with a cover image, sell paid tickets, "your tickets"); marketplace (sell with photos, buy
with Paystack or cash on pickup, orders for buyers and sellers: pay, mark as sent, confirm receipt,
cancel); private messages (requests from people you don't follow, groups, mute, archive) and an
anonymous inbox (people ask without their names; answer privately or publicly, block senders);
institution announcements; opportunities (browse, save, apply with a CV, post a role, review
applicants); promotions (boost your own posts, listings and opportunities, or run an advert, paid
with Paystack, reviewed before going live, with results); premium plans (Paystack, no auto-renewal;
the ad-free perk hides sponsored items); podcast subscriptions and playback; notifications and
messages with live unread counts; people search;
full settings (profile, photo, email, password, privacy, notification preferences, signed-in devices,
data export, account deletion with password confirmation).

## Schools

GistLoop is for every institution in Nigeria. [`backend/data/institutions-ng.json`](backend/data/institutions-ng.json)
lists about 170 universities, polytechnics, colleges of education and monotechnics (federal, state and
private) with their states, cities, main campuses and, where known, their email domains. **Check it
against the official NUC, NBTE and NCCE lists before launch**: it was compiled by hand and some names
change. Re-running the import updates schools by `slug` and never duplicates them.

- People add their school in **Settings → Schools** (or "I study or work here" on the school's page),
  then verify with a code sent to their school email, an ID number, a document, or by asking the
  school's admins. Verified members see the school's feed, anonymous gist board (and their campus's),
  and members-only announcements. Their main school shows on their profile.
- Posting: **Everyone (all schools)**, **my school only** or **my campus only**. Communities can be
  made school-only too.
- **Email domains** are imported unverified. A domain only auto-verifies members once GistLoop staff
  mark it verified (admin, or re-import with `--verify-domains` for a list you trust; note that
  re-importing without the flag marks them unverified again).
- **School admins:** give someone the school's admin role (Staff console → Roles, scope
  "institution" + the school's ID). They then get **Manage** on the school page: approve members,
  post announcements, edit campuses, faculties, departments, programmes, levels and sessions.

## Sign in with Google, Yahoo or GitHub

Each button appears once its keys are in `backend/.env` (`OAUTH_GOOGLE_CLIENT_ID` / `_SECRET`,
`OAUTH_YAHOO_…`, `OAUTH_GITHUB_…`). Register this redirect URL with each provider:
`https://YOUR-DOMAIN/auth/callback/google` (or `/yahoo`, `/github`). The code exchange happens on the
server with PKCE, and the session still uses the httpOnly cookie. An existing account is matched by
email only when the provider says it verified that address; otherwise people sign in with their
password and link the provider in **Settings → Security**. "Email me a sign-in code" works without
any keys (`PASSWORDLESS_LOGIN=false` turns it off).

## Podcasts and YouTube

The **Podcast studio** (`/studio`) creates shows and episodes: upload audio or video, or paste a
YouTube link. Episodes with a YouTube video play on GistLoop through YouTube's privacy-enhanced
player, so the views count on YouTube. Connect a channel (its `UC…` ID) and new uploads become draft
episodes every hour, ready to review and publish. Also in the studio: seasons, hosts and producers,
guests (they confirm), transcripts and captions (automatic with `DEEPGRAM_API_KEY`), clips, scheduled
publishing and listening stats. FFmpeg is needed for transcoding and clips (installed in the Docker
image). Uploads over 25 MB go straight to object storage when `MEDIA_S3_BUCKET` is set.

## GistLoop's social media accounts

New public podcast episodes are posted to GistLoop's **Facebook Page, Instagram, X and Telegram**
automatically, and episodes with an uploaded video also go to **TikTok**. Anonymous gist goes out
**only** when its author ticks "share on GistLoop's social pages" **and** an editor approves it in
**Staff console → Social pages** (give editors the "Social media editor" role). Nothing stored links
a shared gist to its author. If the author deletes it, or moderators hide it, it's deleted from the
platforms that allow deleting (Facebook, X, Telegram; Instagram and TikTok posts must be removed by
hand, and the console says so).

Each channel turns on when its keys are set (see `backend/.env.example`): a long-lived Facebook Page
token (`pages_manage_posts`) and the linked Instagram professional account (`instagram_content_publish`);
an X app with read and write access plus the account's access token and secret (posting through X's
API is paid); a Telegram bot added as an admin of your channel; TikTok Content Posting API keys
(posts stay private until TikTok audits the app). The platforms fetch images and videos from
`PUBLIC_BASE_URL`, so it must be your public https address. Every page on the site also has a
**Share** menu: WhatsApp, X, Facebook, Telegram, copy link, and the phone's own share sheet.

## Push notifications

Optional, through Firebase Cloud Messaging: set `FCM_PROJECT_ID` and `FCM_CREDENTIALS_FILE` (a
service-account key, never committed) in the backend, and the `VITE_FIREBASE_*` values in
`frontend/.env` (see `frontend/.env.example`). People turn them on per browser in
**Settings → Notifications**.

## Staff console

`/staff` shows each tool only to people with its permission: reports and moderation decisions,
appeals, automatic rules, restricted people, social media approvals, advert reviews, payouts,
order disputes, refunds, creator verification, accounts (suspend, ban, reactivate, restore), roles and
who has them, the audit log, revealing an anonymous author (two people, recorded), adding schools and
platform numbers. Create your first administrator with `python manage.py createsuperuser`, then give
them the "Platform administrator" role in the Django admin.

## Background jobs

With `CELERY_BROKER_URL` set, run the worker with beat. Every periodic job the modules provide is
scheduled in `settings.py` (`CELERY_BEAT_SCHEDULE`), and a test fails if one is missing or misnamed:
publishing scheduled episodes, event reminders and expired ticket holds, unpaid and auto-completing
orders, refund retries, notification digests, trending, promotions and subscriptions housekeeping,
closing expired opportunities, creator account sync, YouTube imports, social media retries and data
retention.

## Payments (Paystack)

Checkout goes through University's payments module, so money is held in escrow for marketplace
orders and tickets are confirmed only when the server has verified the payment.

1. In the [Paystack dashboard](https://dashboard.paystack.com/#/settings/developers), copy your
   **secret key** into `PAYSTACK_SECRET_KEY` in `.env` (use the `sk_test_…` key until launch).
2. Set the **webhook URL** to `https://YOUR-DOMAIN/api/v1/payments/webhooks/paystack/`. Webhooks
   confirm payments even if the payer closes the tab before returning.
3. Paystack sends payers back to `FRONTEND_URL/payments/return`, which asks the API to verify the
   payment and then shows the result.

Without a key, development uses a built-in provider that returns straight to the website, already
paid, so you can try the whole flow locally. It only runs with `DJANGO_DEBUG=true`; production with
no key simply has no checkout.

**Uploads** go to `backend/media/` in development (served at `/media/`). In production they're
kept on a Docker volume and served through nginx, or set `MEDIA_URL` to a CDN backed by object
storage and `SERVE_MEDIA=false`.

**Account flows:** sign up (with recorded consent), email verification, sign in with two-step
verification, forgot / reset password, email change confirmation. Links in emails and notifications
all land on matching website routes.

---

## Security model

- **No tokens in JavaScript storage.** University issues a 5-minute access token and a 30-day
  refresh token. The refresh token lives only in an `HttpOnly; Secure; SameSite=Strict` cookie scoped
  to `/bff/auth/` ([`backend/gistloop/bff`](backend/gistloop/bff)); the access token lives in memory.
  An XSS bug can't steal a long-lived session.
- **CSRF-proof sign-in.** Browser sign-in endpoints require a custom header and reject cross-site
  `Origin` / `Sec-Fetch-Site`, so other sites can't sign people in, refresh or sign out.
- **Multi-tab safe.** Refreshes are single-flight and serialised across tabs (Web Locks), and tabs
  share fresh tokens over a BroadcastChannel. University revokes a whole session if a refresh token is
  ever reused, so this matters.
- **Same origin, strict headers.** nginx serves the site and proxies the API on one origin (no CORS)
  with a strict Content Security Policy, HSTS and friends ([`deploy/nginx.conf`](deploy/nginx.conf)).
- **Safe rendering.** User text is never injected as HTML (lint-enforced); user links are restricted
  to `http(s)`; post-sign-in redirects can't leave the site.
- **Abuse-resistant forms.** Contact and newsletter are rate limited, have honeypots, never auto-reply
  to arbitrary addresses and don't reveal whether an email is subscribed.

---

## Everyday commands

| Where | Command | What it does |
| --- | --- | --- |
| frontend | `npm run dev` | Dev server with hot reload (proxies the API) |
| frontend | `npm run check` | Type-check, lint (incl. accessibility), format check, tests |
| frontend | `npm run build` | Production build into `dist/` |
| frontend | `npm run api:types` | Regenerate API types from `backend/openapi.yml` |
| backend | `pytest` | API tests (add `GISTLOOP_TEST_DB=postgres` for PostgreSQL) |
| backend | `ruff check . && ruff format .` | Lint and format |
| backend | `python manage.py spectacular --file openapi.yml` | Refresh the API schema after upgrading packages |
| backend | `python manage.py seed_demo` | Demo data (development only) |

**Upgrading University packages:** `pip install -U -r requirements.txt`, then refresh `openapi.yml`
and run `npm run api:types`. TypeScript will point at anything that changed. CI fails if the schema
or the generated types are stale.

---

## Deploying

```bash
cp backend/.env.example deploy/.env      # fill in real secrets; DJANGO_DEBUG=false
export POSTGRES_PASSWORD=…               # a strong password
docker compose -f deploy/docker-compose.prod.yml up -d --build
docker compose -f deploy/docker-compose.prod.yml exec api python manage.py migrate
docker compose -f deploy/docker-compose.prod.yml exec api python manage.py createsuperuser
```

Put HTTPS in front of the `web` container (a load balancer, Caddy or Cloudflare) and set in `.env`:
`DJANGO_ALLOWED_HOSTS`, `FRONTEND_URL` (your https address), `PUBLIC_BASE_URL` (the same, unless the
API has its own address), `CSRF_TRUSTED_ORIGINS`, the dedicated
secrets (including `MESSAGING_ENCRYPTION_KEYS`), `PAYSTACK_SECRET_KEY`, email (SMTP) settings and
`CONTACT_RECIPIENTS`. The worker runs Celery with beat (trending every 5 minutes, unpaid checkouts
expire every 15 minutes, promotions and subscriptions housekeeping, retention purges every 6 hours).

Before launch, also: point the brand assets at your CDN and tighten the CSP's `img-src` to it, have a
lawyer review the legal pages, and set a monitored address in `brand.contact`.

---

## Project layout

```
frontend/src/
  config/brand.ts       ← rebrand here
  api/                  typed client, browser session, query hooks (schema.d.ts is generated)
  auth/                 session context and route guards
  components/           UI kit, layouts, SEO
  features/             one folder per area: feed, communities, gist, schools, events, marketplace,
                        podcasts (and the studio), creator, staff, discovery, profile, settings,
                        auth, marketing
  styles/               design tokens, base styles, utilities
backend/gistloop/
  settings.py           every University module wired up, all secrets from the environment
  bff/                  browser sign-in with the httpOnly refresh cookie
  contact/              contact form and newsletter (rate limits, honeypot, retention)
  demo/                 seed_demo and verify_user commands
  youtube/              YouTube videos for episodes, channel import
  syndication/          posting to GistLoop's Facebook Page, Instagram, X, Telegram and TikTok
  platform/             background-job wiring, transcription provider, staff endpoints
backend/data/           institutions-ng.json (the schools list)
```

© GistLoop Technologies Ltd. All rights reserved.
