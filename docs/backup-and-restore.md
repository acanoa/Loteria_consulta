# Backup y restauración

## Backup verificable del origen

Desde la raíz del repositorio:

```powershell
.\scripts\backup-source.ps1
```

El resultado queda ignorado por Git en `backups/` y contiene:

- dump custom de `loteria_numeros`;
- catálogo generado por `pg_restore --list`;
- tamaño y SHA-256 mostrados por el script.

Copiar dump, catálogo y hash a almacenamiento cifrado con la retención
corporativa. Una copia no se considera válida hasta restaurarla en una base
aislada y ejecutar `supabase/tests/002_data_quality.sql`.

## Restauración ensayada

En una PostgreSQL temporal vacía:

```powershell
createdb loteria_restore_test
pg_restore --dbname=loteria_restore_test --no-owner --no-acl <backup.dump>
psql --dbname=loteria_restore_test --file=supabase/tests/002_data_quality.sql
```

No ejecutar este procedimiento sobre el Supabase central salvo dentro de la
fase de copia aprobada. Nunca restaurar `public`, `auth` ni esquemas de otras
aplicaciones.

## Reversión

Durante la validación, el contenedor antiguo ya no existe, pero se conservan
`loterianacional_pgdata` y los dumps verificables. Si el backend central falla:

1. detener nuevas importaciones en el backend nuevo;
2. recrear temporalmente `loteria_db` montando
   `loterianacional_pgdata`, sin inicializar un volumen nuevo;
3. desplegar la configuración anterior y comprobar `/api/health`;
4. reabrir tráfico;
5. conservar los datos centrales para análisis, sin truncarlos.

La reversión de conexión no requiere restaurar datos. Cualquier importación
aceptada tras el cambio debe registrarse y reconciliarse antes de volver.
