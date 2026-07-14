import os
import csv
import time
import logging
from pathlib import Path
from random import SystemRandom
from playwright.sync_api import sync_playwright
import db

# Logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("loteria_downloader")

URL = "https://www.loteriasyapuestas.es/es/buscar-decimo"
CARPETA_DESCARGAS = Path(__file__).parent / "descargas"
CARPETA_DESCARGAS.mkdir(exist_ok=True)

def obtener_sorteos_disponibles() -> list:
    """Extrae dinámicamente los sorteos disponibles de la web oficial."""
    numero_aleatorio = f"{SystemRandom().randrange(100_000):05d}"
    sorteos = []

    with sync_playwright() as playwright:
        navegador = playwright.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox", 
                "--disable-setuid-sandbox",
                "--disable-blink-features=AutomationControlled"
            ]
        )
        contexto = navegador.new_context(
            locale="es-ES",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            extra_http_headers={
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
                "Sec-Ch-Ua": '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": '"Windows"',
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "Upgrade-Insecure-Requests": "1"
            }
        )
        pagina = contexto.new_page()
        pagina.set_default_timeout(60_000)

        try:
            pagina.goto(URL, wait_until="domcontentloaded")
            
            # Cerrar cookies
            boton_cookies = pagina.get_by_role("button", name="cookies necesarias", exact=False)
            try:
                boton_cookies.wait_for(state="visible", timeout=4000)
                boton_cookies.click()
            except Exception:
                pass

            # Rellenar número para habilitar selector de sorteos
            input_numero = pagina.locator("#lnacNumber")
            input_numero.wait_for(state="visible", timeout=15000)
            input_numero.fill(numero_aleatorio)
            
            selector_sorteo = pagina.locator("#nextLNACDrawId")
            opciones = selector_sorteo.locator("option").all()

            for opcion in opciones:
                val = opcion.get_attribute("value")
                txt = opcion.text_content()
                if val and txt:
                    # Normalizar espacios y saltos de línea
                    nombre = " ".join(txt.split())
                    sorteos.append({"id": val, "nombre": nombre})
                    
        except Exception as e:
            logger.error(f"Error al obtener sorteos disponibles: {e}")
            raise e
        finally:
            contexto.close()
            navegador.close()

    return sorteos

def descargar_fichero_csv(sorteo_id: str) -> Path:
    """Navega por la web y descarga el fichero CSV para un sorteo específico."""
    numero_aleatorio = f"{SystemRandom().randrange(100_000):05d}"
    fichero_salida = CARPETA_DESCARGAS / f"sorteo_{sorteo_id}.csv"

    # Eliminar archivo viejo si existe para evitar falsos positivos
    if fichero_salida.exists():
        fichero_salida.unlink()

    with sync_playwright() as playwright:
        navegador = playwright.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox", 
                "--disable-setuid-sandbox",
                "--disable-blink-features=AutomationControlled"
            ]
        )
        contexto = navegador.new_context(
            accept_downloads=True,
            locale="es-ES",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            extra_http_headers={
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
                "Sec-Ch-Ua": '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": '"Windows"',
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "Upgrade-Insecure-Requests": "1"
            }
        )
        pagina = contexto.new_page()
        pagina.set_default_timeout(60_000)

        try:
            # 1. Acceder
            pagina.goto(URL, wait_until="domcontentloaded")

            # 2. Cookies
            boton_cookies = pagina.get_by_role("button", name="cookies necesarias", exact=False)
            try:
                boton_cookies.wait_for(state="visible", timeout=4000)
                boton_cookies.click()
            except Exception:
                pass

            # 3. Introducir número aleatorio
            input_numero = pagina.locator("#lnacNumber")
            input_numero.wait_for(state="visible", timeout=15000)
            input_numero.fill(numero_aleatorio)

            # 4. Seleccionar sorteo
            selector_sorteo = pagina.locator("#nextLNACDrawId")
            selector_sorteo.select_option(value=sorteo_id)

            # 5. Pulsar Buscar
            pagina.locator("#lnac").click()

            # 6. Esperar al enlace del fichero completo
            enlace_descarga = pagina.locator('a[href*=".csv"]')
            enlace_descarga.wait_for(state="visible", timeout=60_000)

            # 7. Descargar
            with pagina.expect_download(timeout=60_000) as descarga_info:
                enlace_descarga.click()

            descarga = descarga_info.value
            descarga.save_as(fichero_salida)
            logger.info(f"Fichero guardado en {fichero_salida}")
            
            return fichero_salida
            
        except Exception as e:
            logger.error(f"Error durante el scraping/descarga con Playwright: {e}")
            raise e
        finally:
            contexto.close()
            navegador.close()

