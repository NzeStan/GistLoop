"""Build the identity-provider settings from the environment (no Django imports: used by settings.py)."""

from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Any

PROVIDER_CLASSES = {
    "google": "gistloop.bff.oauth.GoogleProvider",
    "yahoo": "gistloop.bff.oauth.YahooProvider",
    "github": "gistloop.bff.oauth.GitHubProvider",
}


def identity_providers_from_env(environ: Mapping[str, str] | None = None) -> dict[str, dict[str, Any]]:
    """``UNIVERSITY["AUTH"]["IDENTITY_PROVIDERS"]`` for each provider whose ID and secret are set."""
    environ = os.environ if environ is None else environ
    providers: dict[str, dict[str, Any]] = {}
    for key, path in PROVIDER_CLASSES.items():
        client_id = environ.get(f"OAUTH_{key.upper()}_CLIENT_ID", "").strip()
        client_secret = environ.get(f"OAUTH_{key.upper()}_CLIENT_SECRET", "").strip()
        if client_id and client_secret:
            providers[key] = {"CLASS": path, "OPTIONS": {"client_id": client_id, "client_secret": client_secret}}
    return providers
