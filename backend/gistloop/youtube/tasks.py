from __future__ import annotations

from university.core.tasks import task


@task(name="gistloop.youtube.sync_channels")
def sync_channels() -> int:
    """Import new uploads from every connected channel as draft episodes (scheduled hourly)."""
    from gistloop.youtube.models import PodcastChannel
    from gistloop.youtube.services import sync_channel

    channels = PodcastChannel.objects.filter(auto_import=True).select_related("connected_by")
    return sum(sync_channel(channel) for channel in channels)
