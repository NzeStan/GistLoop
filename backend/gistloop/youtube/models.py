from __future__ import annotations

import uuid

from django.db import models


class EpisodeVideo(models.Model):
    """A podcast episode's video, hosted on YouTube."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    episode = models.OneToOneField("university_podcast.Episode", on_delete=models.CASCADE, related_name="youtube")
    video_id = models.CharField(max_length=11, unique=True)
    #: True when it came from the podcast's channel feed rather than being pasted in.
    imported = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"YouTube {self.video_id}"

    @property
    def watch_url(self) -> str:
        return f"https://www.youtube.com/watch?v={self.video_id}"


class PodcastChannel(models.Model):
    """A podcast's YouTube channel. New uploads become draft episodes automatically."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    podcast = models.OneToOneField(
        "university_podcast.Podcast", on_delete=models.CASCADE, related_name="youtube_channel"
    )
    channel_id = models.CharField(max_length=32)
    auto_import = models.BooleanField(default=True)
    #: Only videos published after this are imported (older uploads aren't flooded in as drafts).
    import_since = models.DateTimeField()
    #: Who connected the channel; imported drafts are created on their behalf.
    connected_by = models.ForeignKey("university_users.User", null=True, on_delete=models.SET_NULL, related_name="+")
    last_synced_at = models.DateTimeField(null=True, blank=True)
    last_error = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"YouTube channel {self.channel_id}"
