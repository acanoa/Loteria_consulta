from __future__ import annotations

import hmac
import logging
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Header,
    HTTPException,
    Query,
    Request,
    status,
)

from app.repositories.lottery import ImportAlreadyRunningError
from app.schemas.api import FilterType, ManualUpdateRequest, SortOrder


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


@router.get("/health")
def health(request: Request) -> dict[str, str]:
    request.app.state.repository.healthcheck()
    return {"status": "ok"}


@router.get("/sorteos")
def list_draws(request: Request) -> list[dict[str, str]]:
    try:
        draws = request.app.state.draw_service.list_available()
        if draws:
            return draws
    except Exception:
        logger.exception("draw_list_external_service_failed")

    state = request.app.state.repository.get_import_status()
    latest = state.get("ultima_importacion_correcta")
    if latest:
        return [
            {
                "id": latest["sorteo_id"],
                "nombre": latest["sorteo_nombre"],
            }
        ]
    return [{"id": "102", "nombre": "SORTEO EXTRAORDINARIO DE NAVIDAD"}]


@router.get("/importacion-estado")
def import_status(request: Request) -> dict:
    return request.app.state.repository.get_import_status()


@router.get("/numeros")
def list_numbers(
    request: Request,
    tipo_filtro: FilterType,
    filtro_valor: Annotated[str | None, Query(pattern=r"^\d{1,4}$")] = None,
    orden: SortOrder = SortOrder.ASC,
    limit: Annotated[int, Query(ge=1, le=100_000)] = 50_000,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict:
    if tipo_filtro in {FilterType.STARTS_WITH, FilterType.ENDS_WITH} and (
        filtro_valor is None or len(filtro_valor) not in {2, 3}
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Los filtros de inicio y terminación requieren 2 o 3 dígitos.",
        )
    data, total = request.app.state.repository.query_numbers(
        tipo_filtro.value,
        filtro_valor,
        orden.value,
        limit,
        offset,
    )
    return {"data": data, "total": total}


@router.post("/actualizar-manual", status_code=status.HTTP_202_ACCEPTED)
def manual_update(
    body: ManualUpdateRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    x_admin_token: Annotated[str | None, Header()] = None,
) -> dict[str, str | int]:
    configured_token = request.app.state.settings.admin_api_token
    if configured_token is not None and (
        x_admin_token is None
        or not hmac.compare_digest(
            x_admin_token, configured_token.get_secret_value()
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credencial administrativa no válida.",
        )
    try:
        import_id = request.app.state.import_service.enqueue_manual(
            body.sorteo_id, body.sorteo_nombre
        )
    except ImportAlreadyRunningError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc

    background_tasks.add_task(
        request.app.state.import_service.run,
        import_id,
        body.sorteo_id,
        body.sorteo_nombre,
    )
    return {
        "mensaje": "Actualización manual encolada correctamente.",
        "estado": "progreso",
        "importacion_id": import_id,
    }
