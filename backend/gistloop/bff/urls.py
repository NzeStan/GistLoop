from django.urls import path

from gistloop.bff import views

app_name = "bff"

urlpatterns = [
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/login/mfa/", views.MFALoginView.as_view(), name="login-mfa"),
    path("auth/passwordless/", views.PasswordlessRequestView.as_view(), name="passwordless"),
    path("auth/passwordless/verify/", views.PasswordlessVerifyView.as_view(), name="passwordless-verify"),
    path("auth/refresh/", views.RefreshView.as_view(), name="refresh"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/oauth/providers/", views.OAuthProvidersView.as_view(), name="oauth-providers"),
    path("auth/oauth/<slug:provider>/start/", views.OAuthStartView.as_view(), name="oauth-start"),
    path("auth/oauth/<slug:provider>/complete/", views.OAuthCompleteView.as_view(), name="oauth-complete"),
]
