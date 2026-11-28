"""Posting to GistLoop's own social media accounts.

Each channel is switched on by its keys in the environment (see ``.env.example``) and does nothing
without them. Requests go only to the platforms' fixed HTTPS API URLs.
"""

from __future__ import annotations

import base64
import datetime as dt
import hashlib
import hmac
import secrets
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

from django.conf import settings
from django.utils import timezone
from university.core.exceptions import ProviderError
from university.core.providers.http import request as http_request


def config() -> dict[str, Any]:
    return getattr(settings, "GISTLOOP", {}).get("SYNDICATION", {})


@dataclass
class Post:
    """What a channel needs to publish one item."""

    kind: str
    text: str
    link: str
    title: str = ""
    image_url: str = ""
    video_url: str = ""


@dataclass
class Published:
    external_id: str
    external_url: str = ""


def _clip(text: str, limit: int) -> str:
    text = " ".join(text.split()) if "\n" not in text else text.strip()
    return text if len(text) <= limit else text[: max(limit - 3, 0)].rstrip() + "..."


class Channel:
    key: str
    name: str
    #: Platforms that only take video (TikTok).
    video_only = False

    def __init__(self, options: dict[str, str]) -> None:
        self.options = options

    def applies(self, post: Post) -> bool:
        return bool(post.video_url) if self.video_only else True

    def publish(self, post: Post) -> Published:
        raise NotImplementedError

    def remove(self, external_id: str) -> bool:
        """Delete the post on the platform. False when the platform doesn't allow it."""
        return False


# ------------------------------------------------------------------ Facebook Page
def _graph(path: str) -> str:
    return f"https://graph.facebook.com/{config().get('META_GRAPH_VERSION', 'v21.0')}/{path}"


class FacebookPage(Channel):
    key, name = "facebook", "Facebook Page"

    def publish(self, post: Post) -> Published:
        token, page = self.options["page_access_token"], self.options["page_id"]
        message = f"{_clip(post.text, 1800)}\n\n{post.link}"
        if post.image_url:
            data = http_request(
                "POST",
                _graph(f"{page}/photos"),
                form={"url": post.image_url, "caption": message, "access_token": token},
            )
            post_id = str(data.get("post_id") or data.get("id"))
        else:
            data = http_request(
                "POST", _graph(f"{page}/feed"), form={"message": message, "link": post.link, "access_token": token}
            )
            post_id = str(data["id"])
        return Published(post_id, f"https://www.facebook.com/{post_id}")

    def remove(self, external_id: str) -> bool:
        http_request("DELETE", _graph(f"{external_id}?access_token={quote(self.options['page_access_token'])}"))
        return True


# --------------------------------------------------------------------- Instagram
class Instagram(Channel):
    """Instagram professional account linked to the Facebook Page. Every post needs an image."""

    key, name = "instagram", "Instagram"

    def applies(self, post: Post) -> bool:
        return bool(post.image_url)

    def publish(self, post: Post) -> Published:
        token, account = self.options["access_token"], self.options["user_id"]
        caption = f"{_clip(post.text, 1900)}\n\nRead more on GistLoop: {post.link}"
        container = http_request(
            "POST",
            _graph(f"{account}/media"),
            form={"image_url": post.image_url, "caption": caption, "access_token": token},
        )["id"]
        for _ in range(10):  # Instagram fetches and processes the image before it can be published.
            state = http_request("GET", _graph(f"{container}?fields=status_code&access_token={quote(token)}"))
            if state.get("status_code") in {"FINISHED", None}:
                break
            if state.get("status_code") == "ERROR":
                raise ProviderError(code="instagram_media_error")
            time.sleep(2)
        media_id = str(
            http_request(
                "POST", _graph(f"{account}/media_publish"), form={"creation_id": container, "access_token": token}
            )["id"]
        )
        try:
            permalink = http_request("GET", _graph(f"{media_id}?fields=permalink&access_token={quote(token)}"))
            url = str(permalink.get("permalink") or "")
        except ProviderError:
            url = ""
        return Published(media_id, url)


# ----------------------------------------------------------------------------- X
def _pct(value: str) -> str:
    return quote(str(value), safe="")


def oauth1_header(
    method: str, url: str, *, consumer_key: str, consumer_secret: str, token: str, token_secret: str
) -> str:
    """OAuth 1.0a (HMAC-SHA1) Authorization header. JSON bodies aren't part of the signature."""
    params = {
        "oauth_consumer_key": consumer_key,
        "oauth_nonce": secrets.token_hex(16),
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": str(int(time.time())),
        "oauth_token": token,
        "oauth_version": "1.0",
    }
    normalized = "&".join(f"{_pct(k)}={_pct(v)}" for k, v in sorted(params.items()))
    base = "&".join([method.upper(), _pct(url), _pct(normalized)])
    key = f"{_pct(consumer_secret)}&{_pct(token_secret)}"
    params["oauth_signature"] = base64.b64encode(hmac.new(key.encode(), base.encode(), hashlib.sha1).digest()).decode()
    return "OAuth " + ", ".join(f'{_pct(k)}="{_pct(v)}"' for k, v in sorted(params.items()))


