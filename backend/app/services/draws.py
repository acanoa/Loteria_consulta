from __future__ import annotations

from datetime import datetime, timedelta, timezone
from threading import Lock

from app.integrations.selae import SelaeClient


class DrawService:
    def __init__(self, selae: SelaeClient) -> None:
        self._selae = selae
        self._cache: list[dict[str, str]] = []
        self._expires_at: datetime | None = None
        self._lock = Lock()

    def list_available(self) -> list[dict[str, str]]:
        now = datetime.now(timezone.utc)
        with self._lock:
            if self._cache and self._expires_at and now < self._expires_at:
                return self._cache
            draws = self._selae.list_draws()
            if draws:
                self._cache = draws
                self._expires_at = now + timedelta(hours=1)
            return self._cache
