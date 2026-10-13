from django.urls import path

from . import settings_views, views

urlpatterns = [
    path("auth/register", views.RegisterView.as_view(), name="auth-register"),
    path("auth/token", views.ThrottledTokenObtainPairView.as_view(), name="auth-token"),
    path("auth/token/refresh", views.ThrottledTokenRefreshView.as_view(), name="auth-refresh"),
    path("auth/logout", views.LogoutView.as_view(), name="auth-logout"),
    path("me", views.MeView.as_view(), name="me"),
    path("me/consents", views.ConsentListCreateView.as_view(), name="me-consents"),
    path("me/export", settings_views.ExportView.as_view(), name="me-export"),
    path("me/reset", settings_views.ResetView.as_view(), name="me-reset"),
    path("me/identity", settings_views.IdentityEditView.as_view(), name="me-identity"),
]
