from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

admin.site.site_header = "GistLoop admin"
admin.site.site_title = "GistLoop admin"

urlpatterns = [
    path("admin/", admin.site.urls),
    # Browser sign-in (httpOnly refresh cookie).
    path("bff/", include("gistloop.bff.urls")),
    # Health checks, /api/v1/... (every installed module, including GistLoop's /api/v1/site/
    # contact and newsletter endpoints) and OpenAPI docs.
    path("", include("university.core.urls")),
]

if settings.SERVE_MEDIA and settings.MEDIA_URL.startswith("/"):
    # Public uploads, served by Django (development, or a small single-server deployment).
    urlpatterns.append(
        re_path(rf"^{settings.MEDIA_URL.strip('/')}/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT})
    )

handler404 = "university.core.api.views.json_page_not_found"
handler500 = "university.core.api.views.json_server_error"
handler403 = "university.core.api.views.json_permission_denied"
handler400 = "university.core.api.views.json_bad_request"
