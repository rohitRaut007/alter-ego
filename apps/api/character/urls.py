from django.urls import path

from . import views

urlpatterns = [
    path("traits", views.TraitListView.as_view(), name="trait-list"),
    path("traits/<uuid:pk>/ratings", views.TraitRatingView.as_view(), name="trait-rating"),
    path("traits/<uuid:pk>/reflections", views.TraitReflectionView.as_view(),
         name="trait-reflection"),
    path("practices/<uuid:pk>/logs", views.PracticeLogView.as_view(), name="practice-log"),
]
