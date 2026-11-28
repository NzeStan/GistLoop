from __future__ import annotations

from university.core.modules import UniversityAppConfig


class YouTubeConfig(UniversityAppConfig):
    """YouTube-hosted video for podcast episodes: watch on GistLoop, hosted (and counted) on YouTube."""

    name = "gistloop.youtube"
    label = "gistloop_youtube"
    verbose_name = "GistLoop YouTube videos"
    module_name = "youtube"
    module_version = "1.0.0"
    module_requires = ("core", "podcast")
    api_prefix = "youtube/"
    api_urlconfs = {"v1": "gistloop.youtube.urls"}
