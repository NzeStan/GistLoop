"""The refresh-token cookie."""

from __future__ import annotations

import datetime as dt
from typing import Any

from django.conf import settings
from django.http import HttpRequest
from django.utils import timezone
from django.utils.dateparse import parse_datetime

COOKIE_PATH = "/bff/auth/"


def _config() -> dict[str, Any]:
    return getattr(settings, "GISTLOOP", {})


def cookie_name() -> str:
    return _config().get("REFRESH_COOKIE_NAME", "gl_rt")


def read_refresh(request: HttpRequest) -> str:
    return request.COOKIES.get(cookie_name(), "")


def set_refresh(response: Any, tokens: dict[str, Any]) -> None:
    expires = parse_datetime(str(tokens.get("refresh_expires_at", ""))) or (timezone.now() + dt.timedelta(days=30))
    max_age = max(int((expires - timezone.now()).total_seconds()), 0)
    response.set_cookie(
        cookie_name(),
        tokens["refresh"],
        max_age=max_age,
        path=COOKIE_PATH,
        secure=bool(_config().get("REFRESH_COOKIE_SECURE", True)),
        httponly=True,
        samesite="Strict",
    )


def clear_refresh(response: Any) -> None:
    response.delete_cookie(cookie_name(), path=COOKIE_PATH, samesite="Strict")


def public_tokens(tokens: dict[str, Any]) -> dict[str, Any]:
    """What the browser may see: everything except the refresh token itself."""
    return {key: value for key, value in tokens.items() if key != "refresh"}
