"""Social media publishing settings from the environment (no Django imports: used by settings.py)."""

from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Any

#: channel -> {option: environment variable}. A channel is on when all its required variables are set.
CHANNEL_ENV: dict[str, dict[str, str]] = {
    "facebook": {"page_id": "FACEBOOK_PAGE_ID", "page_access_token": "FACEBOOK_PAGE_ACCESS_TOKEN"},
    "instagram": {"user_id": "INSTAGRAM_USER_ID", "access_token": "INSTAGRAM_ACCESS_TOKEN"},
    "x": {
        "api_key": "X_API_KEY",
        "api_secret": "X_API_SECRET",
        "access_token": "X_ACCESS_TOKEN",
        "access_token_secret": "X_ACCESS_TOKEN_SECRET",
    },
    "telegram": {"bot_token": "TELEGRAM_BOT_TOKEN", "chat_id": "TELEGRAM_CHAT_ID"},
    "tiktok": {
        "client_key": "TIKTOK_CLIENT_KEY",
        "client_secret": "TIKTOK_CLIENT_SECRET",
        "refresh_token": "TIKTOK_REFRESH_TOKEN",
    },
}
OPTIONAL_ENV: dict[str, dict[str, str]] = {
    "x": {"handle": "X_HANDLE"},
    "tiktok": {"privacy_level": "TIKTOK_PRIVACY_LEVEL"},
}


def syndication_from_env(environ: Mapping[str, str] | None = None) -> dict[str, Any]:
    environ = os.environ if environ is None else environ

    def get(name: str) -> str:
        return environ.get(name, "").strip()

    channels: dict[str, dict[str, str]] = {}
    for key, required in CHANNEL_ENV.items():
        values = {option: get(var) for option, var in required.items()}
        if key == "instagram" and not values["access_token"]:
            # The Facebook Page token works for the Instagram account linked to that Page.
            values["access_token"] = get("FACEBOOK_PAGE_ACCESS_TOKEN")
        if all(values.values()):
            values.update({o: get(v) for o, v in OPTIONAL_ENV.get(key, {}).items() if get(v)})
            channels[key] = values
    return {
        "CHANNELS": channels,
        "AUTO_APPROVE_PODCASTS": get("SYNDICATION_AUTO_APPROVE_PODCASTS").lower() not in {"0", "false", "no", "off"},
        "META_GRAPH_VERSION": get("META_GRAPH_VERSION") or "v21.0",
        # Where the platforms fetch card images and videos from (your public https address).
        "PUBLIC_BASE_URL": get("PUBLIC_BASE_URL"),
        "BRAND_PRIMARY": get("BRAND_PRIMARY") or "#6D28D9",
        "BRAND_ACCENT": get("BRAND_ACCENT") or "#FF6B57",
        "CARD_FOOTER": get("SYNDICATION_CARD_FOOTER"),
    }
