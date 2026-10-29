"""Browser sign-in for the GistLoop website (a "backend for frontend").

University issues a short-lived access token and a long-lived refresh token. Handing the refresh
token to JavaScript would let any XSS bug steal a 30-day session, so for the website:

* the refresh token lives in an **httpOnly, SameSite=Strict** cookie scoped to ``/bff/auth/``;
* the access token (5 minutes) is returned in the body and kept **in memory only**;
* every endpoint requires the ``X-GistLoop-Client: web`` header and rejects cross-site requests,
  so another site can't make the browser sign in, refresh or sign out (login CSRF included).

Native and server clients keep using University's ``/api/v1/auth/...`` endpoints directly.
"""
