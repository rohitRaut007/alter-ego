from django.contrib import admin
from django.utils.html import format_html


class ReadOnlyEncryptedFieldsAdmin(admin.ModelAdmin):
    """
    Base Admin ensuring all encrypted and credential fields are strictly read-only
    and never exposed in plain text in the Django admin.
    """
    readonly_fields = [
        "created_at",
        "updated_at",
        "encrypted_credentials",
        "encrypted_token",
        "encrypted_secret",
        "display_encrypted_status",
    ]

    def display_encrypted_status(self, obj):
        has_secret = getattr(obj, "encrypted_token", None) or getattr(obj, "encrypted_credentials", None)
        if has_secret:
            return format_html("<span style='color: green;'>[ENCRYPTED AT REST]</span>")
        return format_html("<span style='color: gray;'>[NONE]</span>")

    display_encrypted_status.short_description = "Encryption Status"

    def has_change_permission(self, request, obj=None):
        return True


# Model admin definitions for Goals, Sprints, Milestones, and Protocols
try:
    from apps.api.models import Goal, Sprint, Milestone, DailyTask, Protocol

    @admin.register(Goal)
    class GoalAdmin(ReadOnlyEncryptedFieldsAdmin):
        list_display = ["id", "user", "title", "target_date", "created_at"]
        search_fields = ["user__email", "title"]
        list_filter = ["created_at", "target_date"]

    @admin.register(Sprint)
    class SprintAdmin(ReadOnlyEncryptedFieldsAdmin):
        list_display = ["id", "user", "start_date", "needs_review", "created_at"]
        list_filter = ["needs_review", "start_date"]
        search_fields = ["user__email"]

    @admin.register(Milestone)
    class MilestoneAdmin(ReadOnlyEncryptedFieldsAdmin):
        list_display = ["id", "user", "title", "target_date", "status"]
        list_filter = ["status"]
        search_fields = ["title", "user__email"]

    @admin.register(Protocol)
    class ProtocolAdmin(ReadOnlyEncryptedFieldsAdmin):
        list_display = ["id", "user", "status", "version", "generated_at"]
        list_filter = ["status", "version"]
        readonly_fields = ["generated_at", "created_at", "updated_at"]

except ImportError:
    pass

