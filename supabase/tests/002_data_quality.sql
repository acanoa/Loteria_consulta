BEGIN;

SET LOCAL search_path = pg_catalog;

DO $test$
BEGIN
    ASSERT NOT EXISTS (
        SELECT 1
          FROM loteria_numeros.numeros
         WHERE numero !~ '^[0-9]{5}$'
            OR fracciones < 0
    ), 'Hay números inválidos';
    ASSERT NOT EXISTS (
        SELECT numero
          FROM loteria_numeros.numeros
         GROUP BY numero
        HAVING count(*) > 1
    ), 'Hay números duplicados en el conjunto activo';
    ASSERT NOT EXISTS (
        SELECT 1
          FROM loteria_numeros.importaciones
         WHERE estado NOT IN ('progreso', 'completada', 'error')
            OR tipo_ejecucion NOT IN ('manual', 'automatica')
    ), 'Hay estados de importación inválidos';
END
$test$;

ROLLBACK;
