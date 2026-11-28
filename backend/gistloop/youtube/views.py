from __future__ import annotations

from typing import Any

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import permissions, serializers, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from university.core.exceptions import NotFound
from university.podcast.api.v1.serializers import PodcastEpisodeSerializer, PodcastPublishSerializer
from university.podcast.models import Episode
from university.podcast.selectors import can_manage, can_view_episode, get_visible_episode, get_visible_podcast

from gistloop.youtube import services
from gistloop.youtube.models import EpisodeVideo, PodcastChannel


class YouTubeEpisodeVideoSerializer(serializers.Serializer):
    episode_id = serializers.UUIDField(source="episode.pk", read_only=True)
    video_id = serializers.CharField(read_only=True)
    watch_url = serializers.URLField(read_only=True)
    imported = serializers.BooleanField(read_only=True)


class YouTubeEpisodeVideoWriteSerializer(serializers.Serializer):
    url = serializers.CharField(max_length=300, help_text="A YouTube link (watch, youtu.be, shorts or live) or ID.")


class YouTubeChannelSerializer(serializers.Serializer):
    channel_id = serializers.CharField(read_only=True)
    channel_url = serializers.SerializerMethodField()
    auto_import = serializers.BooleanField(read_only=True)
    import_since = serializers.DateTimeField(read_only=True)
    last_synced_at = serializers.DateTimeField(read_only=True, allow_null=True)
    last_error = serializers.CharField(read_only=True)

    def get_channel_url(self, obj: PodcastChannel) -> str:
        return f"https://www.youtube.com/channel/{obj.channel_id}"


class YouTubeChannelWriteSerializer(serializers.Serializer):
    channel = serializers.CharField(max_length=200, help_text="The channel ID (UC...) or a /channel/UC... link.")
    auto_import = serializers.BooleanField(default=True)


class YouTubeSyncResultSerializer(serializers.Serializer):
    imported = serializers.IntegerField()


class EpisodeVideoListView(APIView):
    """The YouTube videos of a podcast's episodes that the viewer can see."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        parameters=[OpenApiParameter("podcast", str, required=True, description="Podcast ID.")],
        responses=YouTubeEpisodeVideoSerializer(many=True),
    )
    def get(self, request: Request) -> Response:
        podcast = get_visible_podcast(request.user, request.query_params.get("podcast", ""))
        videos = EpisodeVideo.objects.filter(episode__podcast=podcast, episode__deleted_at__isnull=True).select_related(
            "episode", "episode__podcast"
        )
        if not can_manage(request.user, podcast):
            videos = [v for v in videos if can_view_episode(request.user, v.episode)]
        return Response(YouTubeEpisodeVideoSerializer(videos, many=True).data)


class EpisodeVideoView(APIView):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def _episode(self, request: Request, episode_id: Any) -> Episode:
        return get_visible_episode(request.user, episode_id)

    @extend_schema(responses=YouTubeEpisodeVideoSerializer)
    def get(self, request: Request, episode_id: Any) -> Response:
        video = (
            EpisodeVideo.objects.filter(episode=self._episode(request, episode_id)).select_related("episode").first()
        )
        if video is None:
            raise NotFound("This episode has no YouTube video.")
        return Response(YouTubeEpisodeVideoSerializer(video).data)

    @extend_schema(request=YouTubeEpisodeVideoWriteSerializer, responses=YouTubeEpisodeVideoSerializer)
    def put(self, request: Request, episode_id: Any) -> Response:
        serializer = YouTubeEpisodeVideoWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        video = services.set_episode_video(
            actor=request.user, episode=self._episode(request, episode_id), url=serializer.validated_data["url"]
        )
        return Response(YouTubeEpisodeVideoSerializer(video).data)

    @extend_schema(responses={204: None})
    def delete(self, request: Request, episode_id: Any) -> Response:
        services.remove_episode_video(actor=request.user, episode=self._episode(request, episode_id))
        return Response(status=status.HTTP_204_NO_CONTENT)


class EpisodePublishView(APIView):
    """Publish an episode, including one whose only media is a YouTube video."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=PodcastPublishSerializer, responses=PodcastEpisodeSerializer)
    def post(self, request: Request, episode_id: Any) -> Response:
        get_visible_episode(request.user, episode_id)
        serializer = PodcastPublishSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        episode = services.publish_episode(
            actor=request.user, episode_id=episode_id, publish_at=serializer.validated_data.get("publish_at")
        )
        return Response(PodcastEpisodeSerializer(episode).data)


class _ManagedPodcastView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _podcast(self, request: Request, podcast_id: Any) -> Any:
        podcast = get_visible_podcast(request.user, podcast_id)
        if not can_manage(request.user, podcast):
            raise NotFound("Podcast not found.")
        return podcast


class ChannelView(_ManagedPodcastView):
    @extend_schema(responses=YouTubeChannelSerializer)
    def get(self, request: Request, podcast_id: Any) -> Response:
        channel = PodcastChannel.objects.filter(podcast=self._podcast(request, podcast_id)).first()
        if channel is None:
            raise NotFound("No YouTube channel is connected.")
        return Response(YouTubeChannelSerializer(channel).data)

    @extend_schema(request=YouTubeChannelWriteSerializer, responses=YouTubeChannelSerializer)
    def put(self, request: Request, podcast_id: Any) -> Response:
        serializer = YouTubeChannelWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        channel = services.connect_channel(
            actor=request.user, podcast=self._podcast(request, podcast_id), **serializer.validated_data
        )
        return Response(YouTubeChannelSerializer(channel).data)

    @extend_schema(responses={204: None})
    def delete(self, request: Request, podcast_id: Any) -> Response:
        services.disconnect_channel(actor=request.user, podcast=self._podcast(request, podcast_id))
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChannelSyncView(_ManagedPodcastView):
    """Import new uploads now instead of waiting for the hourly check."""

    @extend_schema(request=None, responses=YouTubeSyncResultSerializer)
    def post(self, request: Request, podcast_id: Any) -> Response:
        channel = PodcastChannel.objects.filter(podcast=self._podcast(request, podcast_id)).first()
        if channel is None:
            raise NotFound("No YouTube channel is connected.")
        return Response({"imported": services.sync_channel(channel)})
