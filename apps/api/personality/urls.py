from django.urls import path

from . import views

urlpatterns = [
    path("personality/questions", views.QuestionnaireView.as_view(), name="personality-questions"),
    path("personality", views.PersonalityView.as_view(), name="personality"),
]
