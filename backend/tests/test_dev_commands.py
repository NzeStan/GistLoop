"""Development helpers: verify_user."""

from __future__ import annotations

import pytest
from django.core.management import CommandError, call_command
from django.test import override_settings
from university.core.testing import PASSWORD, create_user

pytestmark = pytest.mark.django_db


def test_verify_user_activates_a_pending_account(api_client, web):
    user = create_user("new@example.com", handle="newbie", status="pending", email_verified_at=None)
    with override_settings(DEBUG=True):
        call_command("verify_user", "NEW@example.com")
    user.refresh_from_db()
    assert user.status == "active" and user.email_verified_at is not None
    response = api_client.post(
        "/bff/auth/login/", {"identifier": "new@example.com", "password": PASSWORD}, format="json", **web
    )
    assert response.status_code == 200, response.json()


@override_settings(DEBUG=False)
def test_verify_user_refuses_without_debug():
    with pytest.raises(CommandError):
        call_command("verify_user", "someone@example.com")
