"""GistLoop API settings.

GistLoop composes the University platform packages (installed from PyPI) with two small local apps:

* ``gistloop.bff``: the browser sign-in layer. Refresh tokens live in an httpOnly cookie, never in
  JavaScript.
* ``gistloop.contact``: the website's contact form and newsletter.

Every secret and environment-specific value comes from the environment (see ``.env.example``).
"""

from __future__ import annotations

import importlib.util
import os
from pathlib import Path
from urllib.parse import urlparse

from university.core import CORE_APPS
from university.core.api.schema import spectacular_settings
from university.core.settings import (
    email_settings,
    logging_settings,
    production_security_settings,
    recommended_middleware,
    rest_framework_settings,
)

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    """Read KEY=VALUE lines from backend/.env for local development (real env vars win)."""
    if os.environ.get("GISTLOOP_SKIP_DOTENV") or not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


_load_dotenv(BASE_DIR / ".env")


def env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name, default)
    if value is None:
        raise RuntimeError(f"Missing required environment variable {name}")
    return value


def env_bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


DEBUG = env_bool("DJANGO_DEBUG", False)
SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-only-insecure-key-change-me" if DEBUG else None)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1" if DEBUG else "")
# The container health check calls the API from inside the container.
ALLOWED_HOSTS += [h for h in ("127.0.0.1", "localhost") if h not in ALLOWED_HOSTS]

# The public website. Email links (verify, reset password) point here.
FRONTEND_URL = env("FRONTEND_URL", "http://localhost:5173").rstrip("/")

# ------------------------------------------------------------------ apps
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "drf_spectacular",
    # Level one: University Core (core, audit, users, security, permissions).
    *CORE_APPS,
    # Level two: the University modules GistLoop uses.
    "university.institution",
    "university.social",
    "university.moderation",
    "university.anonymous",
    "university.community",
    "university.notifications",
    "university.events",
    "university.creator",
    "university.payments",
    "university.marketplace",
    "university.media",
    "university.podcast",
    "university.analytics",
    "university.trending",
    "university.search",
    "university.opportunities",
    "university.messaging",
    "university.promotions",
    "university.subscriptions",
    # GistLoop.
    "gistloop.bff",
    "gistloop.contact",
    "gistloop.demo",  # manage.py seed_demo (development only)
]

# The website is served from the same origin as the API (a reverse proxy routes /api and /bff), so
# CORS stays off. Enable it only for a separately hosted client, and never with "allow all".
CORS_ENABLED = env_bool("CORS_ENABLED", False)
if CORS_ENABLED:
    INSTALLED_APPS.append("corsheaders")
    CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS")
    CORS_ALLOW_CREDENTIALS = True

MIDDLEWARE = recommended_middleware(cors=CORS_ENABLED)
# Serve the admin's static files without a separate static server.
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")
ROOT_URLCONF = "gistloop.urls"
WSGI_APPLICATION = "gistloop.wsgi.application"
ASGI_APPLICATION = "gistloop.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

# -------------------------------------------------------------- database
DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL:
    parsed = urlparse(DATABASE_URL)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": parsed.path.lstrip("/"),
            "USER": parsed.username or "",
            "PASSWORD": parsed.password or "",
            "HOST": parsed.hostname or "",
            "PORT": str(parsed.port or 5432),
            "CONN_MAX_AGE": int(os.environ.get("DB_CONN_MAX_AGE", "60")),
            "CONN_HEALTH_CHECKS": True,
        }
    }
else:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}

# ----------------------------------------------------------------- cache
# Rate limits, login lockouts and analytics de-duplication need a cache shared by every worker.
REDIS_URL = os.environ.get("REDIS_URL")
CACHES = {
    "default": (
        {"BACKEND": "django.core.cache.backends.redis.RedisCache", "LOCATION": REDIS_URL}
        if REDIS_URL
        else {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}
    )
}

