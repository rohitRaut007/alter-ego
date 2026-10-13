from django.urls import path

from . import views

urlpatterns = [
    path("calendar", views.CalendarStatusView.as_view(), name="calendar-status"),
    path("calendar/sync", views.CalendarSyncView.as_view(), name="calendar-sync"),
    path("calendar/events", views.CalendarEventsView.as_view(), name="calendar-events"),
]
