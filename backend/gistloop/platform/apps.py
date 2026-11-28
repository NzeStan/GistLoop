"""Platform wiring that belongs to no single feature."""

from __future__ import annotations

from importlib import import_module

from university.core.modules import UniversityAppConfig

#: Modules whose University tasks are only registered when the module is imported. The Celery worker
#: and beat look tasks up by name, so each must be imported at start-up or the job fails with
#: "Unknown University task".
TASK_MODULES = (
    "university.core.retention",
    "university.core.providers.email",
    "university.security.services.otp",
    "university.creator.services.accounts",
    "university.events.services.notices",
    "university.events.services.registrations",
    "university.institution.services.announcements",
    "university.marketplace.services",
    "university.media.services",
    "university.notifications.delivery",
    "university.opportunities.services",
    "university.payments.services",
    "university.podcast.services",
    "university.promotions.integrations",
    "university.search.indexing",
    "university.subscriptions.integrations",
    "university.trending.services",
    "gistloop.youtube.tasks",
    "gistloop.syndication.tasks",
)


class PlatformConfig(UniversityAppConfig):
    name = "gistloop.platform"
    label = "gistloop_platform"
    verbose_name = "GistLoop platform"
    module_name = "platform"
    module_version = "1.0.0"
    module_requires = ("core", "moderation")
    api_prefix = "platform/"
    api_urlconfs = {"v1": "gistloop.platform.urls"}

    def ready(self) -> None:
        super().ready()
        for module in TASK_MODULES:
            import_module(module)