# ------------------------------------------------------------------ auth
AUTH_USER_MODEL = "university_users.User"
AUTHENTICATION_BACKENDS = ["university.users.backends.UniversityAuthBackend"]
PASSWORD_HASHERS = ["django.contrib.auth.hashers.PBKDF2PasswordHasher"]
if importlib.util.find_spec("argon2") is not None:
    PASSWORD_HASHERS.insert(0, "django.contrib.auth.hashers.Argon2PasswordHasher")
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ------------------------------------------------------------------- API
REST_FRAMEWORK = rest_framework_settings()
SPECTACULAR_SETTINGS = spectacular_settings(
    TITLE="GistLoop API",
    DESCRIPTION="The GistLoop API, built on the University platform.",
    ENUM_NAME_OVERRIDES={
        **spectacular_settings()["ENUM_NAME_OVERRIDES"],
        "MembershipStatusEnum": "university.institution.constants.MembershipStatus",
        "VerificationStatusEnum": "university.institution.constants.VerificationStatus",
        "InstitutionStatusEnum": "university.institution.constants.InstitutionStatus",
        "SocialVisibilityEnum": "university.social.constants.Visibility",
        "ContentStatusEnum": "university.social.constants.ContentStatus",
        "CaseStatusEnum": "university.moderation.constants.CaseStatus",
        "ModerationActionEnum": "university.moderation.constants.Action",
        "AppealStatusEnum": "university.moderation.constants.AppealStatus",
        "SeverityEnum": "university.moderation.constants.Severity",
        "CommunityPrivacyEnum": "university.community.constants.Privacy",
        "CommunityStatusEnum": "university.community.constants.CommunityStatus",
        "CommunityRoleEnum": "university.community.constants.Role",
        "CommunityMembershipStatusEnum": "university.community.constants.MembershipStatus",
        "EventStatusEnum": "university.events.constants.EventStatus",
        "AudienceVisibilityEnum": "university.events.constants.EventVisibility",
        "EventRegistrationStatusEnum": "university.events.constants.RegistrationStatus",
        "CreatorVerificationStatusEnum": "university.creator.constants.VerificationStatus",
        "CreatorRequestStatusEnum": "university.creator.constants.RequestStatus",
        "CreatorProfileStatusEnum": "university.creator.constants.ProfileStatus",
        "CampaignStatusEnum": "university.creator.constants.CampaignStatus",
        "CampaignVisibilityEnum": "university.creator.constants.CampaignVisibility",
        "ParticipationStatusEnum": "university.creator.constants.ParticipationStatus",
        "DeliverableStatusEnum": "university.creator.constants.DeliverableStatus",
        "MediaKitVisibilityEnum": "university.creator.constants.KitVisibility",
        "ListingVisibilityEnum": "university.marketplace.constants.ListingVisibility",
        "DisputeOutcomeEnum": "university.marketplace.constants.DisputeOutcome",
        "MarketOrderStatusEnum": "university.marketplace.constants.OrderStatus",
        "PaymentIntentStatusEnum": "university.payments.constants.IntentStatus",
        "PayoutStatusEnum": "university.payments.constants.PayoutStatus",
        "RefundStatusEnum": "university.payments.constants.RefundStatus",
        "MediaKindEnum": "university.media.models.AssetKind",
        "MediaStatusEnum": "university.media.models.AssetStatus",
        "TranscriptFormatEnum": "university.podcast.constants.TranscriptFormat",
        "EventFormatEnum": "university.events.constants.EventFormat",
        "PodcastStatusEnum": "university.podcast.constants.ShowStatus",
        "EpisodeStatusEnum": "university.podcast.constants.EpisodeStatus",
        "AnnouncementAudienceEnum": "university.institution.constants.AnnouncementAudience",
        "OpportunityKindEnum": "university.opportunities.constants.OpportunityKind",
        "OpportunityAudienceEnum": "university.opportunities.constants.OpportunityAudience",
        "CampaignKindEnum": "university.promotions.models.CampaignKind",
    },
)

