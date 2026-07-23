from __future__ import annotations

from contextlib import contextmanager
from threading import Lock
from typing import Iterator

from psycopg2.extensions import connection
from psycopg2.pool import ThreadedConnectionPool


class Database:
    """Pool de conexiones compatible con PostgreSQL directo y Supavisor."""

    def __init__(self, database_url: str, minimum: int, maximum: int) -> None:
        self._database_url = database_url
        self._minimum = minimum
        self._maximum = maximum
        self._pool: ThreadedConnectionPool | None = None
        self._lock = Lock()

    def open(self) -> None:
        if self._pool is not None:
            return
        with self._lock:
            if self._pool is None:
                self._pool = ThreadedConnectionPool(
                    self._minimum,
                    self._maximum,
                    dsn=self._database_url,
                    application_name="loteria_backend",
                    options="-c search_path=pg_catalog",
                )

    @contextmanager
    def connection(self) -> Iterator[connection]:
        self.open()
        assert self._pool is not None
        conn = self._pool.getconn()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            self._pool.putconn(conn)

    def close(self) -> None:
        if self._pool is not None:
            self._pool.closeall()
            self._pool = None
