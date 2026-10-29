from django.urls import path

from gistloop.contact import views

urlpatterns = [
    path("contact/", views.ContactView.as_view(), name="site-contact"),
    path("contact/topics/", views.ContactTopicsView.as_view(), name="site-contact-topics"),
    path("newsletter/", views.NewsletterSubscribeView.as_view(), name="site-newsletter"),
    path("newsletter/confirm/", views.NewsletterConfirmView.as_view(), name="site-newsletter-confirm"),
    path("newsletter/unsubscribe/", views.NewsletterUnsubscribeView.as_view(), name="site-newsletter-unsubscribe"),
]
