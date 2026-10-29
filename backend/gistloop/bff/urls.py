from django.urls import path

from gistloop.bff import views

app_name = "bff"

urlpatterns = [
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/login/mfa/", views.MFALoginView.as_view(), name="login-mfa"),
    path("auth/refresh/", views.RefreshView.as_view(), name="refresh"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
]
