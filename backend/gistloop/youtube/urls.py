from django.urls import path

from gistloop.youtube import views

urlpatterns = [
    path("episodes/", views.EpisodeVideoListView.as_view(), name="youtube-episode-list"),
    path("episodes/<uuid:episode_id>/", views.EpisodeVideoView.as_view(), name="youtube-episode"),
    path("episodes/<uuid:episode_id>/publish/", views.EpisodePublishView.as_view(), name="youtube-episode-publish"),
    path("podcasts/<uuid:podcast_id>/channel/", views.ChannelView.as_view(), name="youtube-channel"),
    path("podcasts/<uuid:podcast_id>/channel/sync/", views.ChannelSyncView.as_view(), name="youtube-channel-sync"),
]
