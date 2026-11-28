from django.urls import path

from gistloop.platform import views

urlpatterns = [
    path("restrictions/", views.ActiveRestrictionsView.as_view(), name="platform-restrictions"),
]
