"""Share anonymous gist (with the author's consent and an editor's approval) and new podcast episodes on
GistLoop's own social media accounts."""

from __future__ import annotations

from typing import Any
from urllib.parse import urljoin

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from university.audit.services import record as audit
from university.core.exceptions import Conflict, NotFound, ProviderError, ValidationError
from university.core.tasks import enqueue

from gistloop.syndication import channels as channel_registry
from gistloop.syndication.cards import render_card
from gistloop.syndication.models import Delivery, DeliveryStatus, ItemStatus, Kind, SyndicationItem

MAX_ATTEMPTS = 5


def _config() -> dict[str, Any]:
    return channel_registry.config()


def absolute(url: str) -> str:
    base = _config().get("PUBLIC_BASE_URL") or settings.FRONTEND_URL
    return urljoin(base.rstrip("/") + "/", url.lstrip("/")) if url and "://" not in url else url


# ---------------------------------------------------------------- the sources
def _anonymous_post(post_id: Any) -> Any:
    from university.anonymous.models import AnonymousPost, ContentStatus

    post = AnonymousPost.objects.filter(pk=post_id).first()
    if post is None or post.deleted_at is not None or post.status != ContentStatus.PUBLISHED:
        return None
    return post


def _public_episode(episode_id: Any) -> Any:
    from university.podcast.models import Episode
    from university.podcast.selectors import can_view_episode

    episode = Episode.objects.filter(pk=episode_id).select_related("podcast").first()
    # Only what anyone may see on GistLoop goes to public social media.
    if episode is None or not can_view_episode(AnonymousUser(), episode):
        return None
    return episode


def source_is_live(item: SyndicationItem) -> bool:
    if item.kind == Kind.ANONYMOUS_POST:
        return _anonymous_post(item.object_id) is not None
    return _public_episode(item.object_id) is not None


# ---------------------------------------------------------------- anonymous gist
@transaction.atomic
def nominate_anonymous_post(*, user: Any, post_id: Any) -> SyndicationItem:
    """The author asks for their gist to be shared on GistLoop's social pages (an editor reviews it).

    Anonymous gist is only ever posted to a campus, institution or community audience on GistLoop, so
    nothing goes to public social media without the author choosing it. Nothing stored here links the
    item to the author.
    """
    from university.anonymous.selectors import is_post_author

    post = _anonymous_post(post_id)
    if post is None or not is_post_author(user, post):
        raise NotFound("Post not found.")
    existing = SyndicationItem.objects.filter(kind=Kind.ANONYMOUS_POST, object_id=str(post.pk)).first()
    if existing is not None:
        return existing
    return SyndicationItem.objects.create(
        kind=Kind.ANONYMOUS_POST,
        object_id=str(post.pk),
        text=post.body,
        link_url=settings.FRONTEND_URL + "/gist",
        status=ItemStatus.PENDING_REVIEW,
    )


@transaction.atomic
def withdraw_anonymous_post(*, user: Any, post_id: Any) -> None:
    """The author changes their mind: unsent items are dropped, sent ones are taken down."""
    from university.anonymous.models import AnonymousPost
    from university.anonymous.selectors import is_post_author

    post = AnonymousPost.objects.filter(pk=post_id, deleted_at__isnull=True).first()
    if post is None or not is_post_author(user, post):
        raise NotFound("Post not found.")
    item = SyndicationItem.objects.filter(kind=Kind.ANONYMOUS_POST, object_id=str(post.pk)).first()
    if item is None:
        return
    if item.status in {ItemStatus.PENDING_REVIEW, ItemStatus.REJECTED}:
        item.delete()
    else:
        _take_down(item, note="Withdrawn by the author.")


def anonymous_share_status(*, user: Any, post_ids: list[str]) -> dict[str, str]:
    """For the author's own posts: which are shared, waiting or declined."""
    from university.anonymous.selectors import authored_ids

    mine = authored_ids(user, "post", post_ids)
    items = SyndicationItem.objects.filter(kind=Kind.ANONYMOUS_POST, object_id__in=mine)
    return {item.object_id: item.status for item in items}


