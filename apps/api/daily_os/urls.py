from django.urls import path

from . import views

urlpatterns = [
    path("daily/brief", views.BriefView.as_view(), name="daily-brief"),
    path("sprints/current", views.SprintView.as_view(), name="sprint-current"),
    path("tasks", views.TaskListView.as_view(), name="task-list"),
    path("tasks/new", views.TaskCreateView.as_view(), name="task-create"),
    path("tasks/<uuid:pk>", views.TaskDetailView.as_view(), name="task-detail"),
    path("reflections", views.ReflectionView.as_view(), name="reflections"),
    path("deep-work/sessions", views.DeepWorkStartView.as_view(), name="deep-work-start"),
    path("deep-work/sessions/active", views.DeepWorkActiveView.as_view(), name="deep-work-active"),
    path("deep-work/sessions/<uuid:pk>", views.DeepWorkDetailView.as_view(), name="deep-work-detail"),
    path("weekly-ritual", views.WeeklyRitualView.as_view(), name="weekly-ritual"),
]
