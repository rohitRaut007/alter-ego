from django.urls import path

from . import views

urlpatterns = [
    path("mentor/threads", views.ThreadListView.as_view(), name="mentor-threads"),
    path("mentor/threads/<uuid:pk>", views.ThreadDetailView.as_view(), name="mentor-thread"),
    path("mentor/threads/<uuid:pk>/messages", views.MessageView.as_view(), name="mentor-message"),
    path("mentor/threads/<uuid:pk>/resume", views.ThreadResumeView.as_view(), name="mentor-resume"),
    path("mentor/memory", views.MemoryListView.as_view(), name="mentor-memory"),
    path("mentor/memory/<uuid:pk>", views.MemoryDetailView.as_view(), name="mentor-memory-item"),
    path("mentor/nudges", views.NudgeListView.as_view(), name="mentor-nudges"),
    path("mentor/nudges/<uuid:pk>/read", views.NudgeReadView.as_view(), name="mentor-nudge-read"),
    path("mentor/challenges", views.ChallengeListView.as_view(), name="mentor-challenges"),
    path("mentor/challenges/<uuid:pk>/accept",
         views.ChallengeActionView.as_view(action="accept"), name="mentor-challenge-accept"),
    path("mentor/challenges/<uuid:pk>/dismiss",
         views.ChallengeActionView.as_view(action="dismiss"), name="mentor-challenge-dismiss"),
    path("mentor/prompts", views.PromptsView.as_view(), name="mentor-prompts"),
]
