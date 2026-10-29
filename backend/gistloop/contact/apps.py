from __future__ import annotations

import datetime as dt
from collections.abc import Iterable

from django.conf import settings
from django.utils import timezone
from university.core.declarations import RetentionPolicy
from university.core.modules import UniversityAppConfig


def _days(name: str, default: int) -> int:
    return int(getattr(settings, "GISTLOOP", {}).get(name, default))


class ContactConfig(UniversityAppConfig):
    name = "gistloop.contact"
    label = "gistloop_contact"
    verbose_name = "GistLoop contact and newsletter"
    module_name = "site"
    module_version = "1.0.0"
    api_prefix = "site/"
    api_urlconfs = {"v1": "gistloop.contact.urls"}

    def get_retention_policies(self) -> Iterable[RetentionPolicy]:
        from university.core.retention import delete_queryset

        from gistloop.contact.models import ContactMessage, NewsletterSubscription, SubscriptionStatus

        def days_ago(name: str, default: int):
            return lambda: timezone.now() - dt.timedelta(days=_days(name, default))

        return [
            RetentionPolicy(
                name="gistloop.contact_messages",
                description="Contact-form messages, once old.",
                setting="GISTLOOP.CONTACT_RETENTION_DAYS",
                cutoff=days_ago("CONTACT_RETENTION_DAYS", 365),
                purge=lambda c, dry: delete_queryset(ContactMessage.objects.filter(created_at__lt=c), dry),
            ),
            RetentionPolicy(
                name="gistloop.unconfirmed_subscriptions",
                description="Newsletter sign-ups that were never confirmed.",
                setting="GISTLOOP.UNCONFIRMED_SUBSCRIPTION_DAYS",
                cutoff=days_ago("UNCONFIRMED_SUBSCRIPTION_DAYS", 7),
                purge=lambda c, dry: delete_queryset(
                    NewsletterSubscription.objects.filter(status=SubscriptionStatus.PENDING, created_at__lt=c), dry
                ),
            ),
            RetentionPolicy(
                name="gistloop.unsubscribed",
                description="Addresses that unsubscribed.",
                setting="GISTLOOP.UNSUBSCRIBED_RETENTION_DAYS",
                cutoff=days_ago("UNSUBSCRIBED_RETENTION_DAYS", 30),
                purge=lambda c, dry: delete_queryset(
                    NewsletterSubscription.objects.filter(status=SubscriptionStatus.UNSUBSCRIBED, updated_at__lt=c),
                    dry,
                ),
            ),
        ]
