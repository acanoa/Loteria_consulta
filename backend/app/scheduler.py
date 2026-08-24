import logging

from apscheduler.schedulers.background import BackgroundScheduler
from pytz import timezone

from app.repositories.lottery import ImportAlreadyRunningError


logger = logging.getLogger(__name__)


def create_scheduler(settings, import_service, draw_service) -> BackgroundScheduler:
    scheduler = BackgroundScheduler()

    def scheduled_import() -> None:
        draw_id = "102"
        draw_name = "SORTEO EXTRAORDINARIO DE NAVIDAD"
        try:
            christmas = next(
                (
                    draw
                    for draw in draw_service.list_available()
                    if "NAVIDAD" in draw["nombre"].upper()
                ),
                None,
            )
            if christmas:
                draw_id = christmas["id"]
                draw_name = christmas["nombre"]
            import_service.run_scheduled(draw_id, draw_name)
        except ImportAlreadyRunningError:
            logger.info("scheduled_import_skipped reason=active_import")
        except Exception:
            logger.exception("scheduled_import_failed")

    hour, minute = (int(part) for part in settings.auto_import_hour.split(":"))
    scheduler.add_job(
        scheduled_import,
        trigger="cron",
        hour=hour,
        minute=minute,
        timezone=timezone(settings.auto_import_timezone),
        id="importacion_diaria",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    return scheduler
