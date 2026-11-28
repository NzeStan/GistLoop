from __future__ import annotations

from university.core.tasks import task


@task(name="gistloop.syndication.deliver_item")
def deliver_item(item_id: str) -> int:
    from gistloop.syndication.services import deliver

    return deliver(item_id)


@task(name="gistloop.syndication.retry_failed")
def retry_failed() -> int:
    from gistloop.syndication.services import retry_failed as run

    return run()
