from django.urls import path

from gistloop.syndication import views

urlpatterns = [
    path("channels/", views.ChannelListView.as_view(), name="syndication-channels"),
    path("items/", views.ItemListView.as_view(), name="syndication-items"),
    path("items/<uuid:item_id>/approve/", views.ItemActionView.as_view(action="approve"), name="syndication-approve"),
    path("items/<uuid:item_id>/reject/", views.ItemActionView.as_view(action="reject"), name="syndication-reject"),
    path("items/<uuid:item_id>/retry/", views.ItemActionView.as_view(action="retry"), name="syndication-retry"),
    path(
        "items/<uuid:item_id>/take-down/",
        views.ItemActionView.as_view(action="take_down"),
        name="syndication-take-down",
    ),
    path("anonymous/share-status/", views.AnonymousShareStatusView.as_view(), name="syndication-anonymous-status"),
    path("anonymous/<uuid:post_id>/share/", views.AnonymousShareView.as_view(), name="syndication-anonymous-share"),
]
