import pytest
from university.core.testing import *  # noqa: F403

WEB = {"HTTP_X_GISTLOOP_CLIENT": "web", "HTTP_SEC_FETCH_SITE": "same-origin"}


@pytest.fixture
def web():
    """Headers the GistLoop website sends on every sign-in request."""
    return dict(WEB)
