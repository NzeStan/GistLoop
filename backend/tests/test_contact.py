import re

import pytest
from university.core.retention import run_retention

from gistloop.contact.models import ContactMessage, NewsletterSubscription, SubscriptionStatus

pytestmark = pytest.mark.django_db

CONTACT = "/api/v1/site/contact/"
NEWSLETTER = "/api/v1/site/newsletter/"
MESSAGE = {
    "name": "Ada Obi",
    "email": "Ada@Example.com",
    "topic": "partnerships",
    "message": "We'd love to bring GistLoop to our campus this semester.",
}


def token_from(mail):
    return re.search(r"token=([\w-]+)", mail.body).group(1)


def test_contact_messages_reach_only_our_inbox(api_client, outbox):
    response = api_client.post(CONTACT, MESSAGE, format="json")
    assert response.status_code == 201
    saved = ContactMessage.objects.get(pk=response.json()["reference"])
    assert saved.email == "ada@example.com" and saved.topic == "partnerships"
    assert len(outbox) == 1 and outbox[0].to == ["hello@gistloop.test"]  # Never an auto-reply.
    assert "bring GistLoop" in outbox[0].body


@pytest.mark.security
def test_honeypot_pretends_and_drops(api_client, outbox):
    response = api_client.post(CONTACT, {**MESSAGE, "website": "http://spam.example"}, format="json")
    assert response.status_code == 201 and response.json()["reference"]
    assert not ContactMessage.objects.exists() and outbox == []


def test_contact_validation(api_client):
    assert api_client.post(CONTACT, {**MESSAGE, "message": "too short"}, format="json").status_code == 400
    assert api_client.post(CONTACT, {**MESSAGE, "topic": "nope"}, format="json").status_code == 400
    assert api_client.post(CONTACT, {**MESSAGE, "email": "not-an-email"}, format="json").status_code == 400


@pytest.mark.security
def test_contact_is_rate_limited(api_client):
    codes = [api_client.post(CONTACT, MESSAGE, format="json").status_code for _ in range(6)]
    assert codes[:5] == [201] * 5 and codes[5] == 429


def test_contact_topics(api_client):
    topics = api_client.get("/api/v1/site/contact/topics/").json()
    assert {"value": "safety", "label": "Safety or abuse"} in topics


@pytest.mark.security
def test_newsletter_double_opt_in(api_client, outbox):
    first = api_client.post(NEWSLETTER, {"email": "Reader@Example.com"}, format="json")
    assert first.status_code == 202
    assert len(outbox) == 1 and outbox[0].to == ["reader@example.com"]
    token = token_from(outbox[0])
    subscription = NewsletterSubscription.objects.get()
    assert subscription.status == SubscriptionStatus.PENDING and token not in subscription.token_hash
    # Asking again straight away sends nothing more (no mail-bombing a stranger).
    assert api_client.post(NEWSLETTER, {"email": "reader@example.com"}, format="json").json() == first.json()
    assert len(outbox) == 1
    assert api_client.post(f"{NEWSLETTER}confirm/", {"token": token}, format="json").status_code == 200
    assert NewsletterSubscription.objects.get().status == SubscriptionStatus.CONFIRMED
    # A confirmed address gets the same answer and no email: no enumeration.
    assert api_client.post(NEWSLETTER, {"email": "reader@example.com"}, format="json").json() == first.json()
    assert len(outbox) == 1
    assert api_client.post(f"{NEWSLETTER}unsubscribe/", {"token": token}, format="json").status_code == 200
    assert NewsletterSubscription.objects.get().status == SubscriptionStatus.UNSUBSCRIBED


def test_bad_newsletter_tokens(api_client):
    response = api_client.post(f"{NEWSLETTER}confirm/", {"token": "forged"}, format="json")
    assert response.status_code == 400 and response.json()["error"]["code"] == "invalid_token"


def test_newsletter_honeypot(api_client, outbox):
    api_client.post(NEWSLETTER, {"email": "bot@example.com", "website": "x"}, format="json")
    assert not NewsletterSubscription.objects.exists() and outbox == []


def test_retention(api_client):
    import datetime as dt

    from django.utils import timezone

    api_client.post(CONTACT, MESSAGE, format="json")
    api_client.post(NEWSLETTER, {"email": "late@example.com"}, format="json")
    old = timezone.now() - dt.timedelta(days=400)
    ContactMessage.objects.update(created_at=old)
    NewsletterSubscription.objects.update(created_at=old)
    result = run_retention(only=["gistloop.contact_messages", "gistloop.unconfirmed_subscriptions"])
    assert result == {"gistloop.contact_messages": 1, "gistloop.unconfirmed_subscriptions": 1}
