"""Google / Yahoo / GitHub sign-in, YouTube episodes, social media publishing and the job schedule."""

from __future__ import annotations

import datetime as dt
from typing import Any
from urllib.parse import parse_qs, urlsplit

import pytest
from django.conf import settings as django_settings
from django.utils import timezone
from university.core.testing import create_user
from university.security.providers.base import ExternalProfile

from gistloop.bff import oauth
from gistloop.bff.oauth_settings import identity_providers_from_env
from gistloop.syndication import channels as syndication_channels
from gistloop.syndication.env_settings import syndication_from_env
from gistloop.syndication.models import Delivery, ItemStatus, Kind, SyndicationItem
from gistloop.youtube.models import EpisodeVideo
from gistloop.youtube.services import parse_channel_id, parse_video_id

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _media(settings):
    settings.STORAGES = {
        **settings.STORAGES,
        "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
        "private": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    }


# -------------------------------------------------------------------- the schedule
def test_every_scheduled_job_exists():
    from university.core.tasks import registered_tasks

    names = set(registered_tasks())
    for entry in django_settings.CELERY_BEAT_SCHEDULE.values():
        assert entry["args"][0] in names, entry


def test_every_periodic_university_job_is_scheduled():
    scheduled = {entry["args"][0] for entry in django_settings.CELERY_BEAT_SCHEDULE.values()}
    on_demand = {  # Enqueued by the modules themselves when something happens.
        "university.core.events.run_async_handler",
        "university.core.send_templated_email",
        "university.security.send_sms",
        "university.events.fan_out_notice",
        "university.institution.fan_out_announcement",
        "university.media.process_asset",
        "university.notifications.deliver",
        "university.payments.submit_refund",
        "university.podcast.notify_subscribers",
        "university.podcast.transcribe_episode",
        "university.search.index_item",
        "university.search.remove_item",
        "gistloop.syndication.deliver_item",
    }
    from university.core.tasks import registered_tasks

    assert set(registered_tasks()) - on_demand - scheduled == set()


# ------------------------------------------------------------------- outside sign-in
def test_providers_are_offered_only_with_keys():
    assert identity_providers_from_env({}) == {}
    env = {"OAUTH_GOOGLE_CLIENT_ID": "id", "OAUTH_GOOGLE_CLIENT_SECRET": "secret", "OAUTH_GITHUB_CLIENT_ID": "x"}
    assert list(identity_providers_from_env(env)) == ["google"]


@pytest.fixture
def google(settings, monkeypatch):
    settings.UNIVERSITY = {
        **settings.UNIVERSITY,
        "AUTH": {
            **settings.UNIVERSITY["AUTH"],
            "IDENTITY_PROVIDERS": {
                "google": {
                    "CLASS": "gistloop.bff.oauth.GoogleProvider",
                    "OPTIONS": {"client_id": "client-1", "client_secret": "s3cret"},
                }
            },
        },
    }
    from university.security import providers

    providers._cache.clear()
    seen: dict[str, Any] = {}

    def fake_authenticate(self, credential):
        seen.update(credential)
        if credential["code"] != "good-code":
            from university.core.exceptions import AuthenticationFailed

            raise AuthenticationFailed("no", code="external_auth_failed")
        return ExternalProfile(subject="g-123", email="chidi@gmail.com", email_verified=True, display_name="Chidi")

    monkeypatch.setattr(oauth.GoogleProvider, "authenticate", fake_authenticate)
    yield seen
    providers._cache.clear()


def start(client, web, provider="google", mode="login"):
    response = client.post(f"/bff/auth/oauth/{provider}/start/", {"mode": mode}, format="json", **web)
    assert response.status_code == 200, response.content
    query = parse_qs(urlsplit(response.json()["authorize_url"]).query)
    return response, query


def test_provider_list_and_authorisation_url(api_client, web, google):
    assert api_client.get("/bff/auth/oauth/providers/").json() == {"providers": [{"key": "google", "name": "Google"}]}
    response, query = start(api_client, web)
    assert query["client_id"] == ["client-1"] and query["redirect_uri"] == ["http://testserver/auth/callback/google"]
    assert query["code_challenge_method"] == ["S256"] and query["state"] and query["nonce"]
    cookie = response.cookies["gl_oauth"]
    assert cookie["httponly"] and cookie["path"] == "/bff/auth/oauth/" and cookie["samesite"] == "Lax"


