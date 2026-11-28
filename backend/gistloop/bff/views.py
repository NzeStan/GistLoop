from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from django.conf import settings
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import permissions, serializers, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from university.core.exceptions import AuthenticationFailed, PermissionDenied, UniversityError
from university.core.http import ClientMeta
from university.security.api.v1 import serializers as auth_serializers
from university.security.authentication import JWTAuthentication
from university.security.models import UserSession
from university.security.services import login, sessions

from gistloop.bff.cookies import clear_refresh, public_tokens, read_refresh, set_refresh

CLIENT_HEADER = "HTTP_X_GISTLOOP_CLIENT"
ALLOWED_FETCH_SITES = {"same-origin", "none"}

BrowserTokens = inline_serializer(
    "BrowserTokens",
    fields={
        "token_type": serializers.CharField(),
        "access": serializers.CharField(),
        "access_expires_at": serializers.DateTimeField(),
        "refresh_expires_at": serializers.DateTimeField(),
        "session_id": serializers.UUIDField(),
    },
)


def _allowed_origins(request: Request) -> set[str]:
    origins = {urlparse(settings.FRONTEND_URL)._replace(path="").geturl()}
    origins.add(f"{request.scheme}://{request.get_host()}")
    return origins


def require_browser_request(request: Request) -> None:
    """Reject anything that isn't the GistLoop website calling from its own origin.

    The custom header can't be sent cross-site without a CORS preflight (which fails), and modern
    browsers label cross-site requests with ``Sec-Fetch-Site``. Together they stop login CSRF and
    forced refresh or sign-out from other sites.
    """
    if request.META.get(CLIENT_HEADER) != "web":
        raise PermissionDenied("Browser sign-in requests must come from the GistLoop website.", code="client_required")
    fetch_site = request.META.get("HTTP_SEC_FETCH_SITE")
    if fetch_site and fetch_site not in ALLOWED_FETCH_SITES:
        raise PermissionDenied("Cross-site sign-in requests are not allowed.", code="cross_site")
    origin = request.META.get("HTTP_ORIGIN")
    if origin and origin not in _allowed_origins(request):
        raise PermissionDenied("Cross-site sign-in requests are not allowed.", code="cross_site")


def _meta(request: Request, data: dict[str, Any] | None = None) -> ClientMeta:
    data = data or {}
    return ClientMeta.from_request(
        request, device_id=data.get("device_id", ""), device_name=data.get("device_name", "") or "Web browser"
    )


def _no_store(response: Response) -> Response:
    response["Cache-Control"] = "no-store"
    response["Pragma"] = "no-cache"
    return response


def _signed_in(result: login.LoginResult) -> Response:
    if result.mfa_required and result.challenge is not None:
        return _no_store(
            Response(
                {
                    "mfa_required": True,
                    "challenge_id": str(result.challenge.pk),
                    "channel": result.challenge.channel,
                    "destination": result.challenge.destination_masked,
                },
                status=status.HTTP_202_ACCEPTED,
            )
        )
    if result.tokens is None:  # pragma: no cover - University returns tokens or a challenge
        raise AuthenticationFailed()
    tokens = result.tokens.as_dict()
    response = Response(public_tokens(tokens))
    set_refresh(response, tokens)
    return _no_store(response)


class BrowserAPIView(APIView):
    """Reads no ambient credentials except the refresh cookie, which every view checks itself."""

    authentication_classes: list[Any] = []
    permission_classes = [permissions.AllowAny]
    versioning_class = None  # Mounted at /bff/, outside the versioned /api/v1/ namespace.

    def initial(self, request: Request, *args: Any, **kwargs: Any) -> None:
        super().initial(request, *args, **kwargs)
        require_browser_request(request)


class LoginView(BrowserAPIView):
    throttle_scope = "login"

    @extend_schema(
        request=auth_serializers.LoginSerializer,
        responses={200: BrowserTokens, 202: auth_serializers.MFAChallengeSerializer},
    )
    def post(self, request: Request) -> Response:
        serializer = auth_serializers.LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        result = login.login_with_password(
            identifier=data["identifier"], password=data["password"], meta=_meta(request, data)
        )
        return _signed_in(result)


