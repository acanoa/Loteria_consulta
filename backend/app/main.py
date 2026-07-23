from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.config import get_settings
from app.integrations.postgres import Database
from app.integrations.selae import SelaeClient
from app.logging_config import configure_logging
from app.repositories.lottery import LotteryRepository
from app.scheduler import create_scheduler
from app.services.draws import DrawService
from app.services.imports import ImportService


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.environment)
    database = Database(
        settings.database_url.get_secret_value(),
        settings.database_pool_min,
        settings.database_pool_max,
    )
    repository = LotteryRepository(database)
    selae = SelaeClient(settings.download_dir)
    draw_service = DrawService(selae)
    import_service = ImportService(repository, selae)

    app.state.settings = settings
    app.state.database = database
    app.state.repository = repository
    app.state.draw_service = draw_service
    app.state.import_service = import_service

    repository.healthcheck()
    stale_count = repository.mark_stale_imports(settings.import_stale_minutes)
    if stale_count:
        logger.warning("stale_imports_closed count=%s", stale_count)

    scheduler = None
    if settings.auto_import_enabled:
        scheduler = create_scheduler(settings, import_service, draw_service)
        scheduler.start()
    try:
        yield
    finally:
        if scheduler:
            scheduler.shutdown(wait=False)
        database.close()


app = FastAPI(
    title="Consulta de Números de Lotería API",
    version="2.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(get_settings().cors_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Admin-Token"],
)
app.include_router(router)


@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
    error_id = str(uuid.uuid4())
    logger.exception(
        "unhandled_request_error error_id=%s method=%s path=%s",
        error_id,
        request.method,
        request.url.path,
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Error interno del servidor.",
            "error_id": error_id,
        },
    )
