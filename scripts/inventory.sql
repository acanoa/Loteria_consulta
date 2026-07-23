SET search_path = pg_catalog;

SELECT c.relname AS object_name,
       c.relkind,
       c.reltuples::bigint AS estimated_rows,
       c.relrowsecurity AS rls_enabled,
       pg_total_relation_size(c.oid) AS total_bytes
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'loteria_numeros'
ORDER BY c.relkind, c.relname;

SELECT table_name, column_name, ordinal_position, data_type, is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema = 'loteria_numeros'
ORDER BY table_name, ordinal_position;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'loteria_numeros'
ORDER BY tablename, indexname;

SELECT c.relname AS table_name,
       con.conname AS constraint_name,
       con.contype,
       pg_get_constraintdef(con.oid, true) AS definition
FROM pg_constraint AS con
JOIN pg_class AS c ON c.oid = con.conrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'loteria_numeros'
ORDER BY c.relname, con.conname;