class MFALoginView(BrowserAPIView):
    throttle_scope = "otp_verify"

    @extend_schema(request=auth_serializers.ChallengeCompleteSerializer, responses=BrowserTokens)
    def post(self, request: Request) -> Response:
        serializer = auth_serializers.ChallengeCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        result = login.complete_mfa_login(
            challenge_id=data["challenge_id"], code=data["code"], meta=_meta(request, data)
        )
        return _signed_in(result)


class PasswordlessRequestView(BrowserAPIView):
    """Email (or text) me a sign-in code instead of using a password."""

    throttle_scope = "otp_request"

    @extend_schema(
        request=auth_serializers.PasswordlessRequestSerializer,
        responses={
            202: inline_serializer(
                "BrowserCodeSent",
                fields={
                    "challenge_id": serializers.UUIDField(),
                    "channel": serializers.CharField(),
                },
            )
        },
    )
    def post(self, request: Request) -> Response:
        serializer = auth_serializers.PasswordlessRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        challenge = login.request_passwordless_code(
            identifier=serializer.validated_data["identifier"], meta=_meta(request)
        )
        return _no_store(
            Response(
                {"challenge_id": str(challenge.challenge_id), "channel": challenge.channel},
                status=status.HTTP_202_ACCEPTED,
            )
        )


class PasswordlessVerifyView(BrowserAPIView):
    throttle_scope = "otp_verify"

    @extend_schema(request=auth_serializers.ChallengeCompleteSerializer, responses=BrowserTokens)
    def post(self, request: Request) -> Response:
        serializer = auth_serializers.ChallengeCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        result = login.complete_passwordless_login(
            challenge_id=data["challenge_id"], code=data["code"], meta=_meta(request, data)
        )
        return _signed_in(result)


class RefreshView(BrowserAPIView):
    throttle_scope = "token_refresh"

    @extend_schema(request=None, responses=BrowserTokens)
    def post(self, request: Request) -> Response:
        raw = read_refresh(request)
        if not raw:
            raise AuthenticationFailed("You are not signed in.", code="not_signed_in")
        try:
            tokens = sessions.rotate_refresh_token(raw, meta=_meta(request)).as_dict()
        except UniversityError as exc:
            response = Response(
                {"error": {"code": "not_signed_in", "message": "Your session has ended. Please sign in again."}},
                status=getattr(exc, "status_code", status.HTTP_401_UNAUTHORIZED),
            )
            clear_refresh(response)
            return _no_store(response)
        response = Response(public_tokens(tokens))
        set_refresh(response, tokens)
        return _no_store(response)


class LogoutView(BrowserAPIView):
    @extend_schema(request=None, responses={204: None})
    def post(self, request: Request) -> Response:
        session = self._session_from_access_token(request) or self._session_from_cookie(request)
        if session is not None:
            sessions.logout(session, user=session.user)
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_refresh(response)  # Always: signing out must never fail on the client.
        return _no_store(response)

    @staticmethod
    def _session_from_access_token(request: Request) -> UserSession | None:
        try:
            authenticated = JWTAuthentication().authenticate(request)
        except Exception:
            return None
        return getattr(authenticated[1], "session", None) if authenticated else None

    @staticmethod
    def _session_from_cookie(request: Request) -> UserSession | None:
        raw = read_refresh(request)
        if not raw:
            return None
        try:
            # Rotating proves possession of the cookie and tells us which session it belongs to.
            tokens = sessions.rotate_refresh_token(raw, meta=_meta(request))
        except UniversityError:
            return None
        return UserSession.objects.select_related("user").filter(pk=tokens.session_id).first()


# ------------------------------------------------------- Google / Yahoo / GitHub
OAUTH_COOKIE = "gl_oauth"
OAUTH_COOKIE_PATH = "/bff/auth/oauth/"
OAUTH_MAX_AGE = 600  # The person has ten minutes to finish at the provider.
_OAUTH_SALT = "gistloop.bff.oauth"


