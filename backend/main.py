import os
import threading
import time
import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from apscheduler.schedulers.background import BackgroundScheduler
from pytz import timezone

import db
import downloader

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("loteria_api")

# Inicialización de FastAPI
app = FastAPI(title="Consulta de Números de Lotería API")

# Permitir CORS para desarrollo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cerradura global para evitar importaciones concurrentes
importacion_lock = threading.Lock()
importacion_en_curso = False

# Rate limiting simple en memoria para la actualización manual
# Evita más de una solicitud de inicio de actualización manual cada 10 minutos
ultima_actualizacion_manual: Optional[datetime] = None
MINUTOS_RATE_LIMIT = 10

# Cache simple en memoria para la lista de sorteos oficiales
cache_sorteos = []
cache_sorteos_expira: Optional[datetime] = None
CACHE_SORTEOS_DURACION_HORAS = 1

class ActualizacionManualRequest(BaseModel):
    sorteo_id: str
    sorteo_nombre: str

@app.on_event("startup")
def startup_event():
    # Inicializar tablas en base de datos si no existen
    try:
        db.init_db()
        db.limpiar_importaciones_huerfanas()
    except Exception as e:
        logger.error(f"No se pudo inicializar la base de datos durante el arranque: {e}. La aplicación continuará funcionando pero las llamadas que requieran BD fallarán.")
    
    # Iniciar planificador automático
    iniciar_planificador()

@app.get("/api/sorteos")
def get_sorteos():
    """Retorna los sorteos disponibles con caché en memoria."""
    global cache_sorteos, cache_sorteos_expira
    ahora = datetime.utcnow()
    
    if cache_sorteos and cache_sorteos_expira and ahora < cache_sorteos_expira:
        return cache_sorteos

    try:
        sorteos = downloader.obtener_sorteos_disponibles()
        if sorteos:
            cache_sorteos = sorteos
            cache_sorteos_expira = ahora + timedelta(hours=CACHE_SORTEOS_DURACION_HORAS)
            return sorteos
    except Exception as e:
        logger.error(f"Error al obtener sorteos dinámicamente: {e}")
        # Si falla el scraping, retornar el sorteo de navidad por defecto para no romper la UI
        return [{"id": "102", "nombre": "SORTEO EXTRAORDINARIO DE NAVIDAD"}]
        
    return cache_sorteos

@app.get("/api/importacion-estado")
def get_importacion_estado():
    """Devuelve el estado de la última importación técnica y la activa."""
    try:
        return db.obtener_ultimo_estado_importacion()
    except Exception as e:
        logger.error(f"Error de base de datos en get_importacion_estado: {e}")
        raise HTTPException(
            status_code=503,
            detail="La base de datos de Supabase no está accesible en este momento."
        )

