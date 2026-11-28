from django.contrib import admin

from gistloop.youtube.models import EpisodeVideo, PodcastChannel


@admin.register(EpisodeVideo)
class EpisodeVideoAdmin(admin.ModelAdmin):
    list_display = ("video_id", "episode", "imported", "created_at")
    raw_id_fields = ("episode",)


@admin.register(PodcastChannel)
class PodcastChannelAdmin(admin.ModelAdmin):
    list_display = ("channel_id", "podcast", "auto_import", "last_synced_at", "last_error")
    raw_id_fields = ("podcast", "connected_by")
