from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock

from app.integrations.selae import SelaeClient
from app.repositories.lottery import LotteryRepository
from app.services.processing import parse_lottery_csv


logger = logging.getLogger(__name__)


class ImportService:
    def __init__(
        self, repository: LotteryRepository, selae: SelaeClient
    ) -> None:
        self._repository = repository
        self._selae = selae
        self._manual_lock = Lock()
        self._last_manual_start: datetime | None = None

    def enqueue_manual(self, draw_id: str, draw_name: str) -> int:
        now = datetime.now(timezone.utc)
        with self._manual_lock:
            if (
                self._last_manual_start is not None
                and now - self._last_manual_start < timedelta(minutes=10)
            ):
                raise RuntimeError(
                    "Debe esperar 10 minutos entre actualizaciones manuales."
                )
            import_id = self._repository.start_import(
                draw_id, draw_name, "manual"
            )
            self._last_manual_start = now
            return import_id

    def run_scheduled(self, draw_id: str, draw_name: str) -> None:
        import_id = self._repository.start_import(
            draw_id, draw_name, "automatica"
        )
        self.run(import_id, draw_id, draw_name)

    def run(self, import_id: int, draw_id: str, draw_name: str) -> None:
        last_error: Exception | None = None
        downloaded_file: Path | None = None
        for attempt in range(1, 4):
            try:
                downloaded_file = self._selae.download_draw(draw_id)
                records = parse_lottery_csv(downloaded_file)
                self._repository.replace_numbers(
                    import_id, draw_id, draw_name, records
                )
                logger.info(
                    "import_completed import_id=%s records=%s",
                    import_id,
                    len(records),
                )
                if downloaded_file.exists():
                    downloaded_file.unlink()
                return
            except Exception as exc:
                last_error = exc
                logger.exception(
                    "import_attempt_failed import_id=%s attempt=%s",
                    import_id,
                    attempt,
                )
                if attempt < 3:
                    time.sleep(120)

        assert last_error is not None
        self._repository.fail_import(
            import_id,
            f"Se agotaron los reintentos: {last_error}",
        )
