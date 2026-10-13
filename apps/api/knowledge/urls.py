from django.urls import path

from . import views

urlpatterns = [
    path("knowledge/library", views.LibraryView.as_view(), name="knowledge-library"),
    path("knowledge/items/<uuid:pk>", views.ReadingItemView.as_view(), name="knowledge-item"),
    path("knowledge/notes", views.NoteListView.as_view(), name="knowledge-notes"),
    path("knowledge/notes/<uuid:pk>", views.NoteDetailView.as_view(), name="knowledge-note"),
    path("knowledge/advisor", views.AdvisorView.as_view(), name="knowledge-advisor"),
]
