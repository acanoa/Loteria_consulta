import os
import logging
import psycopg2
from psycopg2.extras import execute_values
from typing import List, Tuple, Dict, Any

# Configuración de logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("loteria_db")

# URL de la base de datos de Supabase PostgreSQL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres")

def get_connection():
    return psycopg2.connect(DATABASE_URL)

def init_db():
    """Inicializa el esquema y las tablas leyendo schema.sql"""
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    if not os.path.exists(schema_path):
        logger.error(f"No se encontró schema.sql en {schema_path}")
        return

    with open(schema_path, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(schema_sql)
        conn.commit()
        logger.info("Base de datos e índices inicializados correctamente.")
    except Exception as e:
        conn.rollback()
        logger.error(f"Error al inicializar la base de datos: {e}")
        raise e
    finally:
        conn.close()

def registrar_inicio_importacion(sorteo_id: str, sorteo_nombre: str, tipo_ejecucion: str) -> int:
    """Registra el inicio de una importación y retorna su ID."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO loteria_numeros.importaciones 
                (sorteo_id, sorteo_nombre, estado, tipo_ejecucion)
                VALUES (%s, %s, 'progreso', %s)
                RETURNING id;
                """,
                (sorteo_id, sorteo_nombre, tipo_ejecucion)
            )
            importacion_id = cur.fetchone()[0]
        conn.commit()
        return importacion_id
    except Exception as e:
        conn.rollback()
        logger.error(f"Error al registrar inicio de importación: {e}")
        raise e
    finally:
        conn.close()

def registrar_fallo_importacion(importacion_id: int, mensaje_error: str):
    """Registra un fallo en la importación (usado fuera de la transacción principal)."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE loteria_numeros.importaciones
                SET estado = 'error', mensaje_error = %s, fecha_fin = CURRENT_TIMESTAMP
                WHERE id = %s;
                """,
                (mensaje_error, importacion_id)
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Error al registrar fallo de importación: {e}")
    finally:
        conn.close()

def ejecutar_reemplazo_datos(
    importacion_id: int, 
    sorteo_id: str, 
    sorteo_nombre: str, 
    registros: List[Tuple[str, int]]
) -> int:
    """
    Ejecuta la sustitución atómica de datos en una sola transacción.
    Borra los números anteriores e inserta los nuevos.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # 1. Borrar registros anteriores
            logger.info("Borrando números de sorteos anteriores...")
            cur.execute("DELETE FROM loteria_numeros.numeros;")
            
            # 2. Insertar los nuevos registros usando execute_values para rendimiento óptimo
            logger.info(f"Insertando {len(registros)} nuevos décimos...")
            query = """
                INSERT INTO loteria_numeros.numeros (numero, fracciones, sorteo_id, sorteo_nombre)
                VALUES %s
            """
            # Mapear a la tupla requerida por la base de datos
            valores = [(r[0], r[1], sorteo_id, sorteo_nombre) for r in registros]
            execute_values(cur, query, valores)
            
            # 3. Finalizar registro de importación
            cur.execute(
                """
                UPDATE loteria_numeros.importaciones
                SET estado = 'completada', registros_importados = %s, fecha_fin = CURRENT_TIMESTAMP
                WHERE id = %s;
                """,
                (len(registros), importacion_id)
            )
            
        conn.commit()
        logger.info("Transacción completada: Reemplazo atómico exitoso.")
        return len(registros)
    except Exception as e:
        conn.rollback()
        logger.error(f"Error en la transacción de reemplazo. Operación revertida: {e}")
        raise e
    finally:
        conn.close()

def obtener_ultimo_estado_importacion() -> Dict[str, Any]:
    """Obtiene información sobre la última importación correcta y si hay alguna en progreso."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Importación activa
            cur.execute(
                """
                SELECT id, sorteo_id, sorteo_nombre, fecha_inicio, estado, tipo_ejecucion
                FROM loteria_numeros.importaciones
                WHERE estado = 'progreso'
                ORDER BY id DESC LIMIT 1;
                """
            )
            activa_row = cur.fetchone()
            importacion_activa = None
            if activa_row:
                importacion_activa = {
                    "id": activa_row[0],
                    "sorteo_id": activa_row[1],
                    "sorteo_nombre": activa_row[2],
                    "fecha_inicio": activa_row[3].isoformat(),
                    "estado": activa_row[4],
                    "tipo_ejecucion": activa_row[5]
                }

            # Última correcta
            cur.execute(
                """
                SELECT id, sorteo_id, sorteo_nombre, fecha_inicio, fecha_fin, estado, registros_importados, tipo_ejecucion
                FROM loteria_numeros.importaciones
                WHERE estado = 'completada'
                ORDER BY id DESC LIMIT 1;
                """
            )
            correcta_row = cur.fetchone()
            ultima_correcta = None
            if correcta_row:
                ultima_correcta = {
                    "id": correcta_row[0],
                    "sorteo_id": correcta_row[1],
                    "sorteo_nombre": correcta_row[2],
                    "fecha_inicio": correcta_row[3].isoformat(),
                    "fecha_fin": correcta_row[4].isoformat() if correcta_row[4] else None,
                    "estado": correcta_row[5],
                    "registros_importados": correcta_row[6],
                    "tipo_ejecucion": correcta_row[7]
                }

            # Total de registros en números
            cur.execute("SELECT COUNT(*) FROM loteria_numeros.numeros;")
            total_registros = cur.fetchone()[0]

            return {
                "ultima_importacion_correcta": ultima_correcta,
                "importacion_activa": importacion_activa,
                "total_registros": total_registros
            }
    except Exception as e:
        logger.error(f"Error al obtener estado de importación: {e}")
        return {
            "ultima_importacion_correcta": None,
            "importacion_activa": None,
            "total_registros": 0
        }
    finally:
        conn.close()