# --------------------------------------------------------------- podcast episodes
def queue_episode(episode_id: Any) -> SyndicationItem | None:
    """Called when an episode is published: public episodes are shared (automatically by default)."""
    episode = _public_episode(episode_id)
    if episode is None:
        return None
    podcast = episode.podcast
    auto = bool(_config().get("AUTO_APPROVE_PODCASTS", True))
    item, created = SyndicationItem.objects.get_or_create(
        kind=Kind.PODCAST_EPISODE,
        object_id=str(episode.pk),
        defaults={
            "title": episode.title[:200],
            "text": "\n\n".join(p for p in (f"New episode of {podcast.title}: {episode.title}", episode.summary) if p),
            "link_url": f"{settings.FRONTEND_URL}/podcasts/episode/{episode.pk}",
            "video_media_id": episode.video_media_id or "",
            "status": ItemStatus.APPROVED if auto else ItemStatus.PENDING_REVIEW,
            "reviewed_at": timezone.now() if auto else None,
        },
    )
    if created and item.status == ItemStatus.APPROVED:
        transaction.on_commit(lambda: enqueue("gistloop.syndication.deliver_item", str(item.pk)))
    return item


# --------------------------------------------------------------------- reviewing
@transaction.atomic
def approve(*, actor: Any, item: SyndicationItem) -> SyndicationItem:
    if item.status != ItemStatus.PENDING_REVIEW:
        raise Conflict("Only items waiting for review can be approved.", code="not_pending")
    if not source_is_live(item):
        item.status, item.review_note = ItemStatus.REJECTED, "The original was deleted or hidden."
        item.save(update_fields=["status", "review_note", "updated_at"])
        raise Conflict("The original was deleted or hidden, so it can't be shared.", code="source_gone")
    item.status, item.reviewed_by, item.reviewed_at = ItemStatus.APPROVED, actor, timezone.now()
    item.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
    audit("syndication.approved", actor=actor, target_type="syndication_item", target_id=item.pk, category="moderation")
    transaction.on_commit(lambda: enqueue("gistloop.syndication.deliver_item", str(item.pk)))
    return item


@transaction.atomic
def reject(*, actor: Any, item: SyndicationItem, note: str = "") -> SyndicationItem:
    if item.status != ItemStatus.PENDING_REVIEW:
        raise Conflict("Only items waiting for review can be declined.", code="not_pending")
    item.status, item.reviewed_by, item.reviewed_at, item.review_note = (
        ItemStatus.REJECTED,
        actor,
        timezone.now(),
        note[:255],
    )
    item.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_note", "updated_at"])
    audit("syndication.rejected", actor=actor, target_type="syndication_item", target_id=item.pk, category="moderation")
    return item


@transaction.atomic
def retry(*, actor: Any, item: SyndicationItem) -> SyndicationItem:
    if item.status not in {ItemStatus.APPROVED, ItemStatus.SENT}:
        raise Conflict("Only approved items can be retried.", code="not_approved")
    item.deliveries.filter(status=DeliveryStatus.FAILED).update(status=DeliveryStatus.PENDING, attempts=0, error="")
    item.status = ItemStatus.APPROVED
    item.save(update_fields=["status", "updated_at"])
    transaction.on_commit(lambda: enqueue("gistloop.syndication.deliver_item", str(item.pk)))
    return item


def take_down(*, actor: Any, item: SyndicationItem, note: str = "") -> SyndicationItem:
    _take_down(item, note=note or "Taken down by an editor.")
    audit(
        "syndication.taken_down", actor=actor, target_type="syndication_item", target_id=item.pk, category="moderation"
    )
    return item


def _take_down(item: SyndicationItem, *, note: str) -> None:
    """Delete the posts where the platform allows it (Instagram and TikTok don't)."""
    enabled = channel_registry.enabled_channels()
    for delivery in item.deliveries.filter(status=DeliveryStatus.SENT):
        channel = enabled.get(delivery.channel)
        try:
            removed = bool(channel and delivery.external_id and channel.remove(delivery.external_id))
        except ProviderError as exc:
            removed = False
            delivery.error = f"Couldn't delete: {exc.code}"[:500]
        if removed:
            delivery.status = DeliveryStatus.REMOVED
        elif not delivery.error:
            delivery.error = "Delete it on the platform by hand (its API doesn't allow deleting)."
        delivery.save(update_fields=["status", "error", "updated_at"])
    item.deliveries.filter(status__in=[DeliveryStatus.PENDING, DeliveryStatus.FAILED]).update(
        status=DeliveryStatus.SKIPPED
    )
    item.status, item.review_note = ItemStatus.TAKEN_DOWN, note[:255]
    item.save(update_fields=["status", "review_note", "updated_at"])


def take_down_source(kind: str, object_id: Any, note: str) -> None:
    item = SyndicationItem.objects.filter(kind=kind, object_id=str(object_id)).first()
    if item is None:
        return
    if item.status in {ItemStatus.PENDING_REVIEW, ItemStatus.REJECTED}:
        item.delete()
    elif item.status != ItemStatus.TAKEN_DOWN:
        _take_down(item, note=note)


