from django.contrib import admin

from .models import Subscription


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ["user", "tier", "status", "source", "current_period_end"]
    list_filter = ["tier", "status", "source"]
    raw_id_fields = ["user"]
