"""Contact form and newsletter.

Two abuse cases shape this module:

* **No auto-replies.** Emailing whatever address is typed into the contact form would let anyone
  use GistLoop to send mail to strangers. Messages go only to GistLoop's own inbox.
* **Double opt-in, no enumeration.** Signing up always gets the same answer; only the owner of the
  address can confirm it, and repeat confirmation emails are rate limited per address.
"""

from __future__ import annotations

import datetime as dt
import logging
import secrets

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from university.core.crypto import keyed_hash
from university.core.exceptions import ValidationError

from gistloop.contact.models import ContactMessage, NewsletterSubscription, SubscriptionStatus

logger = logging.getLogger("gistloop.contact")
TOKEN_PURPOSE = "gistloop.newsletter"  # noqa: S105 - an HMAC purpose label, not a secret
RESEND_COOLDOWN = dt.timedelta(minutes=10)


def _hash(token: str) -> str:
    return keyed_hash(token, purpose=TOKEN_PURPOSE)


def _send(subject: str, body: str, recipients: list[str]) -> None:
    if not recipients:
        return
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, recipients)
    except Exception:  # Email trouble must never lose the message itself.
        logger.exception("Could not send email", extra={"subject": subject})


# ------------------------------------------------------------------ contact
def submit_contact_message(*, name: str, email: str, topic: str, message: str) -> ContactMessage:
    saved = ContactMessage.objects.create(name=name.strip(), email=email.strip().lower(), topic=topic, message=message)
    recipients = list(getattr(settings, "GISTLOOP", {}).get("CONTACT_RECIPIENTS", []))
    body = (
        f"From: {saved.name} <{saved.email}>\nTopic: {saved.get_topic_display()}\n\n{saved.message}\n\n"
        f"Reference: {saved.pk}"
    )
    transaction.on_commit(lambda: _send(f"[GistLoop contact] {saved.get_topic_display()}", body, recipients))
    return saved


# --------------------------------------------------------------- newsletter
def subscribe(email: str) -> None:
    """Start (or restart) double opt-in. Says nothing about whether the address was known."""
    email = email.strip().lower()
    now = timezone.now()
    with transaction.atomic():
        subscription = NewsletterSubscription.objects.select_for_update().filter(email=email).first()
        if subscription is not None:
            if subscription.status == SubscriptionStatus.CONFIRMED:
                return
            if subscription.last_sent_at and now - subscription.last_sent_at < RESEND_COOLDOWN:
                return
        token = secrets.token_urlsafe(32)
        if subscription is None:
            subscription = NewsletterSubscription(email=email)
        subscription.status = SubscriptionStatus.PENDING
        subscription.token_hash = _hash(token)
        subscription.last_sent_at = now
        subscription.save()

    base = settings.FRONTEND_URL
    body = (
        "Thanks for signing up for the GistLoop newsletter.\n\n"
        f"Confirm your subscription: {base}/newsletter/confirm?token={token}\n\n"
        "If you didn't sign up, ignore this email and you won't hear from us again.\n\n"
        f"Unsubscribe at any time: {base}/newsletter/unsubscribe?token={token}"
    )
    transaction.on_commit(lambda: _send("Confirm your GistLoop subscription", body, [email]))


def _by_token(token: str) -> NewsletterSubscription:
    invalid = ValidationError("This link is invalid or has expired.", code="invalid_token")
    if not token or len(token) > 128:
        raise invalid
    subscription = NewsletterSubscription.objects.filter(token_hash=_hash(token)).first()
    if subscription is None:
        raise invalid
    return subscription


def confirm(token: str) -> None:
    subscription = _by_token(token)
    if subscription.status != SubscriptionStatus.CONFIRMED:
        subscription.status = SubscriptionStatus.CONFIRMED
        subscription.confirmed_at = timezone.now()
        subscription.save(update_fields=["status", "confirmed_at", "updated_at"])


def unsubscribe(token: str) -> None:
    subscription = _by_token(token)
    if subscription.status != SubscriptionStatus.UNSUBSCRIBED:
        subscription.status = SubscriptionStatus.UNSUBSCRIBED
        subscription.save(update_fields=["status", "updated_at"])
