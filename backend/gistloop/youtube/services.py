"""Attach YouTube videos to podcast episodes, publish video-only episodes, and import channel uploads."""

from __future__ import annotations

import datetime as dt
import re
import xml.etree.ElementTree as ET
from typing import Any
from urllib.parse import parse_qs, urlsplit

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from university.audit.services import record as audit
from university.core.exceptions import PermissionDenied, ProviderError, UniversityError, ValidationError
from university.core.providers.http import request as http_request
from university.permissions.services import authorize
from university.podcast import services as podcast_services
from university.podcast.constants import EpisodeStatus
from university.podcast.models import Episode, Podcast
from university.podcast.selectors import podcast_scope

from gistloop.youtube.models import EpisodeVideo, PodcastChannel

VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
CHANNEL_ID = re.compile(r"^UC[A-Za-z0-9_-]{22}$")
YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "www.youtube-nocookie.com",
    "youtube-nocookie.com",
}
FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
_NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "yt": "http://www.youtube.com/xml/schemas/2015",
    "media": "http://search.yahoo.com/mrss/",
}


def parse_video_id(value: str) -> str:
    """The 11-character video ID from a YouTube link (watch, youtu.be, shorts, live, embed) or a bare ID."""
    value = (value or "").strip()
    if VIDEO_ID.match(value):
        return value
    parts = urlsplit(value if "://" in value else f"https://{value}")
    host = (parts.hostname or "").lower()
    if host in YOUTUBE_HOSTS:
        if host == "youtu.be":
            candidate = parts.path.strip("/").split("/")[0]
        elif parts.path == "/watch":
            candidate = (parse_qs(parts.query).get("v") or [""])[0]
        else:
            segments = [s for s in parts.path.split("/") if s]
            candidate = segments[1] if len(segments) >= 2 and segments[0] in {"shorts", "live", "embed", "v"} else ""
        if VIDEO_ID.match(candidate):
            return candidate
    raise ValidationError(details={"url": ["Paste a YouTube video link, e.g. https://youtu.be/..."]})


def parse_channel_id(value: str) -> str:
    """A channel ID (UC...), from the ID itself or a youtube.com/channel/UC... link."""
    match = re.search(r"(UC[A-Za-z0-9_-]{22})(?![A-Za-z0-9_-])", (value or "").strip())
    if match:
        return match.group(1)
    raise ValidationError(
        details={
            "channel": [
                "Use the channel ID, which starts with UC. YouTube Studio shows it under "
                "Settings > Channel > Advanced settings."
            ]
        }
    )


def _manage(actor: Any, podcast: Podcast) -> None:
    authorize(actor, "podcast.manage", podcast_scope(podcast), audit_denial=True)


@transaction.atomic
def set_episode_video(*, actor: Any, episode: Episode, url: str) -> EpisodeVideo:
    _manage(actor, episode.podcast)
    video_id = parse_video_id(url)
    if EpisodeVideo.objects.filter(video_id=video_id).exclude(episode=episode).exists():
        raise ValidationError(details={"url": ["That video is already attached to another episode."]})
    video, _ = EpisodeVideo.objects.update_or_create(episode=episode, defaults={"video_id": video_id})
    audit("youtube.video_set", actor=actor, target=episode, category="podcast", metadata={"video_id": video_id})
    return video


@transaction.atomic
def remove_episode_video(*, actor: Any, episode: Episode) -> None:
    _manage(actor, episode.podcast)
    EpisodeVideo.objects.filter(episode=episode).delete()
    audit("youtube.video_removed", actor=actor, target=episode, category="podcast")


@transaction.atomic
def publish_episode(*, actor: Any, episode_id: Any, publish_at: dt.datetime | None = None) -> Episode:
    """Publish an episode.

    Episodes with uploaded audio or video go through University unchanged. An episode whose only media
    is a YouTube video is published here, because University requires an upload.
    """
    episode = Episode.objects.select_for_update().select_related("podcast").get(pk=episode_id)
    if episode.audio_media_id or episode.video_media_id:
        return podcast_services.publish_episode(actor=actor, episode_id=episode_id, publish_at=publish_at)
    _manage(actor, episode.podcast)
    if episode.hidden_at:
        raise PermissionDenied("This episode was hidden by the moderators.", code="episode_hidden")
    if not EpisodeVideo.objects.filter(episode=episode).exists():
        raise ValidationError("Add audio, video or a YouTube link first.", code="media_required")
    if publish_at and publish_at > timezone.now():
        # University's publish_due_episodes job releases it at publish_at.
        episode.status = EpisodeStatus.SCHEDULED
        episode.publish_at = publish_at
        episode.save(update_fields=["status", "publish_at", "updated_at"])
    else:
        # University's own go-live step: status, the "published" event and subscriber notices.
        podcast_services._go_live(episode)
    audit("podcast.episode.published", actor=actor, target=episode, category="podcast", metadata={"via": "youtube"})
    return episode


