import json
import logging

from django.contrib import admin

from .models import Protocol, ProtocolReview, ProtocolStatus
from .services import assemble_document

log = logging.getLogger("protocol.review")


class ProtocolReviewInline(admin.TabularInline):
    model = ProtocolReview
    extra = 1
    fields = ["accuracy", "flags", "notes", "reviewer", "created_at"]
    readonly_fields = ["reviewer", "created_at"]


@admin.register(Protocol)
class ProtocolAdmin(admin.ModelAdmin):
    """Internal review queue for the first 500 protocols (PRD section 11)."""

    list_display = ["id", "status", "review_required", "reviewed", "accuracy_rating", "created_at"]
    list_filter = ["review_required", "status"]
    ordering = ["created_at"]
    inlines = [ProtocolReviewInline]
    readonly_fields = [
        "id", "user", "interview", "schema_version", "status", "prompt_version", "model",
        "failure_code", "accuracy_rating", "created_at", "completed_at", "document",
    ]
    exclude = ["rating_comment"]

    @admin.display(boolean=True)
    def reviewed(self, obj: Protocol) -> bool:
        return obj.reviews.exists()

    @admin.display(description="Protocol document")
    def document(self, obj: Protocol) -> str:
        if obj.status != ProtocolStatus.READY:
            return "Not ready."
        # Reviewers see decrypted content, so every view is audited without logging content.
        log.info(f"protocol {obj.id} viewed in review queue",
                 extra={"event": "review.protocol_viewed"})
        return json.dumps(assemble_document(obj), indent=2, ensure_ascii=False)[:60000]

    def has_add_permission(self, request):
        return False

    def save_formset(self, request, form, formset, change):
        for obj in formset.save(commit=False):
            if isinstance(obj, ProtocolReview) and obj.reviewer_id is None:
                obj.reviewer = request.user
            obj.save()
        formset.save_m2m()
