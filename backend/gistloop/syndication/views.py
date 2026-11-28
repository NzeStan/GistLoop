from __future__ import annotations

from typing import Any

from django.db.models import QuerySet
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, permissions, serializers, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from university.core.exceptions import NotFound
from university.permissions.drf import require_permission

from gistloop.syndication import services
from gistloop.syndication.apps import REVIEW_PERMISSION
from gistloop.syndication.models import ItemStatus, SyndicationItem


class SocialDeliverySerializer(serializers.Serializer):
    channel = serializers.CharField()
    status = serializers.CharField()
    external_url = serializers.CharField()
    error = serializers.CharField()
    attempts = serializers.IntegerField()
    sent_at = serializers.DateTimeField(allow_null=True)


class SocialPostSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    kind = serializers.ChoiceField(choices=["anonymous_post", "podcast_episode"])
    object_id = serializers.CharField()
    title = serializers.CharField()
    text = serializers.CharField()
    link_url = serializers.CharField()
    card_url = serializers.SerializerMethodField()
    has_video = serializers.SerializerMethodField()
    status = serializers.ChoiceField(choices=ItemStatus.choices)
    review_note = serializers.CharField()
    reviewed_at = serializers.DateTimeField(allow_null=True)
    created_at = serializers.DateTimeField()
    deliveries = SocialDeliverySerializer(many=True)

    def get_card_url(self, obj: SyndicationItem) -> str:
        return obj.card.url if obj.card else ""

    def get_has_video(self, obj: SyndicationItem) -> bool:
        return bool(obj.video_media_id)


class SocialChannelSerializer(serializers.Serializer):
    key = serializers.CharField()
    name = serializers.CharField()
    enabled = serializers.BooleanField()
    video_only = serializers.BooleanField()


class SocialNoteSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)


class SocialShareStatusSerializer(serializers.Serializer):
    statuses = serializers.DictField(child=serializers.CharField())


Reviewer = require_permission(REVIEW_PERMISSION)


class ChannelListView(APIView):
    permission_classes = [permissions.IsAuthenticated, Reviewer]

    @extend_schema(responses=SocialChannelSerializer(many=True))
    def get(self, request: Request) -> Response:
        return Response(services.channel_status())


class ItemListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated, Reviewer]
    serializer_class = SocialPostSerializer

    @extend_schema(parameters=[OpenApiParameter("status", str, enum=[s for s, _ in ItemStatus.choices])])
    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        return super().get(request, *args, **kwargs)

    def get_queryset(self) -> QuerySet[SyndicationItem]:
        qs = SyndicationItem.objects.prefetch_related("deliveries")
        wanted = self.request.query_params.get("status")
        return qs.filter(status=wanted) if wanted else qs


class ItemActionView(APIView):
    permission_classes = [permissions.IsAuthenticated, Reviewer]
    action = ""

    @extend_schema(request=SocialNoteSerializer, responses=SocialPostSerializer)
    def post(self, request: Request, item_id: Any) -> Response:
        item = SyndicationItem.objects.filter(pk=item_id).first()
        if item is None:
            raise NotFound("Item not found.")
        note = services.validate_note(request.data.get("note"))
        if self.action == "approve":
            item = services.approve(actor=request.user, item=item)
        elif self.action == "reject":
            item = services.reject(actor=request.user, item=item, note=note)
        elif self.action == "retry":
            item = services.retry(actor=request.user, item=item)
        else:
            item = services.take_down(actor=request.user, item=item, note=note)
        item.refresh_from_db()
        return Response(SocialPostSerializer(item).data)


class AnonymousShareView(APIView):
    """The author of an anonymous post asks for it to be shared on GistLoop's social media (or withdraws)."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=None, responses={201: SocialShareStatusSerializer})
    def post(self, request: Request, post_id: Any) -> Response:
        item = services.nominate_anonymous_post(user=request.user, post_id=post_id)
        return Response({"statuses": {item.object_id: item.status}}, status=status.HTTP_201_CREATED)

    @extend_schema(responses={204: None})
    def delete(self, request: Request, post_id: Any) -> Response:
        services.withdraw_anonymous_post(user=request.user, post_id=post_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AnonymousShareStatusView(APIView):
    """Share status of the viewer's own anonymous posts (other posts are never reported)."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        parameters=[OpenApiParameter("ids", str, required=True, description="Comma-separated post IDs (up to 100).")],
        responses=SocialShareStatusSerializer,
    )
    def get(self, request: Request) -> Response:
        ids = [i for i in request.query_params.get("ids", "").split(",") if i][:100]
        return Response({"statuses": services.anonymous_share_status(user=request.user, post_ids=ids)})