# ------------------------------------------------------------ University
UNIVERSITY = {
    "AUTH": {
        "JWT": {"SIGNING_KEY": os.environ.get("JWT_SIGNING_KEY")},
    },
    "SECURITY": {
        "HMAC_KEY": os.environ.get("UNIVERSITY_HMAC_KEY"),
        "TRUSTED_PROXY_COUNT": int(os.environ.get("TRUSTED_PROXY_COUNT", "0")),
    },
    "USERS": {
        "FRONTEND_URLS": {
            "VERIFY_EMAIL": FRONTEND_URL + "/verify-email?token={token}",
            "CONFIRM_EMAIL_CHANGE": FRONTEND_URL + "/confirm-email?token={token}",
            "RESET_PASSWORD": FRONTEND_URL + "/reset-password?uid={uid}&token={token}",
        },
    },
    "THROTTLE_RATES": {
        # University's defaults, plus GistLoop's own scopes.
        "anon_global": "120/min",
        "user_global": "600/min",
        "login": "10/min",
        "token_refresh": "30/min",
        "registration": "5/hour",
        "password_reset": "5/hour",
        "password_change": "10/hour",
        "email_verification": "10/hour",
        "otp_request": "5/hour",
        "otp_verify": "20/hour",
        "account_delete": "5/hour",
        "data_export": "3/day",
        "api_key_create": "10/day",
        "profile_lookup": "120/min",
        "upload": "60/hour",
        "report": "30/hour",
        "webhook": "600/min",
        "contact": "5/hour",
        "newsletter": "5/hour",
    },
    "TASKS": {
        "BACKEND": (
            "university.core.tasks.CeleryTaskBackend"
            if os.environ.get("CELERY_BROKER_URL")
            else "university.core.tasks.ImmediateTaskBackend"
        ),
    },
    "PROVIDERS": {
        "SMS": os.environ.get("SMS_PROVIDER", "university.core.providers.sms.ConsoleSMSProvider"),
        "SMS_OPTIONS": (
            {"api_key": os.environ["SMS_API_KEY"], "sender_id": os.environ.get("SMS_SENDER_ID", "GistLoop")}
            if os.environ.get("SMS_API_KEY")
            else {}
        ),
    },
    "INSTITUTION": {
        "ALLOW_MULTIPLE_INSTITUTIONS": True,
    },
    # Links the modules put in emails and notifications. Each one is a route on the website.
    "NOTIFICATIONS": {
        "OPEN_URL": FRONTEND_URL + "/notifications/{id}",
        "LIST_URL": FRONTEND_URL + "/notifications",
        "PREFERENCES_URL": FRONTEND_URL + "/settings/notifications",
    },
    "EVENTS": {"EVENT_URL": FRONTEND_URL + "/events/{slug}", "PAID_TICKETS_ENABLED": True},
    "PODCAST": {"SHOW_URL": FRONTEND_URL + "/podcasts/{slug}"},
    "CREATOR": {"PROFILE_URL": FRONTEND_URL + "/creators/{handle}"},
    "PAYMENTS": {
        # Paystack is used when PAYSTACK_SECRET_KEY is set (test keys start sk_test_). Its webhook
        # URL is {API}/api/v1/payments/webhooks/paystack/ (set it in the Paystack dashboard).
        # Without a key, development uses gistloop.demo.payments (no money moves); production has no checkout.
        "PROVIDERS": (
            {
                "paystack": {
                    "class": "university.payments.providers.paystack.PaystackProvider",
                    "options": {"secret_key": os.environ["PAYSTACK_SECRET_KEY"]},
                }
            }
            if os.environ.get("PAYSTACK_SECRET_KEY")
            else ({"dev": {"class": "gistloop.demo.payments.DevPaymentProvider"}} if DEBUG else {})
        ),
        "DEFAULT_PROVIDER": ("paystack" if os.environ.get("PAYSTACK_SECRET_KEY") else ("dev" if DEBUG else None)),
        "CALLBACK_URL": FRONTEND_URL + "/payments/return?reference={reference}",
        "ALLOWED_CALLBACK_PREFIXES": [FRONTEND_URL + "/"],
        "CURRENCIES": ["NGN"],
    },
    "MESSAGING": {
        # Fernet key(s) for message text at rest (the first encrypts, all decrypt).
        "ENCRYPTION_KEYS": env_list("MESSAGING_ENCRYPTION_KEYS"),
    },
    "PROMOTIONS": {
        "PLACEMENTS": ["feed", "events", "marketplace", "opportunities"],
    },
    "ANONYMOUS": {
        # Dedicated Fernet key(s), kept outside the database (the first encrypts, all decrypt).
        "IDENTITY_KEYS": env_list("ANONYMOUS_IDENTITY_KEYS"),
    },
}