def _oauth_provider(key: str) -> Any:
    from university.core.exceptions import NotFound
    from university.security.providers import get_identity_provider

    from gistloop.bff.oauth import OAuthProvider

    provider = get_identity_provider(key)  # NotFound when it isn't configured.
    if not isinstance(provider, OAuthProvider):
        raise NotFound("Unknown identity provider.")
    return provider


ProviderList = inline_serializer(
    "OAuthProviderList",
    fields={
        "providers": serializers.ListField(
            child=inline_serializer(
                "OAuthProvider",
                fields={
                    "key": serializers.CharField(),
                    "name": serializers.CharField(),
                },
            )
        )
    },
)


class OAuthProvidersView(APIView):
    """The sign-in providers this deployment offers (the website shows a button for each)."""

    authentication_classes: list[Any] = []
    permission_classes = [permissions.AllowAny]
    versioning_class = None

    @extend_schema(responses=ProviderList)
    def get(self, request: Request) -> Response:
        from university.core.conf import university_settings

        configured = university_settings.get("AUTH.IDENTITY_PROVIDERS", {}) or {}
        providers = []
        for key in configured:
            try:
                providers.append({"key": key, "name": _oauth_provider(key).name})
            except UniversityError:
                continue
        return Response({"providers": providers})


class OAuthStartView(BrowserAPIView):
    throttle_scope = "login"

    @extend_schema(
        request=inline_serializer(
            "OAuthStart",
            fields={
                "mode": serializers.ChoiceField(choices=["login", "link"], default="login"),
            },
        ),
        responses=inline_serializer("OAuthRedirect", fields={"authorize_url": serializers.URLField()}),
    )
    def post(self, request: Request, provider: str) -> Response:
        from django.core import signing

        mode = request.data.get("mode", "login")
        if mode not in {"login", "link"}:
            mode = "login"
        auth = _oauth_provider(provider).authorization_request()
        response = _no_store(Response({"authorize_url": auth.url}))
        payload = {"p": provider, "s": auth.state, "n": auth.nonce, "v": auth.verifier, "m": mode}
        response.set_cookie(
            OAUTH_COOKIE,
            signing.dumps(payload, salt=_OAUTH_SALT),
            max_age=OAUTH_MAX_AGE,
            path=OAUTH_COOKIE_PATH,
            secure=bool(getattr(settings, "GISTLOOP", {}).get("REFRESH_COOKIE_SECURE", True)),
            httponly=True,
            # Lax: the person comes back from the provider's site.
            samesite="Lax",
        )
        return response


class OAuthCompleteView(BrowserAPIView):
    throttle_scope = "login"

    @extend_schema(
        request=inline_serializer(
            "OAuthComplete",
            fields={
                "code": serializers.CharField(),
                "state": serializers.CharField(),
            },
        ),
        responses={
            200: BrowserTokens,
            201: inline_serializer("OAuthLinked", fields={"linked": serializers.BooleanField()}),
        },
    )
    def post(self, request: Request, provider: str) -> Response:
        from django.core import signing
        from university.core.crypto import constant_time_equals
        from university.security.services import external

        failed = AuthenticationFailed("That sign-in link has expired. Please try again.", code="oauth_state_invalid")
        try:
            saved = signing.loads(request.COOKIES.get(OAUTH_COOKIE, ""), salt=_OAUTH_SALT, max_age=OAUTH_MAX_AGE)
        except signing.BadSignature:
            raise failed from None
        state = str(request.data.get("state", ""))
        if saved.get("p") != provider or not state or not constant_time_equals(state, str(saved.get("s", ""))):
            raise failed
        _oauth_provider(provider)
        credential = {"code": request.data.get("code", ""), "code_verifier": saved["v"], "nonce": saved["n"]}
        if saved.get("m") == "link":
            authenticated = JWTAuthentication().authenticate(request)
            if not authenticated:
                raise AuthenticationFailed("Sign in first to link an account.", code="not_signed_in")
            external.link_provider(authenticated[0], provider, credential)
            response = _no_store(Response({"linked": True}, status=status.HTTP_201_CREATED))
        else:
            response = _signed_in(external.login_with_provider(provider, credential, meta=_meta(request)))
        response.delete_cookie(OAUTH_COOKIE, path=OAUTH_COOKIE_PATH, samesite="Lax")
        return response
