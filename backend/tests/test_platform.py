"""GistLoop composes every University module from PyPI; these guard that composition."""

import pytest
from django.core.management import call_command

pytestmark = pytest.mark.django_db

MODULES = {
    "core", "institution", "social", "moderation", "anonymous", "community", "notifications", "events",
    "creator", "payments", "marketplace", "media", "podcast", "analytics", "trending", "search", "site",
    "opportunities", "messaging", "promotions", "subscriptions",
}  # fmt: skip


def test_every_module_is_installed(api_client):
    names = {m["name"] for m in api_client.get("/api/v1/meta/modules/").json()}
    assert names >= MODULES


def test_openapi_schema_has_no_warnings(tmp_path):
    call_command("spectacular", "--validate", "--fail-on-warn", "--file", str(tmp_path / "schema.yml"))
    schema = (tmp_path / "schema.yml").read_text(encoding="utf-8")
    assert "/bff/auth/refresh/" in schema and "/api/v1/site/contact/" in schema


def test_health(api_client):
    assert api_client.get("/health/live/").status_code == 200
