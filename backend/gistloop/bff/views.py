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
