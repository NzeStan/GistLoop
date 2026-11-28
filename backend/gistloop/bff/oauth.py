"""Sign in with Google, Yahoo or GitHub (OAuth 2 authorization-code flow with PKCE).

The browser never handles provider tokens. The flow is:

1. The website asks ``POST /bff/auth/oauth/<provider>/start/`` for the provider's authorisation URL.
   GistLoop generates ``state``, a ``nonce`` and a PKCE verifier, keeps them in a short-lived signed
   httpOnly cookie, and the browser navigates to the provider.
2. The provider sends the person back to ``{FRONTEND_URL}/auth/callback/<provider>?code=…&state=…``.
3. That page posts the code and state to ``POST /bff/auth/oauth/<provider>/complete/``. GistLoop checks
   the state against the cookie, exchanges the code with the provider server-to-server (with the client
   secret and the PKCE verifier), verifies who the person is, and signs them in through University's
   ``login_with_provider`` (or links the provider to the signed-in account).

Each provider here implements University's ``IdentityProvider`` protocol, so University handles the
account rules: an existing account is only matched by email when the provider says the address is
verified, and new accounts start with a verified email only when the provider vouches for it.

Configure each provider with its client ID and secret in the environment (see ``.env.example``). A
provider without both is simply not offered.
"""

from __future__ import annotations

import base64
import hashlib
import secrets
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

from django.conf import settings
from university.core.exceptions import AuthenticationFailed, ProviderError
from university.core.providers.http import request as http_request
from university.security.providers.base import ExternalProfile
from university.security.providers.oidc import OIDCIdentityProvider

_FAILED = "Unable to sign in with this provider."


def callback_url(provider: str) -> str:
    return f"{settings.FRONTEND_URL}/auth/callback/{provider}"


def pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


@dataclass
class AuthorizationRequest:
    url: str
    state: str
    nonce: str
    verifier: str


class OAuthProvider:
    """Shared authorisation-URL and code-exchange logic."""

    key: str
    name: str
    authorize_url: str
    token_url: str
    scopes: tuple[str, ...]

    def __init__(self, *, key: str, client_id: str, client_secret: str, **_: Any) -> None:
        self.key = key
        self.client_id = client_id
        self.client_secret = client_secret

    def authorization_request(self) -> AuthorizationRequest:
        state, nonce = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        verifier, challenge = pkce_pair()
        params = {
            "client_id": self.client_id,
            "redirect_uri": callback_url(self.key),
            "response_type": "code",
            "scope": " ".join(self.scopes),
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            **self.extra_authorize_params(nonce),
        }
        return AuthorizationRequest(f"{self.authorize_url}?{urlencode(params)}", state, nonce, verifier)

    def extra_authorize_params(self, nonce: str) -> dict[str, str]:
        return {}

    def exchange(self, code: str, verifier: str) -> dict[str, Any]:
        if not isinstance(code, str) or not code or len(code) > 2048:
            raise AuthenticationFailed(_FAILED, code="external_auth_failed")
        try:
            data = http_request(
                "POST",
                self.token_url,
                form={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": callback_url(self.key),
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code_verifier": verifier,
                },
            )
        except ProviderError:
            raise AuthenticationFailed(_FAILED, code="external_auth_failed") from None
        if not isinstance(data, dict) or data.get("error"):
            raise AuthenticationFailed(_FAILED, code="external_auth_failed")
        return data


class OIDCCodeProvider(OAuthProvider):
    """OpenID Connect providers: the ID token is verified with University's OIDC verifier."""

    issuer: str
    jwks_url: str
    #: Mailboxes the provider itself hosts. It owns them, so they count as verified even when the
    #: ID token has no ``email_verified`` claim (Yahoo omits it).
    hosted_domains: frozenset[str] = frozenset()

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._verifier = OIDCIdentityProvider(
            key=self.key, issuer=self.issuer, audience=self.client_id, jwks_url=self.jwks_url
        )

    def extra_authorize_params(self, nonce: str) -> dict[str, str]:
        return {"nonce": nonce}

    def authenticate(self, credential: Mapping[str, Any]) -> ExternalProfile:
        tokens = self.exchange(credential.get("code", ""), credential.get("code_verifier", ""))
        profile = self._verifier.authenticate({"id_token": tokens.get("id_token"), "nonce": credential.get("nonce")})
        if not profile.email_verified and profile.email.rpartition("@")[2] in self.hosted_domains:
            profile = ExternalProfile(
                subject=profile.subject, email=profile.email, email_verified=True, display_name=profile.display_name
            )
        return profile


class GoogleProvider(OIDCCodeProvider):
    name = "Google"
    authorize_url = "https://accounts.google.com/o/oauth2/v2/auth"
    token_url = "https://oauth2.googleapis.com/token"  # noqa: S105 - a URL, not a secret
    issuer = "https://accounts.google.com"
    jwks_url = "https://www.googleapis.com/oauth2/v3/certs"
    scopes = ("openid", "email", "profile")

    def extra_authorize_params(self, nonce: str) -> dict[str, str]:
        return {"nonce": nonce, "prompt": "select_account"}


class YahooProvider(OIDCCodeProvider):
    name = "Yahoo"
    authorize_url = "https://api.login.yahoo.com/oauth2/request_auth"
    token_url = "https://api.login.yahoo.com/oauth2/get_token"  # noqa: S105
    issuer = "https://api.login.yahoo.com"
    jwks_url = "https://api.login.yahoo.com/openid/v1/certs"
    scopes = ("openid", "email", "profile")
    hosted_domains = frozenset({"yahoo.com", "ymail.com", "rocketmail.com", "yahoo.co.uk", "yahoo.fr", "myyahoo.com"})


class GitHubProvider(OAuthProvider):
    """GitHub is OAuth 2 without OpenID Connect: the profile and verified emails come from its API."""

    name = "GitHub"
    authorize_url = "https://github.com/login/oauth/authorize"
    token_url = "https://github.com/login/oauth/access_token"  # noqa: S105
    scopes = ("read:user", "user:email")

    def authenticate(self, credential: Mapping[str, Any]) -> ExternalProfile:
        tokens = self.exchange(credential.get("code", ""), credential.get("code_verifier", ""))
        access = tokens.get("access_token")
        if not isinstance(access, str) or not access:
            raise AuthenticationFailed(_FAILED, code="external_auth_failed")
        headers = {
            "Authorization": f"Bearer {access}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "GistLoop",
        }
        try:
            user = http_request("GET", "https://api.github.com/user", headers=headers)
            emails = http_request("GET", "https://api.github.com/user/emails", headers=headers)
        except ProviderError:
            raise AuthenticationFailed(_FAILED, code="external_auth_failed") from None
        if not isinstance(user, dict) or not user.get("id"):
            raise AuthenticationFailed(_FAILED, code="external_auth_failed")
        verified = [e for e in emails or [] if isinstance(e, dict) and e.get("verified") and e.get("email")]
        primary = next((e for e in verified if e.get("primary")), verified[0] if verified else None)
        return ExternalProfile(
            subject=str(user["id"]),
            email=str(primary["email"]).lower() if primary else "",
            email_verified=primary is not None,
            display_name=str(user.get("name") or user.get("login") or "")[:100],
        )
