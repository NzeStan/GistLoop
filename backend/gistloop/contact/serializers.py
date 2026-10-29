from __future__ import annotations

from rest_framework import serializers

from gistloop.contact.models import Topic


class SiteContactSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, trim_whitespace=True)
    email = serializers.EmailField(max_length=254)
    topic = serializers.ChoiceField(choices=Topic.choices, default=Topic.GENERAL)
    message = serializers.CharField(min_length=20, max_length=5000, trim_whitespace=True)
    # Honeypot: hidden from people, irresistible to bots. Anything here means "pretend and drop".
    website = serializers.CharField(required=False, allow_blank=True, max_length=200, write_only=True)


class SiteContactReceiptSerializer(serializers.Serializer):
    reference = serializers.CharField()


class SiteNewsletterSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    website = serializers.CharField(required=False, allow_blank=True, max_length=200, write_only=True)


class SiteTokenSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=128)


class SiteDetailSerializer(serializers.Serializer):
    detail = serializers.CharField()


class SiteTopicSerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()
