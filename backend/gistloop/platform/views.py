"""Staff tools University doesn't expose an endpoint for."""

from __future__ import annotations

from typing import Any

from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, permissions, serializers
from university.permissions.drf import require_permission


class RestrictionPersonSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    handle = serializers.CharField(allow_null=True)
    display_name = serializers.CharField()


class RestrictionSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    user = RestrictionPersonSerializer()
    kind = serializers.CharField()
    reason = serializers.CharField()
    ends_at = serializers.DateTimeField()
    created_at = serializers.DateTimeField()
    action_id = serializers.UUIDField(allow_null=True)


class ActiveRestrictionsView(generics.ListAPIView):
    """People currently stopped from posting or commenting (lift them with
    ``POST /api/v1/moderation/restrictions/{id}/lift/``)."""

    permission_classes = [permissions.IsAuthenticated, require_permission("moderation.users.restrict")]
    serializer_class = RestrictionSerializer

    @extend_schema(parameters=[OpenApiParameter("user", str, description="Only this user (id).")])
    def get(self, request: Any, *args: Any, **kwargs: Any) -> Any:
        return super().get(request, *args, **kwargs)

    def get_queryset(self) -> Any:
        from university.moderation.models import UserRestriction

        qs = (
            UserRestriction.objects.filter(lifted_at__isnull=True, ends_at__gt=timezone.now())
            .select_related("user")
            .order_by("-created_at")
        )
        user = self.request.query_params.get("user")
        return qs.filter(user_id=user) if user else qs
