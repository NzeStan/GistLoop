"""Mark accounts' email addresses as verified, as if their verification links had been clicked.

For local testing, where emails only appear in the API's terminal.

    python manage.py verify_user someone@example.com [other@example.com …]
"""

from __future__ import annotations

from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import BaseCommand, CommandError
from university.users.services import verify_email
from university.users.tokens import make_email_verification_token


class Command(BaseCommand):
    help = "Verify accounts' email addresses without the email (development only)."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("emails", nargs="+", help="Email addresses of the accounts to verify.")
        parser.add_argument("--force", action="store_true", help="Run even when DEBUG is off (never in production).")

    def handle(self, *args: Any, emails: list[str], force: bool, **options: Any) -> None:
        if not settings.DEBUG and not force:
            raise CommandError("verify_user only runs with DJANGO_DEBUG=true (or --force on a disposable database).")
        users = get_user_model().objects
        for email in emails:
            user = users.filter(email__iexact=email.strip()).first()
            if user is None:
                self.stderr.write(self.style.ERROR(f"{email}: no account with that email."))
                continue
            # The same path as clicking the link: the account becomes active, audited and announced.
            user = verify_email(make_email_verification_token(user))
            self.stdout.write(self.style.SUCCESS(f"{user.email}: verified ({user.status}). You can sign in now."))
