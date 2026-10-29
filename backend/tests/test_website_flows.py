"""The website's money and photo flows, end to end through the API exactly as the React app calls it."""

from __future__ import annotations

import datetime as dt
import io
import uuid

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from university.core.testing import PASSWORD, create_user
from university.marketplace.services import sync_categories

pytestmark = pytest.mark.django_db
RETURN = "http://testserver/payments/return"


@pytest.fixture(autouse=True)
def _media(tmp_path, settings):
    settings.STORAGES = {
        **settings.STORAGES,
        "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
        "private": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    }


def png(name="photo.png"):
    buffer = io.BytesIO()
    Image.new("RGB", (64, 48), (200, 30, 90)).save(buffer, "PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


def checkout(client, purpose, object_id):
    response = client.post(
        "/api/v1/payments/checkout/",
        {"purpose": purpose, "object_id": object_id},
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
    )
    assert response.status_code == 201, response.json()
    return response.json()


def test_dev_provider_is_the_default_without_paystack_keys(api_client):
    from university.payments.conf import payments_settings

    assert payments_settings.get("DEFAULT_PROVIDER") == "dev"


def test_avatar_and_post_images(auth_client, user):
    client = auth_client(user)
    me = client.post("/api/v1/me/avatar/", {"file": png()}, format="multipart").json()
    assert me["avatar_url"].startswith("/media/avatars/") and me["avatar_url"].endswith(".webp")
    media = client.post("/api/v1/social/media/", {"file": png()}, format="multipart")
    assert media.status_code == 201, media.json()
    post = client.post(
        "/api/v1/social/posts/", {"body": "", "visibility": "public", "media": [media.json()["id"]]}, format="json"
    )
    assert post.status_code == 201, post.json()
    assert post.json()["media"][0]["url"] and post.json()["author"]["avatar_url"] == me["avatar_url"]
    assert client.delete("/api/v1/me/avatar/").json()["avatar_url"] is None


def test_sell_buy_and_pay(auth_client, user):
    sync_categories()
    seller, buyer = auth_client(user), auth_client(create_user("buyer@example.com", handle="buyer"))
    listing = seller.post(
        "/api/v1/marketplace/listings/",
        {
            "title": "Calculus textbook",
            "category": "textbooks",
            "price_minor": 450000,
            "quantity": 1,
            "allows_pickup": True,
        },
        format="json",
    )
    assert listing.status_code == 201, listing.json()
    lid = listing.json()["id"]
    assert (
        seller.post(f"/api/v1/marketplace/listings/{lid}/images/", {"file": png()}, format="multipart").status_code
        == 201
    )
    assert (
        seller.post(f"/api/v1/marketplace/listings/{lid}/status/", {"action": "publish"}, format="json").json()[
            "status"
        ]
        == "active"
    )

    order = buyer.post(
        "/api/v1/marketplace/orders/",
        {"listing": lid, "quantity": 1, "fulfilment": "pickup", "payment_method": "online"},
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
    ).json()
    assert order["status"] == "pending_payment"
    intent = checkout(buyer, "marketplace.order", order["id"])
    # The dev provider sends the payer straight back to the website's return page.
    assert intent["checkout_url"].startswith(RETURN) and intent["reference"] in intent["checkout_url"]
    verified = buyer.post(f"/api/v1/payments/{intent['reference']}/verify/").json()
    assert verified["status"] == "succeeded"
    orders = buyer.get("/api/v1/marketplace/me/orders/", {"role": "buyer"}).json()["results"]
    assert orders[0]["status"] == "paid"
    sold = seller.get("/api/v1/marketplace/me/orders/", {"role": "seller"}).json()["results"]
    assert seller.post(f"/api/v1/marketplace/orders/{sold[0]['id']}/fulfil/").json()["status"] == "fulfilled"
    assert buyer.post(f"/api/v1/marketplace/orders/{order['id']}/confirm/").json()["status"] == "completed"


def test_event_with_cover_and_paid_ticket(auth_client, user):
    organiser, guest = auth_client(user), auth_client(create_user("guest@example.com", handle="guest"))
    start = timezone.now() + dt.timedelta(days=7)
    event = organiser.post(
        "/api/v1/events/",
        {
            "title": "Tech Fest",
            "format": "in_person",
            "location_details": "Main hall",
            "starts_at": start.isoformat(),
            "ends_at": (start + dt.timedelta(hours=3)).isoformat(),
        },
        format="json",
    )
    assert event.status_code == 201, event.json()
    eid = event.json()["id"]
    covered = organiser.post(f"/api/v1/events/{eid}/cover/", {"file": png()}, format="multipart")
    assert covered.status_code == 200, covered.json()
    ticket = organiser.post(
        f"/api/v1/events/{eid}/ticket-types/", {"name": "General admission", "price_minor": 200000}, format="json"
    )
    assert ticket.status_code == 201, ticket.json()
    published = organiser.post(f"/api/v1/events/{eid}/publish/")
    assert published.status_code == 200, published.json()

    registration = guest.post(
        f"/api/v1/events/{eid}/register/", {"ticket_type": ticket.json()["id"]}, format="json"
    ).json()
    assert registration["status"] == "pending_payment"
    intent = checkout(guest, "events.registration", registration["id"])
    assert guest.post(f"/api/v1/payments/{intent['reference']}/verify/").json()["status"] == "succeeded"
    mine = guest.get("/api/v1/me/event-registrations/").json()["results"]
    assert mine[0]["status"] == "confirmed" and mine[0]["ticket_code"]


def test_delete_account_needs_the_password(auth_client, user):
    client = auth_client(user)
    assert client.delete("/api/v1/me/", {}, format="json").status_code == 400
    assert client.delete("/api/v1/me/", {"password": "wrong-password"}, format="json").status_code in (400, 403)
    assert client.delete("/api/v1/me/", {"password": PASSWORD}, format="json").status_code == 204


@override_settings(DEBUG=False, GISTLOOP_ALLOW_DEV_PAYMENTS=False)
def test_dev_provider_refuses_to_run_in_production():
    from gistloop.demo.payments import DevPaymentProvider

    with pytest.raises(RuntimeError):
        DevPaymentProvider()


def _load_settings(monkeypatch, **env):
    """Evaluate gistloop/settings.py afresh under the given environment (without touching Django)."""
    import importlib.util
    from pathlib import Path

    for key in ("PAYSTACK_SECRET_KEY", "DJANGO_DEBUG"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("GISTLOOP_SKIP_DOTENV", "1")
    monkeypatch.setenv("DJANGO_SECRET_KEY", "x" * 50)
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    path = Path(__file__).resolve().parent.parent / "gistloop" / "settings.py"
    spec = importlib.util.spec_from_file_location("gistloop_settings_probe", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.UNIVERSITY["PAYMENTS"]


def test_paystack_is_used_when_its_key_is_set(monkeypatch):
    payments = _load_settings(monkeypatch, PAYSTACK_SECRET_KEY="sk_test_abc", DJANGO_DEBUG="false")
    assert payments["DEFAULT_PROVIDER"] == "paystack"
    assert payments["PROVIDERS"]["paystack"]["options"]["secret_key"] == "sk_test_abc"


def test_production_without_paystack_has_no_checkout(monkeypatch):
    payments = _load_settings(monkeypatch, DJANGO_DEBUG="false")
    assert payments["PROVIDERS"] == {} and payments["DEFAULT_PROVIDER"] is None
