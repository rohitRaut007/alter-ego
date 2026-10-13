from django.urls import path

from . import views

urlpatterns = [
    path("interviews", views.InterviewStartView.as_view(), name="interview-start"),
    path("interviews/current", views.InterviewCurrentView.as_view(), name="interview-current"),
    path("interviews/<uuid:pk>/turns", views.InterviewTurnView.as_view(), name="interview-turn"),
    path("interviews/<uuid:pk>/complete", views.InterviewCompleteView.as_view(),
         name="interview-complete"),
    path("protocols/latest", views.ProtocolLatestView.as_view(), name="protocol-latest"),
    path("protocols/<uuid:pk>", views.ProtocolDetailView.as_view(), name="protocol-detail"),
    path("protocols/<uuid:pk>/events", views.ProtocolEventsView.as_view(), name="protocol-events"),
    path("protocols/<uuid:pk>/sections/<str:key>/revise", views.ProtocolReviseView.as_view(),
         name="protocol-revise"),
    path("protocols/<uuid:pk>/rating", views.ProtocolRatingView.as_view(), name="protocol-rating"),
    path("protocols/<uuid:pk>/pdf", views.ProtocolPdfView.as_view(), name="protocol-pdf"),
]
