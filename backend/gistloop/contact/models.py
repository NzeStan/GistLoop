from __future__ import annotations

from django.db import models
from university.core.models import BaseModel


class Topic(models.TextChoices):
    GENERAL = "general", "General question"
    SUPPORT = "support", "Account and technical support"
    SAFETY = "safety", "Safety or abuse"
    PARTNERSHIPS = "partnerships", "Partnerships and institutions"
    ADVERTISING = "advertising", "Advertising and creators"
    PRESS = "press", "Press and media"
    FEEDBACK = "feedback", "Feedback and ideas"


class MessageStatus(models.TextChoices):
    NEW = "new", "New"
    IN_PROGRESS = "in_progress", "In progress"
    RESOLVED = "resolved", "Resolved"
    SPAM = "spam", "Spam"


class ContactMessage(BaseModel):
    name = models.CharField(max_length=120)
    email = models.EmailField()
    topic = models.CharField(max_length=20, choices=Topic.choices, default=Topic.GENERAL)
    message = models.TextField(max_length=5000)
    status = models.CharField(max_length=20, choices=MessageStatus.choices, default=MessageStatus.NEW)
    staff_notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"], name="gl_contact_status_idx")]

    def __str__(self) -> str:
        return f"{self.get_topic_display()} from {self.name}"


class SubscriptionStatus(models.TextChoices):
    PENDING = "pending", "Awaiting confirmation"
    CONFIRMED = "confirmed", "Subscribed"
    UNSUBSCRIBED = "unsubscribed", "Unsubscribed"


class NewsletterSubscription(BaseModel):
    email = models.EmailField(unique=True)
    status = models.CharField(max_length=20, choices=SubscriptionStatus.choices, default=SubscriptionStatus.PENDING)
    # Only a hash of the confirm/unsubscribe token is stored.
    token_hash = models.CharField(max_length=64, unique=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    last_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.email} ({self.get_status_display()})"