class X(Channel):
    key, name = "x", "X (Twitter)"
    TWEETS = "https://api.x.com/2/tweets"
    LINK_LENGTH = 23  # X shortens every link to 23 characters.

    def _auth(self, method: str, url: str) -> dict[str, str]:
        o = self.options
        return {
            "Authorization": oauth1_header(
                method,
                url,
                consumer_key=o["api_key"],
                consumer_secret=o["api_secret"],
                token=o["access_token"],
                token_secret=o["access_token_secret"],
            )
        }

    def publish(self, post: Post) -> Published:
        text = f"{_clip(post.text, 280 - self.LINK_LENGTH - 2)}\n\n{post.link}"
        data = http_request("POST", self.TWEETS, json_body={"text": text}, headers=self._auth("POST", self.TWEETS))
        tweet_id = str(data["data"]["id"])
        handle = self.options.get("handle", "").lstrip("@") or "i"
        return Published(tweet_id, f"https://x.com/{handle}/status/{tweet_id}")

    def remove(self, external_id: str) -> bool:
        url = f"{self.TWEETS}/{external_id}"
        http_request("DELETE", url, headers=self._auth("DELETE", url))
        return True


# ---------------------------------------------------------------------- Telegram
class Telegram(Channel):
    key, name = "telegram", "Telegram channel"

    def _api(self, method: str) -> str:
        return f"https://api.telegram.org/bot{self.options['bot_token']}/{method}"

    def publish(self, post: Post) -> Published:
        chat = self.options["chat_id"]
        if post.image_url:
            caption = f"{_clip(post.text, 1024 - len(post.link) - 2)}\n\n{post.link}"
            data = http_request(
                "POST", self._api("sendPhoto"), json_body={"chat_id": chat, "photo": post.image_url, "caption": caption}
            )
        else:
            text = f"{_clip(post.text, 4000)}\n\n{post.link}"
            data = http_request("POST", self._api("sendMessage"), json_body={"chat_id": chat, "text": text})
        message_id = str(data["result"]["message_id"])
        url = f"https://t.me/{chat.lstrip('@')}/{message_id}" if chat.startswith("@") else ""
        return Published(message_id, url)

    def remove(self, external_id: str) -> bool:
        http_request(
            "POST",
            self._api("deleteMessage"),
            json_body={"chat_id": self.options["chat_id"], "message_id": int(external_id)},
        )
        return True


# ------------------------------------------------------------------------ TikTok
class TikTok(Channel):
    """TikTok Content Posting API (Direct Post). Video only: podcast episodes with an uploaded video.

    Until TikTok audits the app, posts can only be private (``SELF_ONLY``), so that's the default.
    TikTok fetches the video from our URL, whose domain must be verified in the TikTok developer portal.
    """

    key, name = "tiktok", "TikTok"
    video_only = True
    TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"  # noqa: S105
    INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/"

    def _access_token(self) -> str:
        from gistloop.syndication.models import ChannelToken

        saved = ChannelToken.objects.filter(channel=self.key).first()
        if (
            saved
            and saved.access_token
            and saved.expires_at
            and saved.expires_at > timezone.now() + dt.timedelta(minutes=5)
        ):
            return saved.access_token
        refresh = (saved.refresh_token if saved and saved.refresh_token else "") or self.options["refresh_token"]
        data = http_request(
            "POST",
            self.TOKEN_URL,
            form={
                "client_key": self.options["client_key"],
                "client_secret": self.options["client_secret"],
                "grant_type": "refresh_token",
                "refresh_token": refresh,
            },
        )
        if not isinstance(data, dict) or "access_token" not in data:
            raise ProviderError(code="tiktok_token_refresh_failed")
        ChannelToken.objects.update_or_create(
            channel=self.key,
            defaults={
                "access_token": data["access_token"],
                "refresh_token": data.get("refresh_token") or refresh,
                "expires_at": timezone.now() + dt.timedelta(seconds=int(data.get("expires_in", 3600))),
            },
        )
        return str(data["access_token"])

    def publish(self, post: Post) -> Published:
        body = {
            "post_info": {
                "title": _clip(f"{post.text} {post.link}", 2200),
                "privacy_level": self.options.get("privacy_level") or "SELF_ONLY",
                "disable_comment": False,
            },
            "source_info": {"source": "PULL_FROM_URL", "video_url": post.video_url},
        }
        data = http_request(
            "POST",
            self.INIT_URL,
            json_body=body,
            headers={
                "Authorization": f"Bearer {self._access_token()}",
                "Content-Type": "application/json; charset=UTF-8",
            },
        )
        publish_id = (data.get("data") or {}).get("publish_id") if isinstance(data, dict) else None
        if not publish_id:
            raise ProviderError(code="tiktok_publish_failed")
        return Published(str(publish_id))


CHANNEL_CLASSES: dict[str, type[Channel]] = {c.key: c for c in (FacebookPage, Instagram, X, Telegram, TikTok)}


def enabled_channels() -> dict[str, Channel]:
    """Channels whose keys are configured."""
    channels = config().get("CHANNELS", {})
    return {key: CHANNEL_CLASSES[key](options) for key, options in channels.items() if key in CHANNEL_CLASSES}
