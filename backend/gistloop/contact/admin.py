from django.contrib import admin

from gistloop.contact.models import ContactMessage, MessageStatus, NewsletterSubscription


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("created_at", "name", "email", "topic", "status")
    list_filter = ("status", "topic")
    search_fields = ("name", "email", "message")
    readonly_fields = ("id", "name", "email", "topic", "message", "created_at", "updated_at")
    fields = ("id", "created_at", "name", "email", "topic", "message", "status", "staff_notes")
    actions = ["mark_resolved", "mark_spam"]

    def has_add_permission(self, request):
        return False

    @admin.action(description="Mark as resolved")
    def mark_resolved(self, request, queryset):
        queryset.update(status=MessageStatus.RESOLVED)

    @admin.action(description="Mark as spam")
    def mark_spam(self, request, queryset):
        queryset.update(status=MessageStatus.SPAM)


@admin.register(NewsletterSubscription)
class NewsletterSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("email", "status", "confirmed_at", "created_at")
    list_filter = ("status",)
    search_fields = ("email",)
    exclude = ("token_hash",)
    readonly_fields = ("email", "status", "confirmed_at", "last_sent_at", "created_at", "updated_at")

    def has_add_permission(self, request):
        return False