# ---------------------------------------------------------------------- sending
def _ensure_card(item: SyndicationItem) -> None:
    if item.card:
        return
    brand = _config()
    if item.kind == Kind.ANONYMOUS_POST:
        eyebrow, body = "Anonymous gist", item.text
    else:
        episode = _public_episode(item.object_id)
        eyebrow = f"New episode - {episode.podcast.title}" if episode else "New episode"
        body = item.title or item.text
    image = render_card(
        eyebrow=eyebrow[:60],
        body=body,
        footer=brand.get("CARD_FOOTER") or "GistLoop - catch the conversation",
        primary=brand.get("BRAND_PRIMARY", "#6D28D9"),
        accent=brand.get("BRAND_ACCENT", "#FF6B57"),
    )
    item.card.save(f"{item.pk}.jpg", ContentFile(image), save=False)
    item.save(update_fields=["card", "updated_at"])


def _video_url(item: SyndicationItem) -> str:
    if not item.video_media_id:
        return ""
    from university.core.media import get_media_library

    library = get_media_library()
    if library is None:
        return ""
    return absolute(library.url(item.video_media_id, ttl_seconds=24 * 3600))


def deliver(item_id: Any) -> int:
    """Send an approved item to every configured channel. Safe to re-run: sent channels are skipped."""
    item = SyndicationItem.objects.filter(pk=item_id, status=ItemStatus.APPROVED).first()
    if item is None:
        return 0
    if not source_is_live(item):
        _take_down(item, note="The original was deleted or hidden before it was sent.")
        return 0
    enabled = channel_registry.enabled_channels()
    if not enabled:
        return 0
    _ensure_card(item)
    post = channel_registry.Post(
        kind=item.kind,
        text=item.text,
        link=item.link_url,
        title=item.title,
        image_url=absolute(item.card.url) if item.card else "",
        video_url=_video_url(item),
    )
    sent = 0
    for key, channel in enabled.items():
        delivery, _ = Delivery.objects.get_or_create(item=item, channel=key)
        if delivery.status in {DeliveryStatus.SENT, DeliveryStatus.SKIPPED, DeliveryStatus.REMOVED}:
            continue
        if delivery.attempts >= MAX_ATTEMPTS:
            continue
        if not channel.applies(post):
            delivery.status = DeliveryStatus.SKIPPED
            delivery.error = "Not applicable (TikTok needs an uploaded video; Instagram needs an image)."
            delivery.save(update_fields=["status", "error", "updated_at"])
            continue
        delivery.attempts += 1
        try:
            published = channel.publish(post)
        except (ProviderError, KeyError, TypeError, ValueError) as exc:
            delivery.status = DeliveryStatus.FAILED
            code = getattr(exc, "code", type(exc).__name__)
            details = getattr(exc, "details", None) or {}
            delivery.error = f"{code} {details.get('status', '')}".strip()[:500]
        else:
            delivery.status, delivery.error = DeliveryStatus.SENT, ""
            delivery.external_id, delivery.external_url = published.external_id[:200], published.external_url[:500]
            delivery.sent_at = timezone.now()
            sent += 1
        delivery.save()
    outstanding = (
        item.deliveries.filter(status=DeliveryStatus.PENDING).exists()
        or item.deliveries.filter(status=DeliveryStatus.FAILED, attempts__lt=MAX_ATTEMPTS).exists()
    )
    if not outstanding:
        item.status = ItemStatus.SENT
        item.save(update_fields=["status", "updated_at"])
    return sent


def retry_failed() -> int:
    """Re-send items that failed on some channel (scheduled; each channel gets up to five tries)."""
    ids = (
        Delivery.objects.filter(
            status=DeliveryStatus.FAILED, attempts__lt=MAX_ATTEMPTS, item__status=ItemStatus.APPROVED
        )
        .values_list("item_id", flat=True)
        .distinct()
    )
    return sum(deliver(item_id) for item_id in list(ids))


def channel_status() -> list[dict[str, Any]]:
    enabled = channel_registry.enabled_channels()
    return [
        {"key": key, "name": cls.name, "enabled": key in enabled, "video_only": cls.video_only}
        for key, cls in channel_registry.CHANNEL_CLASSES.items()
    ]


def validate_note(note: Any) -> str:
    if note is not None and not isinstance(note, str):
        raise ValidationError(details={"note": ["Must be text."]})
    return (note or "")[:255]
