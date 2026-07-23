SET search_path = pg_catalog;

SELECT 'importaciones' AS table_name,
       count(*) AS row_count,
       min(id) AS min_id,
       max(id) AS max_id
FROM loteria_numeros.importaciones
UNION ALL
SELECT 'numeros', count(*), min(id), max(id)
FROM loteria_numeros.numeros
ORDER BY table_name;

SELECT md5(
    coalesce(
        string_agg(
            numero || '|' || fracciones || '|' || sorteo_id || '|' ||
            sorteo_nombre,
            E'\n' ORDER BY numero, id
        ),
        ''
    )
) AS numeros_content_hash
FROM loteria_numeros.numeros;

SELECT numero, fracciones, sorteo_id, sorteo_nombre, fecha_importacion
FROM loteria_numeros.numeros
ORDER BY numero
LIMIT 10;