# ------------------------------------------------------------ GistLoop
GISTLOOP = {
    # Where contact-form messages are emailed. Empty: stored only (read them in the admin).
    "CONTACT_RECIPIENTS": env_list("CONTACT_RECIPIENTS"),
    # The refresh-token cookie. "__Secure-" requires HTTPS, so development uses a plain name.
    "REFRESH_COOKIE_NAME": os.environ.get("REFRESH_COOKIE_NAME", "gl_rt" if DEBUG else "__Secure-gl_rt"),
    "REFRESH_COOKIE_SECURE": env_bool("REFRESH_COOKIE_SECURE", not DEBUG),
}

# ----------------------------------------------------------------- Celery
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL")
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_BEAT_SCHEDULE = {
    "university-retention": {
        "task": "university.core.run_task",
        "schedule": 60 * 60 * 6,
        "args": ["university.core.purge", [], {}],
    },
    "trending": {
        "task": "university.core.run_task",
        "schedule": 60 * 5,
        "args": ["university.trending.compute_trending", [], {}],
    },
    "promotions-complete": {
        "task": "university.core.run_task",
        "schedule": 60 * 5,
        "args": ["university.promotions.complete_finished", [], {}],
    },
    "subscriptions-sweep": {
        "task": "university.core.run_task",
        "schedule": 60 * 60,
        "args": ["university.subscriptions.sweep", [], {}],
    },
    "opportunities-close": {
        "task": "university.core.run_task",
        "schedule": 60 * 60,
        "args": ["university.opportunities.close_expired", [], {}],
    },
    "payments-expire": {
        "task": "university.core.run_task",
        "schedule": 60 * 15,
        "args": ["university.payments.expire_intents", [], {}],
    },
}

# ------------------------------------------------------------------ email
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", "GistLoop <no-reply@gistloop.example>")
# Development prints emails to the console. Set EMAIL_HOST for SMTP (e.g. Mailpit locally, or your
# provider in production).
if os.environ.get("EMAIL_HOST"):
    _smtp = {
        "host": os.environ["EMAIL_HOST"],
        "port": int(os.environ.get("EMAIL_PORT", "587")),
        "username": os.environ.get("EMAIL_HOST_USER", ""),
        "password": os.environ.get("EMAIL_HOST_PASSWORD", ""),
        "use_tls": env_bool("EMAIL_USE_TLS", True),
    }
    _email = email_settings("django.core.mail.backends.smtp.EmailBackend", **_smtp)
    if "EMAIL_BACKEND" in _email:  # Django before 6.1
        EMAIL_HOST, EMAIL_PORT = _smtp["host"], _smtp["port"]
        EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, EMAIL_USE_TLS = _smtp["username"], _smtp["password"], _smtp["use_tls"]
    globals().update(_email)
else:
    globals().update(email_settings("django.core.mail.backends.console.EmailBackend"))

# ---------------------------------------------------------------- storage
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# Public uploads (profile photos, post images, event covers, listing photos). With object storage
# and a CDN, set MEDIA_URL to the CDN and SERVE_MEDIA=false. Private files (CVs) are never served
# from here: their own endpoints check who's asking.
MEDIA_URL = os.environ.get("MEDIA_URL", "/media/")
MEDIA_ROOT = BASE_DIR / "media"
SERVE_MEDIA = env_bool("SERVE_MEDIA", DEBUG)
STORAGES = {
    # Use object storage (S3, MinIO, Cloudinary via django-storages) in production.
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
        "OPTIONS": {"location": MEDIA_ROOT, "base_url": MEDIA_URL},
    },
    "private": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
        "OPTIONS": {"location": BASE_DIR / "private-media", "base_url": "/private/"},
    },
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

LANGUAGE_CODE = "en"
TIME_ZONE = "Africa/Lagos"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LOGGING = logging_settings(level=os.environ.get("LOG_LEVEL", "INFO"), json=not DEBUG)

if not DEBUG:
    globals().update(production_security_settings())
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https") if env_bool("BEHIND_TLS_PROXY", True) else None
    SECURE_REDIRECT_EXEMPT = [r"^health/"]  # Internal health checks speak plain HTTP.
    CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", FRONTEND_URL)
