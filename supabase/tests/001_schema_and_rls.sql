BEGIN;

SET LOCAL search_path = pg_catalog;

DO $test$
BEGIN
    ASSERT pg_catalog.to_regclass('loteria_numeros.importaciones') IS NOT NULL,
        'Falta loteria_numeros.importaciones';
    ASSERT pg_catalog.to_regclass('loteria_numeros.numeros') IS NOT NULL,
        'Falta loteria_numeros.numeros';
    ASSERT (
        SELECT relation_.relrowsecurity
          FROM pg_catalog.pg_class AS relation_
          JOIN pg_catalog.pg_namespace AS namespace_
            ON namespace_.oid = relation_.relnamespace
         WHERE namespace_.nspname = 'loteria_numeros'
           AND relation_.relname = 'numeros'
    ), 'RLS no está activado en numeros';
    ASSERT NOT pg_catalog.has_schema_privilege(
        'anon', 'loteria_numeros', 'USAGE'
    ), 'anon no debe usar el esquema';
    ASSERT NOT pg_catalog.has_schema_privilege(
        'authenticated', 'loteria_numeros', 'USAGE'
    ), 'authenticated no debe usar el esquema';
    ASSERT NOT pg_catalog.has_table_privilege(
        'service_role', 'loteria_numeros.numeros', 'SELECT'
    ), 'service_role no debe acceder directamente';
    ASSERT NOT EXISTS (
        SELECT 1
          FROM pg_catalog.pg_class AS relation_
          JOIN pg_catalog.pg_namespace AS namespace_
            ON namespace_.oid = relation_.relnamespace
         WHERE namespace_.nspname = 'public'
           AND relation_.relname IN ('numeros', 'importaciones')
    ), 'Hay objetos de la aplicación en public';
END
$test$;

ROLLBACK;
