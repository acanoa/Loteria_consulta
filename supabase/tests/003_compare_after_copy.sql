\if :{?expected_importaciones}
\else
  \echo 'Falta -v expected_importaciones=<conteo_origen>'
  \quit 2
\endif
\if :{?expected_numeros}
\else
  \echo 'Falta -v expected_numeros=<conteo_origen>'
  \quit 2
\endif

SELECT
    :'expected_importaciones'::bigint AS esperado,
    count(*) AS actual,
    count(*) = :'expected_importaciones'::bigint AS coincide
FROM loteria_numeros.importaciones;

SELECT
    :'expected_numeros'::bigint AS esperado,
    count(*) AS actual,
    count(*) = :'expected_numeros'::bigint AS coincide
FROM loteria_numeros.numeros;

SELECT numero, fracciones, sorteo_id, sorteo_nombre, fecha_importacion
FROM loteria_numeros.numeros
ORDER BY numero
LIMIT 10;

SELECT numero, fracciones, sorteo_id, sorteo_nombre, fecha_importacion
FROM loteria_numeros.numeros
ORDER BY numero DESC
LIMIT 10;