def procesar_csv_y_validar(fichero_path: Path) -> list:
    """Lee el CSV descargado, lo valida y normaliza según las reglas del PRD."""
    registros = []
    
    if not fichero_path.exists() or fichero_path.stat().st_size == 0:
        raise ValueError("El fichero CSV está vacío o no existe.")

    with open(fichero_path, mode="r", encoding="utf-8-sig") as f:
        # Intentar detectar el delimitador (por defecto punto y coma en lotería de España)
        sample = f.readline()
        f.seek(0)
        delimiter = ";" if ";" in sample else ","
        
        reader = csv.reader(f, delimiter=delimiter)
        header = next(reader, None)
        
        if not header:
            raise ValueError("CSV sin cabeceras válidas.")
            
        # Normalizar cabeceras a mayúsculas y quitar espacios
        header_normalized = [col.strip().upper() for col in header]
        
        try:
            idx_numero = header_normalized.index("NUMERO")
            idx_fracciones = header_normalized.index("FRACCIONES")
        except ValueError:
            raise ValueError(f"Faltan las columnas NUMERO o FRACCIONES en el CSV. Encontradas: {header_normalized}")

        for line_num, row in enumerate(reader, start=2):
            if not row or len(row) <= max(idx_numero, idx_fracciones):
                continue
                
            numero_raw = row[idx_numero].strip()
            fracciones_raw = row[idx_fracciones].strip()

            # Normalizar número (limpiar caracteres no numéricos)
            numero_clean = "".join(c for c in numero_raw if c.isdigit())
            if not numero_clean:
                continue # Saltar filas de totales o cabeceras adicionales si las hay
                
            # Formatear a 5 caracteres
            try:
                num_int = int(numero_clean)
                numero_formatted = f"{num_int:05d}"
            except ValueError:
                continue

            # Validar fracciones
            try:
                fracciones_int = int(fracciones_raw)
                if fracciones_int < 0:
                    logger.warning(f"Línea {line_num}: Fracciones negativas ignoradas ({fracciones_int})")
                    continue
            except ValueError:
                logger.warning(f"Línea {line_num}: Fracción no convertible a entero ({fracciones_raw})")
                continue

            registros.append((numero_formatted, fracciones_int))

    if not registros:
        raise ValueError("El CSV procesado no contiene ningún registro válido.")

    return registros

def ejecutar_importacion_con_reintentos(sorteo_id: str, sorteo_nombre: str, tipo_ejecucion: str):
    """Ejecuta todo el flujo seguro de importación con hasta 2 reintentos en caso de fallo."""
    importacion_id = db.registrar_inicio_importacion(sorteo_id, sorteo_nombre, tipo_ejecucion)
    
    intentos_max = 3 # Intento inicial + 2 reintentos
    espera_minutos = 2

    for intento in range(1, intentos_max + 1):
        logger.info(f"Iniciando intento {intento} de importación para el sorteo: {sorteo_nombre}...")
        try:
            # 1. Descarga del CSV
            fichero_csv = descargar_fichero_csv(sorteo_id)
            
            # 2. Procesado y validación de datos
            registros = procesar_csv_y_validar(fichero_csv)
            
            # 3. Reemplazo seguro en base de datos
            db.ejecutar_reemplazo_datos(importacion_id, sorteo_id, sorteo_nombre, registros)
            
            logger.info("Importación completada con éxito.")
            # Borrar archivo temporal para no llenar el disco
            if fichero_csv.exists():
                fichero_csv.unlink()
            return
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Fallo en el intento {intento} de importación: {error_msg}")
            
            if intento < intentos_max:
                logger.info(f"Esperando {espera_minutos} minutos antes del reintento...")
                time.sleep(espera_minutos * 60)
            else:
                # Se agotaron los reintentos, marcar importación como fallida permanentemente
                # Esto mantiene a salvo los datos anteriores ya que la transacción nunca hizo commit
                db.registrar_fallo_importacion(importacion_id, f"Se agotaron los reintentos de importación. Último error: {error_msg}")
                logger.error("Se agotaron todos los reintentos. La importación ha fallado permanentemente.")
                raise e
