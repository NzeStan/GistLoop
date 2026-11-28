"""Automatic podcast transcripts with Deepgram (set DEEPGRAM_API_KEY).

University's podcast module hands the provider a short-lived signed link to the episode's audio;
Deepgram fetches it itself, so nothing large passes through GistLoop. The link must be reachable from
the internet (PUBLIC_BASE_URL).
"""

from __future__ import annotations

from typing import Any
from urllib.parse import urlencode

from university.core.exceptions import ProviderError
from university.core.providers.http import request


class DeepgramTranscriptionProvider:
    URL = "https://api.deepgram.com/v1/listen"

    def __init__(self, *, api_key: str, model: str = "nova-3", timeout: int = 600) -> None:
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    def transcribe(self, *, audio_url: str, language: str) -> list[dict[str, Any]]:
        query = urlencode(
            {"model": self.model, "language": language or "en", "smart_format": "true", "utterances": "true"}
        )
        data = request(
            "POST",
            f"{self.URL}?{query}",
            json_body={"url": audio_url},
            headers={"Authorization": f"Token {self.api_key}"},
            timeout=self.timeout,
        )
        utterances = ((data or {}).get("results") or {}).get("utterances") if isinstance(data, dict) else None
        if not isinstance(utterances, list):
            raise ProviderError(code="transcription_failed")
        return [
            {"start": float(u["start"]), "end": float(u["end"]), "text": str(u.get("transcript", "")).strip()}
            for u in utterances
            if isinstance(u, dict) and u.get("transcript")
        ]