@transaction.atomic
def connect_channel(*, actor: Any, podcast: Podcast, channel: str, auto_import: bool = True) -> PodcastChannel:
    _manage(actor, podcast)
    channel_id = parse_channel_id(channel)
    record = PodcastChannel.objects.filter(podcast=podcast).first()
    if record is None:
        record = PodcastChannel(podcast=podcast, import_since=timezone.now())
    elif record.channel_id != channel_id:
        record.import_since = timezone.now()
        record.last_error = ""
    record.channel_id, record.auto_import, record.connected_by = channel_id, auto_import, actor
    record.save()
    audit(
        "youtube.channel_connected",
        actor=actor,
        target=podcast,
        category="podcast",
        metadata={"channel_id": channel_id},
    )
    return record


@transaction.atomic
def disconnect_channel(*, actor: Any, podcast: Podcast) -> None:
    _manage(actor, podcast)
    PodcastChannel.objects.filter(podcast=podcast).delete()


def fetch_channel_feed(channel_id: str) -> list[dict[str, Any]]:
    """The channel's latest uploads (YouTube's public Atom feed: no API key, about 15 entries)."""
    raw = http_request("GET", FEED_URL.format(channel_id=channel_id), headers={"Accept": "application/atom+xml"})
    if not isinstance(raw, str):
        raise ProviderError(code="youtube_feed_invalid")
    try:
        root = ET.fromstring(raw)  # noqa: S314
    except ET.ParseError as exc:
        raise ProviderError(code="youtube_feed_invalid") from exc
    videos = []
    for entry in root.findall("atom:entry", _NS):
        video_id = entry.findtext("yt:videoId", default="", namespaces=_NS)
        published = parse_datetime(entry.findtext("atom:published", default="", namespaces=_NS) or "")
        if not VIDEO_ID.match(video_id) or published is None:
            continue
        description = entry.findtext("media:group/media:description", default="", namespaces=_NS) or ""
        videos.append(
            {
                "video_id": video_id,
                "title": (entry.findtext("atom:title", default="", namespaces=_NS) or "").strip()[:200],
                "description": description.strip(),
                "published_at": published,
            }
        )
    return videos


def sync_channel(channel: PodcastChannel) -> int:
    """Create a draft episode for each new upload. Returns how many were imported."""
    try:
        videos = fetch_channel_feed(channel.channel_id)
    except ProviderError as exc:
        PodcastChannel.objects.filter(pk=channel.pk).update(
            last_synced_at=timezone.now(), last_error=str(exc.code)[:255]
        )
        return 0
    imported, error = 0, ""
    known = set(
        EpisodeVideo.objects.filter(video_id__in=[v["video_id"] for v in videos]).values_list("video_id", flat=True)
    )
    for video in sorted(videos, key=lambda v: v["published_at"]):
        if video["video_id"] in known or video["published_at"] <= channel.import_since:
            continue
        if channel.connected_by is None:
            error = "Reconnect the channel: the person who connected it no longer has an account."
            break
        try:
            with transaction.atomic():
                description = video["description"]
                episode = podcast_services.create_episode(
                    actor=channel.connected_by,
                    podcast_id=channel.podcast_id,
                    data={
                        "title": video["title"] or "New video",
                        "summary": description[:500],
                        "show_notes": description,
                    },
                )
                EpisodeVideo.objects.create(episode=episode, video_id=video["video_id"], imported=True)
            imported += 1
        except UniversityError as exc:
            error = str(getattr(exc, "message", "") or exc.code)[:255]
    PodcastChannel.objects.filter(pk=channel.pk).update(last_synced_at=timezone.now(), last_error=error)
    return imported
