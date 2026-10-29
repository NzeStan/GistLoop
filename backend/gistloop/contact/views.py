from __future__ import annotations

import uuid
from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from gistloop.contact import serializers as s
from gistloop.contact import services
from gistloop.contact.models import Topic

SUBSCRIBE_ACCEPTED = "Check your inbox to confirm your subscription."


class PublicView(APIView):
    """Public, unauthenticated endpoint: reads no credentials, so CSRF doesn't apply."""

    authentication_classes: list[Any] = []
    permission_classes = [permissions.AllowAny]


class ContactTopicsView(PublicView):
    @extend_schema(responses=s.SiteTopicSerializer(many=True))
    def get(self, request: Request) -> Response:
        return Response([{"value": value, "label": str(label)} for value, label in Topic.choices])


class ContactView(PublicView):
    throttle_scope = "contact"

    @extend_schema(request=s.SiteContactSerializer, responses={201: s.SiteContactReceiptSerializer})
    def post(self, request: Request) -> Response:
        serializer = s.SiteContactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        if data.pop("website", ""):
            # A bot filled the honeypot: answer exactly as if it worked.
            return Response({"reference": str(uuid.uuid4())}, status=status.HTTP_201_CREATED)
        saved = services.submit_contact_message(**data)
        return Response({"reference": str(saved.pk)}, status=status.HTTP_201_CREATED)


class NewsletterSubscribeView(PublicView):
    throttle_scope = "newsletter"

    @extend_schema(request=s.SiteNewsletterSerializer, responses={202: s.SiteDetailSerializer})
    def post(self, request: Request) -> Response:
        serializer = s.SiteNewsletterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not serializer.validated_data.get("website"):
            services.subscribe(serializer.validated_data["email"])
        return Response({"detail": SUBSCRIBE_ACCEPTED}, status=status.HTTP_202_ACCEPTED)


class NewsletterConfirmView(PublicView):
    throttle_scope = "newsletter"

    @extend_schema(request=s.SiteTokenSerializer, responses=s.SiteDetailSerializer)
    def post(self, request: Request) -> Response:
        serializer = s.SiteTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.confirm(serializer.validated_data["token"])
        return Response({"detail": "You're subscribed. Welcome to the loop!"})


class NewsletterUnsubscribeView(PublicView):
    throttle_scope = "newsletter"

    @extend_schema(request=s.SiteTokenSerializer, responses=s.SiteDetailSerializer)
    def post(self, request: Request) -> Response:
        serializer = s.SiteTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.unsubscribe(serializer.validated_data["token"])
        return Response({"detail": "You've been unsubscribed."})
