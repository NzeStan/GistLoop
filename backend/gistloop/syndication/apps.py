from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from university.core.declarations import PermissionDef, RoleDef
from university.core.modules import UniversityAppConfig

REVIEW_PERMISSION = "syndication.review"


def _episode_published(event: Any) -> None:
    from gistloop.syndication.services import queue_episode

    queue_episode(event.payload.get("episode_id"))


def _anonymous_post_deleted(event: Any) -> None:
    from gistloop.syndication.models import Kind
    from gistloop.syndication.services import take_down_source

    take_down_source(Kind.ANONYMOUS_POST, event.payload.get("post_id"), "The author deleted the post.")


def _moderation_action(event: Any) -> None:
    from gistloop.syndication.models import Kind
    from gistloop.syndication.services import take_down_source

    kinds = {"anonymous.post": Kind.ANONYMOUS_POST, "podcast.episode": Kind.PODCAST_EPISODE}
    kind = kinds.get(event.payload.get("content_type"))
    if kind and event.payload.get("action") in {"hide", "remove"}:
        take_down_source(kind, event.payload.get("object_id"), "Hidden or removed by the moderators.")


class SyndicationConfig(UniversityAppConfig):
    """Share anonymous gist and podcast episodes on GistLoop's Facebook Page, Instagram, X, Telegram
    and TikTok accounts."""

    name = "gistloop.syndication"
    label = "gistloop_syndication"
    verbose_name = "GistLoop social media publishing"
    module_name = "syndication"
    module_version = "1.0.0"
    module_requires = ("core", "anonymous", "podcast", "moderation")
    api_prefix = "syndication/"
    api_urlconfs = {"v1": "gistloop.syndication.urls"}

    def get_permissions(self) -> Iterable[PermissionDef]:
        return [PermissionDef(REVIEW_PERMISSION, "Review and send posts to GistLoop's social media accounts.")]

    def get_roles(self) -> Iterable[RoleDef]:
        return [
            RoleDef(
                key="social_media_editor",
                name="Social media editor",
                scope_type="platform",
                permissions=(REVIEW_PERMISSION,),
                description="Approves what GistLoop shares on its social media accounts.",
            )
        ]

    def register_event_handlers(self, bus: Any) -> None:
        bus.subscribe("podcast.episode.published", _episode_published)
        bus.subscribe("anonymous.post.deleted", _anonymous_post_deleted)
        bus.subscribe("moderation.action.taken", _moderation_action)
