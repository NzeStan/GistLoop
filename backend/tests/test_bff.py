import re

import pytest
from university.core.testing import PASSWORD
from university.security.models import UserSession

pytestmark = pytest.mark.django_db

LOGIN = "/bff/auth/login/"
REFRESH = "/bff/auth/refresh/"
LOGOUT = "/bff/auth/logout/"
COOKIE = "gl_rt"


def sign_in(client, user, web):
    return client.post(LOGIN, {"identifier": user.email, "password": PASSWORD}, format="json", **web)


@pytest.mark.security
def test_login_keeps_the_refresh_token_out_of_javascript(api_client, user, web):
    response = sign_in(api_client, user, web)
    assert response.status_code == 200
    body = response.json()
    assert "refresh" not in body and body["access"] and body["token_type"] == "Bearer"
    cookie = response.cookies[COOKIE]
    assert cookie.value.startswith("rt_")
    assert cookie["httponly"] and cookie["samesite"] == "Strict" and cookie["path"] == "/bff/auth/"
    assert int(cookie["max-age"]) > 0
    assert response["Cache-Control"] == "no-store"
    # The access token works against the University API.
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {body['access']}")
    assert api_client.get("/api/v1/me/").json()["email"] == user.email


def test_wrong_password_sets_no_cookie(api_client, user, web):
    response = api_client.post(LOGIN, {"identifier": user.email, "password": "wrong-password-1"}, format="json", **web)
    assert response.status_code == 401 and COOKIE not in response.cookies


@pytest.mark.security
@pytest.mark.parametrize(
    "headers",
    [
        {},  # No client header: e.g. a cross-site form post.
        {"HTTP_X_GISTLOOP_CLIENT": "web", "HTTP_SEC_FETCH_SITE": "cross-site"},
        {"HTTP_X_GISTLOOP_CLIENT": "web", "HTTP_ORIGIN": "https://evil.example"},
    ],
)
def test_cross_site_requests_are_rejected(api_client, user, headers):
    for url in (LOGIN, REFRESH, LOGOUT):
        response = api_client.post(url, {"identifier": user.email, "password": PASSWORD}, format="json", **headers)
        assert response.status_code == 403, url
        assert COOKIE not in response.cookies or not response.cookies[COOKIE].value


def test_same_origin_requests_with_an_origin_header_are_allowed(api_client, user, web):
    response = sign_in(api_client, user, {**web, "HTTP_ORIGIN": "http://testserver"})
    assert response.status_code == 200


@pytest.mark.security
def test_refresh_rotates_and_reuse_ends_the_session(api_client, user, web):
    first = sign_in(api_client, user, web).cookies[COOKIE].value
    refreshed = api_client.post(REFRESH, **web)
    assert refreshed.status_code == 200 and "refresh" not in refreshed.json()
    second = refreshed.cookies[COOKIE].value
    assert second != first
    # Replaying the old cookie (a stolen copy) revokes the whole session.
    api_client.cookies[COOKIE] = first
    replay = api_client.post(REFRESH, **web)
    assert replay.status_code == 401 and replay.cookies[COOKIE].value == ""
    api_client.cookies[COOKIE] = second
    assert api_client.post(REFRESH, **web).status_code == 401
    assert UserSession.objects.get(user=user).revoked_at is not None


def test_refresh_without_a_cookie(api_client, web):
    response = api_client.post(REFRESH, **web)
    assert response.status_code == 401 and response.json()["error"]["code"] == "not_signed_in"


@pytest.mark.security
def test_logout_with_only_the_cookie_ends_the_session(api_client, user, web):
    sign_in(api_client, user, web)
    response = api_client.post(LOGOUT, **web)
    assert response.status_code == 204 and response.cookies[COOKIE].value == ""
    assert UserSession.objects.get(user=user).revoked_at is not None


def test_logout_with_the_access_token(api_client, user, web):
    access = sign_in(api_client, user, web).json()["access"]
    api_client.cookies.clear()
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    assert api_client.post(LOGOUT, **web).status_code == 204
    assert UserSession.objects.get(user=user).revoked_at is not None


def test_logout_always_succeeds(api_client, web):
    api_client.credentials(HTTP_AUTHORIZATION="Bearer not-a-token")
    api_client.cookies[COOKIE] = "rt_forged"
    assert api_client.post(LOGOUT, **web).status_code == 204


def test_mfa_sign_in(api_client, user, web, outbox):
    user.security_settings.mfa_enabled = True
    user.security_settings.save()
    challenge = sign_in(api_client, user, web)
    assert challenge.status_code == 202 and challenge.json()["mfa_required"] is True
    assert COOKIE not in challenge.cookies
    code = re.search(r"\b(\d{6})\b", outbox[-1].body).group(1)
    response = api_client.post(
        "/bff/auth/login/mfa/", {"challenge_id": challenge.json()["challenge_id"], "code": code}, format="json", **web
    )
    assert response.status_code == 200 and response.cookies[COOKIE].value.startswith("rt_")
