# Base de datos

## Inventario comparado

| Objeto | `loteria_db` | Supabase central |
|---|---:|---:|
| `importaciones` | 15 filas | 0 filas |
| `numeros` | 28.283 filas | 0 filas |
| secuencias | 2 | 2 |
| índices (incluidas PK) | 5 | 5 |
| restricciones | 2 PK | 2 PK |
| RLS | desactivado | activado |

El origen observado usa PostgreSQL 15.18 y el central PostgreSQL 15.8. Las
columnas, tipos, defaults, índices y secuencias coinciden. La última
importación del origen es la 15, completada el 23/07/2026, con 28.283 filas.
La migración de reconciliación añade restricciones de formato, estados y
valores no negativos, además del bloqueo de importación concurrente.

## Migraciones

1. `202607230001_reconcile_loteria_numeros.sql` completa estructura,
   restricciones, índices, RLS y revocaciones.
2. `202607230002_backend_role.sql` crea un rol de grupo sin login, sus
   privilegios mínimos y políticas RLS exclusivas.

No se aplican automáticamente al arrancar. El 23/07/2026 se probaron bajo
`ROLLBACK` y se aplicaron al PostgreSQL central durante una ventana aprobada.
El login de producción se crea fuera del repositorio y recibe membresía con:

```sql
GRANT loteria_backend TO <runtime_login>;
```

No se debe usar `service_role` en el frontend ni conceder acceso PostgREST.

## Migración ejecutada

1. Se congeló el backend anterior.
2. Se creó el dump final con 15 importaciones y 28.283 números.
3. Se restauró en una única transacción sobre el central.
4. Origen y destino produjeron el hash
   `47a4fea6492c37fcd79ffcc51393da35`.
5. Las muestras ordenadas, secuencias, restricciones y conteos coinciden.
6. El rol `loteria_runtime` tiene login sin `SUPERUSER` ni `BYPASSRLS`, es
   miembro de `loteria_backend` y no puede usar los esquemas
   `"Gestion_Fichajes"`, `hacienda` o `procesamiento_documentos`.

No se utiliza `search_path` implícito y ningún objeto se crea en `public`.
