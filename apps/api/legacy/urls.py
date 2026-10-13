from django.urls import path

from . import views

urlpatterns = [
    path("legacy/timeline", views.TimelineView.as_view(), name="legacy-timeline"),
    path("legacy/milestones", views.MilestoneListView.as_view(), name="legacy-milestones"),
    path("legacy/milestones/<uuid:pk>", views.MilestoneDetailView.as_view(), name="legacy-milestone"),
    path("legacy/reviews", views.ReviewScheduleView.as_view(), name="legacy-review-schedule"),
    path("legacy/reviews/<uuid:pk>/complete", views.ReviewCompleteView.as_view(),
         name="legacy-review-complete"),
]
