from __future__ import annotations

import uuid

from django.db import models


class Kind(models.TextChoices):
    ANONYMOUS_POST = "anonymous_post", "Anonymous gist"
    PODCAST_EPISODE = "podcast_episode", "Podcast episode"


class ItemStatus(models.TextChoices):
    PENDING_REVIEW = "pending_review", "Waiting for review"
    APPROVED = "approved", "Approved (sending)"
    SENT = "sent", "Sent"
    REJECTED = "rejected", "Rejected"
    TAKEN_DOWN = "taken_down", "Taken down"


class DeliveryStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SENT = "sent", "Sent"
    FAILED = "failed", "Failed"
    SKIPPED = "skipped", "Not applicable"
    REMOVED = "removed", "Removed"


class SyndicationItem(models.Model):
    """Something GistLoop shares on its own social media accounts.

    For anonymous gist nothing links the item to its author: the author's consent is checked when they
    opt in, and only the post ID and a snapshot of its text are kept.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(max_length=32, choices=Kind.choices)
    object_id = models.CharField(max_length=64)
    title = models.CharField(max_length=200, blank=True)
    text = models.TextField()
    link_url = models.URLField(max_length=500)
    card = models.ImageField(upload_to="syndication/", blank=True)
    #: A video file for TikTok (uploaded podcast video only; YouTube-hosted videos can't be re-posted).
    video_media_id = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=16, choices=ItemStatus.choices, default=ItemStatus.PENDING_REVIEW)
    reviewed_by = models.ForeignKey(
        "university_users.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["kind", "object_id"], name="gl_syndication_once")]
        indexes = [models.Index(fields=["status", "-created_at"], name="gl_syndication_queue")]

    def __str__(self) -> str:
        return f"{self.get_kind_display()} {self.object_id}"


class Delivery(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(SyndicationItem, on_delete=models.CASCADE, related_name="deliveries")
    channel = models.CharField(max_length=16)
    status = models.CharField(max_length=16, choices=DeliveryStatus.choices, default=DeliveryStatus.PENDING)
    external_id = models.CharField(max_length=200, blank=True)
    external_url = models.URLField(max_length=500, blank=True)
    error = models.CharField(max_length=500, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    sent_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["item", "channel"], name="gl_syndication_delivery_once")]

    def __str__(self) -> str:
        return f"{self.channel}: {self.status}"


class ChannelToken(models.Model):
    """Rotating OAuth tokens (TikTok issues a new refresh token on every refresh)."""

    channel = models.CharField(max_length=16, primary_key=True)
    access_token = models.TextField(blank=True)
    refresh_token = models.TextField(blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.channel} token"
