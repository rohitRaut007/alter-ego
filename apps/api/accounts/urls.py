from django.urls import path

from . import views

urlpatterns = [
    path("auth/register", views.RegisterView.as_view(), name="auth-register"),
    path("auth/token", views.ThrottledTokenObtainPairView.as_view(), name="auth-token"),
    path("auth/token/refresh", views.ThrottledTokenRefreshView.as_view(), name="auth-refresh"),
    path("auth/logout", views.LogoutView.as_view(), name="auth-logout"),
    path("me", views.MeView.as_view(), name="me"),
    path("me/consents", views.ConsentListCreateView.as_view(), name="me-consents"),
]