def consultar_numeros_loteria(
    tipo_filtro: str,
    filtro_valor: str = None,
    orden: str = "asc",
    limit: int = 10,
    offset: int = 0
) -> Tuple[List[Dict[str, Any]], int]:
    """Consulta números aplicando paginación y filtros específicos."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Base query
            query_where = ""
            params = []
            
            if tipoFiltro := tipo_filtro:
                if tipoFiltro == "menos_50":
                    threshold = 50
                    if filtro_valor and filtro_valor.isdigit():
                        threshold = int(filtro_valor)
                    query_where = "WHERE fracciones < %s"
                    params.append(threshold)
                elif tipoFiltro == "empieza" and filtro_valor:
                    query_where = "WHERE numero LIKE %s"
                    params.append(f"{filtro_valor}%")
                elif tipoFiltro == "termina" and filtro_valor:
                    query_where = "WHERE numero LIKE %s"
                    params.append(f"%{filtro_valor}")
            
            # Dirección del ordenamiento
            direction = "DESC" if orden.lower() == "desc" else "ASC"
            
            # Consulta del total de registros filtrados
            count_query = f"SELECT COUNT(*) FROM loteria_numeros.numeros {query_where};"
            cur.execute(count_query, params)
            total = cur.fetchone()[0]
            
            # Consulta paginada
            data_query = f"""
                SELECT id, numero, fracciones, sorteo_id, sorteo_nombre, fecha_importacion
                FROM loteria_numeros.numeros
                {query_where}
                ORDER BY numero {direction}
                LIMIT %s OFFSET %s;
            """
            cur.execute(data_query, params + [limit, offset])
            rows = cur.fetchall()
            
            resultados = []
            for r in rows:
                resultados.append({
                    "id": r[0],
                    "numero": r[1],
                    "fracciones": r[2],
                    "sorteo_id": r[3],
                    "sorteo_nombre": r[4],
                    "fecha_importacion": r[5].isoformat() if r[5] else None
                })
                
            return resultados, total
    except Exception as e:
        logger.error(f"Error al consultar números de lotería: {e}")
        return [], 0
    finally:
        conn.close()

def limpiar_importaciones_huerfanas():
    """Busca importaciones que quedaron bloqueadas en 'progreso' y las marca como error al iniciar."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE loteria_numeros.importaciones
                SET estado = 'error', 
                    mensaje_error = 'El servidor se reinició mientras la importación estaba en curso.',
                    fecha_fin = CURRENT_TIMESTAMP
                WHERE estado = 'progreso';
                """
            )
        conn.commit()
        logger.info("Importaciones huérfanas limpiadas correctamente.")
    except Exception as e:
        conn.rollback()
        logger.error(f"Error al limpiar importaciones huérfanas: {e}")
    finally:
        conn.close()
