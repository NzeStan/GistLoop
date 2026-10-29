"""A development-only payment provider: checkout returns straight to the website, already paid.

Used when DEBUG is on and no PAYSTACK_SECRET_KEY is set, so the whole buy flow (checkout, return
page, verification, order updates) works locally without a Paystack account. Never enable it in
production: anyone could "pay" for anything.
"""

from __future__ import annotations

from typing import Any

from django.conf import settings
from django.utils import timezone
from university.payments.providers import Checkout, ProviderRefund, ProviderTransaction, WebhookNotice


class DevPaymentProvider:
    label = "Development payments (no money moves)"

    def __init__(self, *, key: str = "dev") -> None:
        # Settings only configure this provider when DEBUG is on; this is a second line of defence.
        # Django turns DEBUG off while tests run, so the test settings opt in explicitly.
        if not (settings.DEBUG or getattr(settings, "GISTLOOP_ALLOW_DEV_PAYMENTS", False)):
            raise RuntimeError("DevPaymentProvider is for development only.")
        self.key = key

    def initialize(
        self,
        *,
        reference: str,
        amount_minor: int,
        currency: str,
        email: str,
        description: str,
        callback_url: str,
        metadata: dict[str, Any],
    ) -> Checkout:
        return Checkout(checkout_url=callback_url, provider_reference=f"dev_{reference}")

    def verify(self, reference: str, provider_reference: str = "") -> ProviderTransaction:
        from university.payments.models import PaymentIntent

        intent = PaymentIntent.objects.filter(reference=reference).first()
        if intent is None:
            return ProviderTransaction(status="failed", amount_minor=0, currency="")
        return ProviderTransaction(
            status="succeeded",
            amount_minor=intent.amount_minor,
            currency=intent.currency,
            provider_transaction_id=f"dev_txn_{reference}",
            paid_at=timezone.now(),
            channel="dev",
        )

    def refund(
        self, *, provider_transaction_id: str, reference: str, amount_minor: int, currency: str
    ) -> ProviderRefund:
        return ProviderRefund(status="succeeded", provider_refund_id=f"dev_rf_{reference}")

    def parse_webhook(self, req: Any) -> WebhookNotice:
        from university.core.exceptions import PermissionDenied

        raise PermissionDenied("The development provider has no webhooks.")