def test_google_sign_in_creates_a_verified_account(api_client, web, google):
    _, query = start(api_client, web)
    response = api_client.post(
        "/bff/auth/oauth/google/complete/", {"code": "good-code", "state": query["state"][0]}, format="json", **web
    )
    assert response.status_code == 200, response.json()
    assert response.json()["access"] and "refresh" not in response.json()
    assert response.cookies["gl_rt"].value.startswith("rt_")
    # The server sent its own PKCE verifier and nonce, never anything from the browser.
    assert google["code_verifier"] and google["nonce"] == query["nonce"][0]
    from django.contrib.auth import get_user_model

    created = get_user_model().objects.get(email="chidi@gmail.com")
    assert created.email_verified_at is not None


def test_wrong_state_is_refused(api_client, web, google):
    start(api_client, web)
    response = api_client.post(
        "/bff/auth/oauth/google/complete/", {"code": "good-code", "state": "forged"}, format="json", **web
    )
    assert response.status_code == 401 and response.json()["error"]["code"] == "oauth_state_invalid"


def test_complete_requires_the_website(api_client, google):
    response = api_client.post("/bff/auth/oauth/google/complete/", {"code": "x", "state": "y"}, format="json")
    assert response.status_code == 403


def test_link_mode_links_to_the_signed_in_account(api_client, web, google, user):
    from university.core.testing import authenticate

    tokens = authenticate(api_client, user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    _, query = start(api_client, web, mode="link")
    response = api_client.post(
        "/bff/auth/oauth/google/complete/", {"code": "good-code", "state": query["state"][0]}, format="json", **web
    )
    assert response.status_code == 201 and response.json() == {"linked": True}
    assert api_client.get("/api/v1/me/identities/").json()[0]["provider"] == "google"


def test_yahoo_hosted_mailboxes_count_as_verified():
    provider = oauth.YahooProvider.__new__(oauth.YahooProvider)
    provider.key, provider.client_id, provider.client_secret = "yahoo", "c", "s"
    provider.exchange = lambda code, verifier: {"id_token": "t"}

    class Verifier:
        def authenticate(self, credential):
            return ExternalProfile(subject="y1", email="ada@yahoo.com", email_verified=False)

    provider._verifier = Verifier()
    assert provider.authenticate({"code": "c", "code_verifier": "v", "nonce": "n"}).email_verified is True


def test_github_uses_the_primary_verified_email(monkeypatch):
    provider = oauth.GitHubProvider(key="github", client_id="c", client_secret="s")
    monkeypatch.setattr(provider, "exchange", lambda code, verifier: {"access_token": "gho_x"})
    responses = {
        "https://api.github.com/user": {"id": 42, "login": "ada", "name": "Ada"},
        "https://api.github.com/user/emails": [
            {"email": "old@example.com", "verified": False, "primary": False},
            {"email": "Ada@Example.com", "verified": True, "primary": True},
        ],
    }
    monkeypatch.setattr(oauth, "http_request", lambda method, url, **kw: responses[url])
    profile = provider.authenticate({"code": "c", "code_verifier": "v"})
    assert (profile.subject, profile.email, profile.email_verified) == ("42", "ada@example.com", True)


# ------------------------------------------------------------------------ YouTube
@pytest.mark.parametrize(
    "link",
    [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10",
        "https://youtu.be/dQw4w9WgXcQ?si=abc",
        "youtube.com/shorts/dQw4w9WgXcQ",
        "https://www.youtube.com/live/dQw4w9WgXcQ",
        "dQw4w9WgXcQ",
    ],
)
def test_video_links(link):
    assert parse_video_id(link) == "dQw4w9WgXcQ"


def test_bad_links_and_channels():
    from university.core.exceptions import ValidationError

    for bad in ("https://evil.example/watch?v=dQw4w9WgXcQ", "https://youtube.com/watch?v=short", ""):
        with pytest.raises(ValidationError):
            parse_video_id(bad)
    assert parse_channel_id("https://www.youtube.com/channel/UC1234567890123456789012") == "UC1234567890123456789012"
    with pytest.raises(ValidationError):
        parse_channel_id("@gistloop")


@pytest.fixture
def owner(api_client, user):
    """An API client signed in as ``user``."""
    return as_user(api_client, user)


@pytest.fixture
def podcast(user):
    from university.podcast import services

    show = services.create_podcast(owner=user, data={"title": "Campus Talk", "description": "Gist and gists."})
    return services.set_podcast_status(actor=user, podcast_id=show.pk, action="publish")


def test_youtube_only_episode_can_be_published(owner, user, podcast):
    from university.podcast import services

    episode = services.create_episode(actor=user, podcast_id=podcast.pk, data={"title": "Exam season"})
    url = f"/api/v1/youtube/episodes/{episode.pk}/"
    # University itself refuses: there's no upload.
    assert owner.post(f"/api/v1/podcasts/episodes/{episode.pk}/publish/", {}, format="json").status_code == 400
    assert owner.put(url, {"url": "https://youtu.be/dQw4w9WgXcQ"}, format="json").json()["video_id"] == ("dQw4w9WgXcQ")
    response = owner.post(f"{url}publish/", {}, format="json")
    assert response.status_code == 200 and response.json()["status"] == "published"
    listed = owner.get("/api/v1/youtube/episodes/", {"podcast": str(podcast.pk)}).json()
    assert listed == [
        {
            "episode_id": str(episode.pk),
            "video_id": "dQw4w9WgXcQ",
            "watch_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "imported": False,
        }
    ]
    # A published, public episode is queued for the social pages automatically.
    item = SyndicationItem.objects.get(kind=Kind.PODCAST_EPISODE, object_id=str(episode.pk))
    assert item.status == ItemStatus.APPROVED and item.link_url.endswith(f"/podcasts/episode/{episode.pk}")


def test_only_managers_attach_videos(api_client, other_user, user, podcast):
    from university.core.testing import authenticate
    from university.podcast import services

    episode = services.create_episode(actor=user, podcast_id=podcast.pk, data={"title": "Draft"})
    tokens = authenticate(api_client, other_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    response = api_client.put(f"/api/v1/youtube/episodes/{episode.pk}/", {"url": "dQw4w9WgXcQ"}, format="json")
    assert response.status_code in (403, 404)
    assert not EpisodeVideo.objects.exists()


FEED = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/"
      xmlns="http://www.w3.org/2005/Atom">
 <entry><yt:videoId>AAAAAAAAAAA</yt:videoId><title>Old upload</title>
  <published>2020-01-01T00:00:00+00:00</published></entry>
 <entry><yt:videoId>BBBBBBBBBBB</yt:videoId><title>Freshers week vlog</title>
  <published>{new}</published><media:group><media:description>All the gist.</media:description></media:group></entry>
</feed>"""


def test_channel_import_creates_draft_episodes(owner, user, podcast, monkeypatch):
    from gistloop.youtube import services

    url = f"/api/v1/youtube/podcasts/{podcast.pk}/channel/"
    channel = "UC" + "x" * 22
    assert owner.put(url, {"channel": channel}, format="json").json()["channel_id"] == channel
    new = (timezone.now() + dt.timedelta(minutes=1)).isoformat()
    monkeypatch.setattr(services, "http_request", lambda *a, **k: FEED.replace("{new}", new))
    assert owner.post(f"{url}sync/").json() == {"imported": 1}
    video = EpisodeVideo.objects.get()
    assert video.video_id == "BBBBBBBBBBB" and video.imported and video.episode.status == "draft"
    assert video.episode.title == "Freshers week vlog"
    assert owner.post(f"{url}sync/").json() == {"imported": 0}  # Never twice.


# --------------------------------------------------------------- social publishing
def test_channels_turn_on_with_their_keys():
    assert syndication_from_env({})["CHANNELS"] == {}
    env = {
        "TELEGRAM_BOT_TOKEN": "t",
        "TELEGRAM_CHAT_ID": "@gistloop",
        "FACEBOOK_PAGE_ID": "1",
        "FACEBOOK_PAGE_ACCESS_TOKEN": "p",
        "INSTAGRAM_USER_ID": "17",
    }
    channels = syndication_from_env(env)["CHANNELS"]
    assert set(channels) == {"telegram", "facebook", "instagram"}
    assert channels["instagram"]["access_token"] == "p"  # Falls back to the Page token.


def test_x_oauth1_signature_is_well_formed():
    header = syndication_channels.oauth1_header(
        "POST", "https://api.x.com/2/tweets", consumer_key="ck", consumer_secret="cs", token="t", token_secret="ts"
    )
    assert (
        header.startswith("OAuth ") and 'oauth_signature="' in header and 'oauth_signature_method="HMAC-SHA1"' in header
    )


@pytest.fixture
def gist(user):
    """An anonymous post in a community, by ``user``."""
    from university.anonymous.services import create_post
    from university.community.services import create_community

    type(user).objects.filter(pk=user.pk).update(created_at=timezone.now() - dt.timedelta(days=3))
    user.refresh_from_db()
    community = create_community(creator=user, data={"name": "Night Owls", "description": "Late-night gist."})
    return create_post(
        author=user, body="Who else is still in the library at 2am?", visibility="community", audience_id=community.pk
    )


@pytest.fixture
def editor(db):
    from university.permissions.services import assign_role

    person = create_user("editor@example.com", handle="editor")
    assign_role(user=person, role_key="social_media_editor")
    return person


def as_user(client, person):
    from university.core.testing import authenticate

    client.credentials(HTTP_AUTHORIZATION=f"Bearer {authenticate(client, person)['access']}")
    return client


def test_anonymous_gist_needs_the_author_and_an_editor(
    api_client, user, other_user, editor, gist, settings, monkeypatch
):
    share = f"/api/v1/syndication/anonymous/{gist.pk}/share/"
    # Only the author can put it forward, and nothing records who they are.
    assert as_user(api_client, other_user).post(share).status_code == 404
    assert as_user(api_client, user).post(share).status_code == 201
    item = SyndicationItem.objects.get()
    assert item.status == ItemStatus.PENDING_REVIEW and item.reviewed_by is None
    assert not [f.name for f in SyndicationItem._meta.fields if f.name in {"author", "user", "requested_by"}]
    status = api_client.get("/api/v1/syndication/anonymous/share-status/", {"ids": str(gist.pk)}).json()
    assert status == {"statuses": {str(gist.pk): "pending_review"}}
    # Other people can't see the queue.
    assert api_client.get("/api/v1/syndication/items/").status_code == 403

    sent: list[tuple[str, dict[str, Any]]] = []

    def fake_http(method, url, **kwargs):
        sent.append((url, kwargs))
        return {"ok": True, "result": {"message_id": 7}}

    monkeypatch.setattr(syndication_channels, "http_request", fake_http)
    settings.GISTLOOP = {
        **settings.GISTLOOP,
        "SYNDICATION": {
            **settings.GISTLOOP["SYNDICATION"],
            "CHANNELS": {"telegram": {"bot_token": "123:abc", "chat_id": "@gistloop"}},
        },
    }
    as_user(api_client, editor)
    queue = api_client.get("/api/v1/syndication/items/", {"status": "pending_review"}).json()
    assert queue["count"] == 1
    response = api_client.post(f"/api/v1/syndication/items/{item.pk}/approve/", {}, format="json")
    assert response.status_code == 200, response.json()
    item.refresh_from_db()
    assert item.status == ItemStatus.SENT and item.card
    delivery = Delivery.objects.get()
    assert delivery.channel == "telegram" and delivery.external_url == "https://t.me/gistloop/7"
    url, kwargs = sent[0]
    assert url.endswith("/sendPhoto") and "2am" in kwargs["json_body"]["caption"]

    # The author deletes the post: it comes down from Telegram too.
    from university.anonymous.services import delete_own_post

    delete_own_post(user=user, post_id=gist.pk)
    item.refresh_from_db()
    assert item.status == ItemStatus.TAKEN_DOWN
    assert sent[-1][0].endswith("/deleteMessage")


def test_a_declined_gist_is_never_sent(api_client, user, editor, gist):
    as_user(api_client, user).post(f"/api/v1/syndication/anonymous/{gist.pk}/share/")
    item = SyndicationItem.objects.get()
    as_user(api_client, editor)
    response = api_client.post(
        f"/api/v1/syndication/items/{item.pk}/reject/", {"note": "Names a student"}, format="json"
    )
    assert response.json()["status"] == "rejected"
    assert api_client.post(f"/api/v1/syndication/items/{item.pk}/approve/", {}, format="json").status_code == 409


def test_tiktok_only_takes_video():
    tiktok = syndication_channels.TikTok({})
    assert not tiktok.applies(syndication_channels.Post(kind="podcast_episode", text="t", link="l"))
    assert tiktok.applies(syndication_channels.Post(kind="podcast_episode", text="t", link="l", video_url="https://v"))


# ------------------------------------------------------------- code sign-in, staff
def test_sign_in_with_an_emailed_code(api_client, web, user, outbox):
    response = api_client.post("/bff/auth/passwordless/", {"identifier": user.email}, format="json", **web)
    assert response.status_code == 202
    challenge = response.json()["challenge_id"]
    import re

    code = re.search(r"\b(\d{6})\b", outbox[-1].body).group(1)
    response = api_client.post(
        "/bff/auth/passwordless/verify/", {"challenge_id": challenge, "code": code}, format="json", **web
    )
    assert response.status_code == 200, response.json()
    assert response.cookies["gl_rt"].value.startswith("rt_") and "refresh" not in response.json()


def test_unknown_accounts_get_the_same_answer(api_client, web):
    response = api_client.post("/bff/auth/passwordless/", {"identifier": "nobody@example.com"}, format="json", **web)
    assert response.status_code == 202


def test_active_restrictions_are_staff_only(api_client, user, editor):
    assert as_user(api_client, user).get("/api/v1/platform/restrictions/").status_code == 403
