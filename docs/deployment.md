# Despliegue y cambio de conexión

## Variables

Sólo `VITE_API_BASE_URL` es pública. Las demás pertenecen al backend:
`DATABASE_URL`, `ADMIN_API_TOKEN`, `CORS_ORIGINS`, `APP_ENV`, límites del pool
y configuración del scheduler. En producción `APP_ENV=production` obliga a
definir clave administrativa y prohíbe CORS `*`.

En este host la aplicación se despliega mediante
`D:\stack-supabase\docker-compose.loteria.yml`. El backend comparte la red
interna `supabase_default` y conecta directamente a `db` con el login
`loteria_runtime`, miembro de `loteria_backend`. Su contraseña exclusiva se
inyecta desde `D:\stack-supabase\.env` y no está versionada.

## Estado del cutover

El 23/07/2026 se desplegaron `loteria-backend` y `loteria-frontend` como
servicios del proyecto Compose `supabase`. Los tres contenedores anteriores
fueron eliminados después de los smoke tests. El volumen
`loterianacional_pgdata` y los dumps permanecen como rollback temporal.

Ejecutar `scripts/production-smoke.ps1` durante siete días. Tras ese periodo,
si todos los resultados son correctos, se puede eliminar expresamente el
volumen `loterianacional_pgdata`. La eliminación no está automatizada.

## Comprobaciones

```powershell
python -m unittest discover -s backend/tests -v
python -m compileall backend/app
Set-Location frontend
npm run lint
npm run build
```

Además, probar `supabase/tests/*.sql` en una restauración o transacción de
ensayo antes de producción.
