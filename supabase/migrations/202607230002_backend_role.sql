BEGIN;

SET LOCAL search_path = pg_catalog;

DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'loteria_backend'
    ) THEN
        CREATE ROLE loteria_backend NOLOGIN;
    END IF;
END
$migration$;

GRANT USAGE ON SCHEMA loteria_numeros TO loteria_backend;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON ALL TABLES IN SCHEMA loteria_numeros TO loteria_backend;
GRANT USAGE, SELECT
    ON ALL SEQUENCES IN SCHEMA loteria_numeros TO loteria_backend;
ALTER DEFAULT PRIVILEGES IN SCHEMA loteria_numeros
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO loteria_backend;
ALTER DEFAULT PRIVILEGES IN SCHEMA loteria_numeros
    GRANT USAGE, SELECT ON SEQUENCES TO loteria_backend;

DROP POLICY IF EXISTS backend_all_importaciones
    ON loteria_numeros.importaciones;
CREATE POLICY backend_all_importaciones
    ON loteria_numeros.importaciones
    FOR ALL TO loteria_backend
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS backend_all_numeros
    ON loteria_numeros.numeros;
CREATE POLICY backend_all_numeros
    ON loteria_numeros.numeros
    FOR ALL TO loteria_backend
    USING (true)
    WITH CHECK (true);

COMMIT;
