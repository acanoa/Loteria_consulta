from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import Any

from psycopg2 import errors
from psycopg2.extras import execute_values

from app.integrations.postgres import Database


logger = logging.getLogger(__name__)


class ImportAlreadyRunningError(RuntimeError):
    pass


class LotteryRepository:
    def __init__(self, database: Database) -> None:
        self._database = database

    def healthcheck(self) -> None:
        with self._database.connection() as conn, conn.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()

    def mark_stale_imports(self, stale_minutes: int) -> int:
        with self._database.connection() as conn, conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE loteria_numeros.importaciones
                   SET estado = 'error',
                       mensaje_error = %s,
                       fecha_fin = CURRENT_TIMESTAMP
                 WHERE estado = 'progreso'
                   AND fecha_inicio < CURRENT_TIMESTAMP - (%s * INTERVAL '1 minute')
                """,
                (
                    "Importación marcada como huérfana al superar el tiempo máximo.",
                    stale_minutes,
                ),
            )
            return cursor.rowcount

    def start_import(
        self, draw_id: str, draw_name: str, execution_type: str
    ) -> int:
        try:
            with self._database.connection() as conn, conn.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO loteria_numeros.importaciones
                        (sorteo_id, sorteo_nombre, estado, tipo_ejecucion)
                    VALUES (%s, %s, 'progreso', %s)
                    RETURNING id
                    """,
                    (draw_id, draw_name, execution_type),
                )
                return int(cursor.fetchone()[0])
        except errors.UniqueViolation as exc:
            raise ImportAlreadyRunningError(
                "Ya hay una importación registrada en progreso."
            ) from exc

    def fail_import(self, import_id: int, error_message: str) -> None:
        with self._database.connection() as conn, conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE loteria_numeros.importaciones
                   SET estado = 'error',
                       mensaje_error = %s,
                       fecha_fin = CURRENT_TIMESTAMP
                 WHERE id = %s
                   AND estado = 'progreso'
                """,
                (error_message[:4000], import_id),
            )

    def replace_numbers(
        self,
        import_id: int,
        draw_id: str,
        draw_name: str,
        records: Sequence[tuple[str, int]],
    ) -> int:
        values = [
            (number, fractions, draw_id, draw_name) for number, fractions in records
        ]
        with self._database.connection() as conn, conn.cursor() as cursor:
            cursor.execute("DELETE FROM loteria_numeros.numeros")
            execute_values(
                cursor,
                """
                INSERT INTO loteria_numeros.numeros
                    (numero, fracciones, sorteo_id, sorteo_nombre)
                VALUES %s
                """,
                values,
                page_size=5_000,
            )
            cursor.execute(
                """
                UPDATE loteria_numeros.importaciones
                   SET estado = 'completada',
                       registros_importados = %s,
                       fecha_fin = CURRENT_TIMESTAMP
                 WHERE id = %s
                   AND estado = 'progreso'
                """,
                (len(values), import_id),
            )
            if cursor.rowcount != 1:
                raise RuntimeError("La importación dejó de estar activa")
        return len(values)

    def get_import_status(self) -> dict[str, Any]:
        with self._database.connection() as conn, conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, sorteo_id, sorteo_nombre, fecha_inicio, fecha_fin,
                       estado, registros_importados, mensaje_error, tipo_ejecucion
                  FROM loteria_numeros.importaciones
                 WHERE estado = 'progreso'
                 ORDER BY id DESC
                 LIMIT 1
                """
            )
            active = self._import_row(cursor.fetchone())
            cursor.execute(
                """
                SELECT id, sorteo_id, sorteo_nombre, fecha_inicio, fecha_fin,
                       estado, registros_importados, mensaje_error, tipo_ejecucion
                  FROM loteria_numeros.importaciones
                 WHERE estado = 'completada'
                 ORDER BY id DESC
                 LIMIT 1
                """
            )
            completed = self._import_row(cursor.fetchone())
            cursor.execute("SELECT COUNT(*) FROM loteria_numeros.numeros")
            total = int(cursor.fetchone()[0])
        return {
            "ultima_importacion_correcta": completed,
            "importacion_activa": active,
            "total_registros": total,
        }

    def query_numbers(
        self,
        filter_type: str,
        filter_value: str | None,
        order: str,
        limit: int,
        offset: int,
    ) -> tuple[list[dict[str, Any]], int]:
        where_sql = ""
        parameters: list[Any] = []
        if filter_type == "menos_50":
            where_sql = "WHERE n.fracciones < %s"
            parameters.append(int(filter_value) if filter_value else 50)
        elif filter_type == "empieza":
            where_sql = "WHERE n.numero LIKE %s"
            parameters.append(f"{filter_value}%")
        elif filter_type == "termina":
            where_sql = "WHERE n.numero LIKE %s"
            parameters.append(f"%{filter_value}")

        direction = "DESC" if order == "desc" else "ASC"
        with self._database.connection() as conn, conn.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT COUNT(*)
                  FROM loteria_numeros.numeros AS n
                  {where_sql}
                """,
                parameters,
            )
            total = int(cursor.fetchone()[0])
            cursor.execute(
                f"""
                SELECT n.id, n.numero, n.fracciones, n.sorteo_id,
                       n.sorteo_nombre, n.fecha_importacion
                  FROM loteria_numeros.numeros AS n
                  {where_sql}
                 ORDER BY n.numero {direction}
                 LIMIT %s OFFSET %s
                """,
                [*parameters, limit, offset],
            )
            rows = cursor.fetchall()
        return (
            [
                {
                    "id": row[0],
                    "numero": row[1],
                    "fracciones": row[2],
                    "sorteo_id": row[3],
                    "sorteo_nombre": row[4],
                    "fecha_importacion": (
                        row[5].isoformat() if row[5] is not None else None
                    ),
                }
                for row in rows
            ],
            total,
        )

    @staticmethod
    def _import_row(row: tuple[Any, ...] | None) -> dict[str, Any] | None:
        if row is None:
            return None
        return {
            "id": row[0],
            "sorteo_id": row[1],
            "sorteo_nombre": row[2],
            "fecha_inicio": row[3].isoformat(),
            "fecha_fin": row[4].isoformat() if row[4] else None,
            "estado": row[5],
            "registros_importados": row[6],
            "mensaje_error": row[7],
            "tipo_ejecucion": row[8],
        }
