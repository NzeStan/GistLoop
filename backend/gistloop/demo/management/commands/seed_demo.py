"""Fill a development database with believable GistLoop activity.

Everything is created through the public API with real sign-ins, exactly as the website does it, so
the demo exercises the same rules (permissions, moderation, visibility) as real use.

    python manage.py seed_demo
"""

from __future__ import annotations

import datetime as dt
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import BaseCommand, CommandError, call_command
from django.utils import timezone
from rest_framework.test import APIClient
from university.core.http import ClientMeta
from university.security.services.sessions import create_session
from university.users.services import ensure_user_settings

PASSWORD = "GistLoop-demo-2026"  # noqa: S105 - demo accounts on a development database only

PEOPLE = [
    ("amaka", "Amaka Eze", "Product designer. Jollof rice judge. Always on the gist.", "https://amaka.design"),
    ("tunde", "Tunde Bakare", "Final-year Computer Science, UNILAG. I build things that talk to each other.", ""),
    ("zainab", "Zainab Musa", "Med student by day, spoken-word poet by night.", ""),
    ("chidi", "Chidi Okafor", "Football, fintech and fried plantain, in that order.", ""),
    ("ngozi", "Ngozi Adeyemi", "Community lead at Campus Creatives. Let's make something!", ""),
]

POSTS = {
    "amaka": [
        "Just shipped the new GistLoop onboarding flow. Three screens, zero confusion. #design #gistloop",
        "Hot take: the best campus conversations happen in the queue for jollof. Change my mind. #campuslife",
    ],
    "tunde": [
        "Hackathon this weekend at the Faculty of Engineering. Who's building with me? #tech #hackathon",
        "Finally got my final-year project API working end to end. Sleep is for the deployed. #tech",
    ],
    "zainab": [
        "New poem dropping at Friday's open mic: 'Gist of the Harmattan'. Come through! #poetry #events",
        "Anatomy exam done. If you see me smiling, no you didn't. #medschool",
    ],
    "chidi": [
        "That last-minute equaliser in the inter-faculty final! Engineering never gives up. #football",
        "Thinking of starting a campus fintech club. Savings circles, but make it apps. Interested? #fintech",
    ],
    "ngozi": [
        "Campus Creatives meetup is on! Photographers, designers, writers: bring your portfolio. #creatives",
        "Reminder: kindness costs nothing and the comment section is not a battlefield. Catch the conversation. 💬",
    ],
}

COMMUNITIES = [
    ("ngozi", "Campus Creatives", "Designers, photographers, writers and makers sharing work and feedback."),
    ("tunde", "Tech Gist", "Code, startups, internships and the occasional rant about Wi-Fi."),
    ("chidi", "Football Fans", "Match reactions, fixtures and inter-faculty banter. Keep it friendly."),
    ("zainab", "Study Buddies", "Find study partners, share notes and survive exam season together."),
]

ANONYMOUS = [
    "Confession: I've been pretending to understand thermodynamics for two semesters.",
    "Is it just me or does every group project have one person who disappears until the presentation?",
    "To whoever returned my lost ID card at the library: thank you, you're a real one.",
    "How do you tell your roommate their music is too loud without starting a war?",
]


