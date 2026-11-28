from django.contrib import admin

from gistloop.syndication.models import Delivery, SyndicationItem


class DeliveryInline(admin.TabularInline):
    model = Delivery
    extra = 0
    readonly_fields = ("channel", "status", "external_id", "external_url", "error", "attempts", "sent_at")
    can_delete = False


@admin.register(SyndicationItem)
class SyndicationItemAdmin(admin.ModelAdmin):
    list_display = ("kind", "title", "status", "created_at")
    list_filter = ("kind", "status")
    readonly_fields = ("kind", "object_id", "text", "link_url", "card", "video_media_id", "reviewed_by", "reviewed_at")
    inlines = [DeliveryInline]
