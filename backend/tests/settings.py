"""Test settings: GistLoop's real settings, with development defaults filled in."""

import os

os.environ["GISTLOOP_SKIP_DOTENV"] = "1"  # Never pick up a developer's local .env in tests.
os.environ.setdefault("DJANGO_DEBUG", "true")
os.environ.setdefault("FRONTEND_URL", "http://testserver")
os.environ.pop("DATABASE_URL", None)
os.environ.pop("REDIS_URL", None)
os.environ.pop("CELERY_BROKER_URL", None)

from gistloop.settings import *  # noqa: F403

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
if os.environ.get("GISTLOOP_TEST_DB") == "postgres":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("PGDATABASE", "gistloop"),
            "USER": os.environ.get("PGUSER", "postgres"),
            "PASSWORD": os.environ.get("PGPASSWORD", "postgres"),
            "HOST": os.environ.get("PGHOST", "localhost"),
            "PORT": os.environ.get("PGPORT", "5432"),
        }
    }
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]  # Fast, tests only.
globals().update(email_settings("django.core.mail.backends.locmem.EmailBackend"))  # noqa: F405
GISTLOOP = {**GISTLOOP, "CONTACT_RECIPIENTS": ["hello@gistloop.test"]}  # noqa: F405
LOGGING = {"version": 1, "disable_existing_loggers": False}

# Static files are not collected in tests.
MIDDLEWARE = [m for m in MIDDLEWARE if "whitenoise" not in m]  # noqa: F405

# Django runs tests with DEBUG off; let the development payment provider run anyway (tests only).
GISTLOOP_ALLOW_DEV_PAYMENTS = True