class Command(BaseCommand):
    help = "Create demo users, posts, communities, events, listings, podcasts and anonymous gist."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--force", action="store_true", help="Run even when DEBUG is off (never in production).")

    def handle(self, *args: Any, force: bool = False, **options: Any) -> None:
        if not settings.DEBUG and not force:
            raise CommandError("seed_demo only runs with DJANGO_DEBUG=true (or --force on a disposable database).")
        users = {handle: self._user(handle, name) for handle, name, _, _ in PEOPLE}
        clients = {handle: self._client(user) for handle, user in users.items()}

        for handle, _, bio, website in PEOPLE:
            self._call(clients[handle], "patch", "/api/v1/social/me/profile/", {"bio": bio, "website": website})
        for a in users:
            for b in users:
                if a != b:
                    self._call(
                        clients[a], "post", f"/api/v1/social/users/{users[b].pk}/follow/", {}, ok=(200, 201, 409)
                    )

        posts = []
        for handle, bodies in POSTS.items():
            for body in bodies:
                post = self._call(
                    clients[handle], "post", "/api/v1/social/posts/", {"body": body, "visibility": "public"}
                )
                posts.append(post["id"])
        replies = ["Love this! 🔥", "Count me in.", "This is the gist I came for.", "Facts.", "Haha, so true!"]
        for i, post_id in enumerate(posts):
            for j, handle in enumerate(users):
                if (i + j) % 2 == 0:
                    self._call(clients[handle], "post", f"/api/v1/social/posts/{post_id}/reaction/", {"kind": "like"})
                if (i + j) % 3 == 0:
                    body = {"body": replies[(i + j) % len(replies)]}
                    self._call(clients[handle], "post", f"/api/v1/social/posts/{post_id}/comments/", body)

        communities = []
        for owner, name, description in COMMUNITIES:
            community = self._call(
                clients[owner],
                "post",
                "/api/v1/communities/",
                {"name": name, "description": description, "privacy": "public"},
            )
            communities.append(community["id"])
            for handle in users:
                if handle != owner:
                    self._call(
                        clients[handle], "post", f"/api/v1/communities/{community['id']}/join/", {}, ok=(200, 201, 202)
                    )

        self._events(clients)
        self._listings(clients)
        self._podcasts(clients)
        # Anonymous gist lives inside communities (University never allows it fully public).
        for i, body in enumerate(ANONYMOUS):
            handle = list(users)[i % len(users)]
            data = {"body": body, "visibility": "community", "audience_id": communities[i % len(communities)]}
            self._call(clients[handle], "post", "/api/v1/anonymous/posts/", data)

        call_command("compute_trending", verbosity=0)
        call_command("search_reindex", verbosity=0)
        self.stdout.write(self.style.SUCCESS("Demo data ready."))
        self.stdout.write(f"Sign in as any of: {', '.join(f'{h}@gistloop.test' for h in users)}")
        self.stdout.write(f"Password: {PASSWORD}")

    # ------------------------------------------------------------ helpers
    def _user(self, handle: str, name: str) -> Any:
        User = get_user_model()
        email = f"{handle}@gistloop.test"
        user = User.objects.filter(email=email).first()
        if user is None:
            user = User.objects.create_user(
                email=email, password=PASSWORD, handle=handle, display_name=name, email_verified_at=timezone.now()
            )
            # Established accounts: anonymous posting is (rightly) closed to brand-new ones.
            User.objects.filter(pk=user.pk).update(created_at=timezone.now() - dt.timedelta(days=60))
            user.refresh_from_db()
        ensure_user_settings(user)
        return user

    def _client(self, user: Any) -> APIClient:
        host = next((h for h in settings.ALLOWED_HOSTS if h and "*" not in h and not h.startswith(".")), "localhost")
        client = APIClient(HTTP_HOST=host)
        meta = ClientMeta(ip_address="127.0.0.1", user_agent="seed_demo", device_name="Demo seeder")
        _, tokens = create_session(user, meta=meta, auth_method="password")
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens.access}")
        return client

    def _call(
        self, client: APIClient, method: str, url: str, data: dict[str, Any], ok: tuple[int, ...] = (200, 201)
    ) -> Any:
        response = getattr(client, method)(url, data, format="json")
        if response.status_code not in ok:
            raise CommandError(f"{method.upper()} {url} failed ({response.status_code}): {response.content[:400]!r}")
        return response.json() if response.content else {}

    def _events(self, clients: dict[str, APIClient]) -> None:
        now = timezone.now().replace(minute=0, second=0, microsecond=0)
        events = [
            ("tunde", "Campus Hackathon 2026", "48 hours, great people and a lot of suya.", "in_person", 9, 2),
            ("zainab", "Friday Open Mic", "Poetry, music and comedy from student artists.", "in_person", 3, 1),
            (
                "ngozi",
                "Portfolio Review Live",
                "Get feedback on your design portfolio from working designers.",
                "online",
                6,
                1,
            ),
        ]
        for host, title, summary, fmt, days, duration in events:
            starts = now + dt.timedelta(days=days)
            body = {
                "title": title,
                "summary": summary,
                "description": f"{summary}\n\nEveryone is welcome. Bring a friend and catch the conversation.",
                "category": "community",
                "format": fmt,
                "visibility": "public",
                "starts_at": starts.isoformat(),
                "ends_at": (starts + dt.timedelta(hours=duration * 3)).isoformat(),
                "capacity": 120,
                "location_details": "Main Auditorium" if fmt == "in_person" else "",
                "online_url": "https://meet.example.com/gistloop" if fmt == "online" else "",
            }
            event = self._call(clients[host], "post", "/api/v1/events/", body)
            self._call(clients[host], "post", f"/api/v1/events/{event['id']}/publish/", {})

    def _listings(self, clients: dict[str, APIClient]) -> None:
        categories = self._call(clients["chidi"], "get", "/api/v1/marketplace/categories/", {})
        categories = categories.get("results", categories) if isinstance(categories, dict) else categories
        if not categories:
            return
        key = categories[0]["key"]
        items = [
            ("chidi", "Engineering Mathematics (Stroud), 7th edition", 850000, "like_new"),
            ("amaka", "Wacom drawing tablet", 3500000, "used"),
            ("tunde", "Raspberry Pi 4 starter kit", 6000000, "new"),
            ("ngozi", "Handmade ankara tote bags", 650000, "new"),
        ]
        for seller, title, price, condition in items:
            body = {
                "title": title,
                "description": f"{title}. Pickup on campus or delivery within the city.",
                "category": key,
                "condition": condition,
                "price_minor": price,
                "currency": "NGN",
                "quantity": 1,
                "city": "Lagos",
                "allows_pickup": True,
            }
            listing = self._call(clients[seller], "post", "/api/v1/marketplace/listings/", body)
            self._call(
                clients[seller], "post", f"/api/v1/marketplace/listings/{listing['id']}/status/", {"action": "publish"}
            )

    def _podcasts(self, clients: dict[str, APIClient]) -> None:
        shows = [
            ("zainab", "Harmattan Diaries", "Stories, poems and conversations from campus life."),
            ("tunde", "Build in Public", "Student founders on shipping products in Nigeria."),
        ]
        for host, title, description in shows:
            body = {"title": title, "description": description, "category": "Society & Culture", "language": "en"}
            show = self._call(clients[host], "post", "/api/v1/podcasts/", body)
            self._call(clients[host], "post", f"/api/v1/podcasts/{show['id']}/status/", {"action": "publish"})