@app.get("/api/numeros")
def get_numeros(
    tipo_filtro: str = Query(..., description="menos_50, empieza, termina"),
    filtro_valor: Optional[str] = Query(None, description="2 o 3 dígitos numéricos"),
    orden: str = Query("asc", description="asc o desc"),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Consulta paginada y filtrada de décimos."""
    # Validación de filtro por prefijo/sufijo
    if tipo_filtro in ["empieza", "termina"]:
        if not filtro_valor or not filtro_valor.isdigit() or len(filtro_valor) not in [2, 3]:
            raise HTTPException(
                status_code=400, 
                detail="Para filtros de inicio o terminación, debe proveer un valor de exactamente 2 o 3 dígitos."
            )
            
    try:
        resultados, total = db.consultar_numeros_loteria(
            tipo_filtro=tipo_filtro,
            filtro_valor=filtro_valor,
            orden=orden,
            limit=limit,
            offset=offset
        )
        return {"data": resultados, "total": total}
    except Exception as e:
        logger.error(f"Error de base de datos en get_numeros: {e}")
        raise HTTPException(
            status_code=503,
            detail="La base de datos de Supabase no está accesible en este momento."
        )

def tarea_importar_segundo_plano(sorteo_id: str, sorteo_nombre: str, tipo_ejecucion: str):
    global importacion_en_curso
    try:
        downloader.ejecutar_importacion_con_reintentos(sorteo_id, sorteo_nombre, tipo_ejecucion)
    except Exception as e:
        logger.error(f"Fallo en la importación en segundo plano: {e}")
    finally:
        importacion_en_curso = False

@app.post("/api/actualizar-manual")
def post_actualizar_manual(req: ActualizacionManualRequest, background_tasks: BackgroundTasks):
    """Lanza el proceso de descarga y procesamiento manual de un sorteo."""
    global importacion_en_curso, ultima_actualizacion_manual
    
    # 0. Validar sorteo_id
    if not req.sorteo_id or req.sorteo_id == "NONE":
        raise HTTPException(
            status_code=400,
            detail="Por favor, seleccione un sorteo oficial de la lista."
        )
        
    # 1. Comprobar exclusión mutua
    if importacion_en_curso:
        raise HTTPException(
            status_code=429, 
            detail="Ya existe una importación o descarga en curso en este momento. Inténtelo más tarde."
        )

    # 2. Comprobar en base de datos si figura algo activo por seguridad
    try:
        estado_db = db.obtener_ultimo_estado_importacion()
        if estado_db.get("importacion_activa") is not None:
            raise HTTPException(
                status_code=429, 
                detail="Hay un proceso de importación registrado como activo en la base de datos."
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error de base de datos en post_actualizar_manual: {e}")
        raise HTTPException(
            status_code=503,
            detail="No se pudo conectar a la base de datos de Supabase. El puerto 5432 podría estar cerrado desde esta red local."
        )

    # 3. Comprobar rate limit
    ahora = datetime.utcnow()
    if ultima_actualizacion_manual:
        diferencia = ahora - ultima_actualizacion_manual
        if diferencia < timedelta(minutes=MINUTOS_RATE_LIMIT):
            tiempo_restante = int((timedelta(minutes=MINUTOS_RATE_LIMIT) - diferencia).total_seconds() / 60)
            raise HTTPException(
                status_code=429,
                detail=f"Límite de frecuencia excedido. Podrá volver a solicitar una actualización manual en {tiempo_restante} minutos."
            )

    # 4. Adquirir el bloqueo de ejecución
    with importacion_lock:
        if importacion_en_curso:
            raise HTTPException(status_code=429, detail="Proceso de importación ya iniciado.")
        importacion_en_curso = True
        
    ultima_actualizacion_manual = ahora
    background_tasks.add_task(
        tarea_importar_segundo_plano,
        req.sorteo_id,
        req.sorteo_nombre,
        "manual"
    )
    
    return {"mensaje": "Actualización manual encolada correctamente.", "estado": "progreso"}

# =====================================================================
# Programador Automático (Scheduler)
# =====================================================================

scheduler = BackgroundScheduler()

def tarea_importacion_automatica_diaria():
    global importacion_en_curso
    logger.info("Iniciando tarea programada automática diaria...")
    
    if importacion_en_curso:
        logger.warning("La importación automática se omitió porque ya hay un proceso activo.")
        return

    # Buscar el Sorteo Extraordinario de Navidad por defecto
    sorteo_id = "102"
    sorteo_nombre = "SORTEO EXTRAORDINARIO DE NAVIDAD"
    
    try:
        # Intentar obtener el sorteo de Navidad dinámicamente si figura en el scraping
        sorteos = downloader.obtener_sorteos_disponibles()
        navidad = next((s for s in sorteos if "NAVIDAD" in s["nombre"].upper()), None)
        if navidad:
            sorteo_id = navidad["id"]
            sorteo_nombre = navidad["nombre"]
    except Exception as e:
        logger.error(f"No se pudo consultar sorteos dinámicos en la tarea automática; usando valores por defecto: {e}")

    with importacion_lock:
        importacion_en_curso = True

    try:
        downloader.ejecutar_importacion_con_reintentos(sorteo_id, sorteo_nombre, "automatica")
    except Exception as e:
        logger.error(f"Fallo en la importación automática diaria: {e}")
    finally:
        importacion_en_curso = False

def iniciar_planificador():
    enabled = os.getenv("AUTO_IMPORT_ENABLED", "true").lower() == "true"
    if not enabled:
        logger.info("Programación automática deshabilitada en la configuración del servidor.")
        return

    hora_str = os.getenv("AUTO_IMPORT_HOUR", "03:00") # HH:MM
    try:
        partes = hora_str.split(":")
        hora = int(partes[0])
        minuto = int(partes[1])
    except Exception:
        logger.warning(f"Formato de hora inválido en AUTO_IMPORT_HOUR: {hora_str}. Usando 03:00 por defecto.")
        hora, minuto = 3, 0

    tz_str = os.getenv("AUTO_IMPORT_TIMEZONE", "Europe/Madrid")
    tz = timezone(tz_str)

    scheduler.add_job(
        tarea_importacion_automatica_diaria,
        trigger="cron",
        hour=hora,
        minute=minuto,
        timezone=tz,
        id="importacion_diaria_job",
        replace_existing=True
    )
    scheduler.start()
    logger.info(f"Programación automática diaria activada a las {hora:02d}:{minuto:02d} ({tz_str}).")
