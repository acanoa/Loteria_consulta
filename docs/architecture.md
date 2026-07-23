# Arquitectura

## Estado auditado (23 de julio de 2026)

La aplicación usa React 19 + Vite 8 en un contenedor Nginx, FastAPI en una
imagen Playwright y PostgreSQL 15. El frontend llama al backend por el prefijo
`/apps/loteria-consulta/api`; no usa Supabase directamente. El backend descarga
CSV de SELAE, los valida y reemplaza el conjunto de números en una transacción.
No hay autenticación de usuario ni Storage.

Riesgos encontrados en el MVP:

- CORS abierto con credenciales y actualización manual pública.
- DDL ejecutado al arrancar el backend.
- URL PostgreSQL insegura por defecto y configuración sin validar.
- consultas y reglas de negocio mezcladas en tres módulos globales;
- errores PostgreSQL convertidos en listas vacías, ocultando fallos;
- bloqueo de importación y rate limit sólo en memoria;
- sin pruebas, migraciones versionadas, backup verificable ni plan de cambio;
- `loteria_db` y Supabase tenían sólo PK, sin restricciones de dominio.

El Supabase central contiene `loteria_numeros` con la misma estructura que el
origen, cero filas, RLS activado, ninguna política y ningún permiso para
`anon`, `authenticated` o `service_role`. No existe bucket de Lotería.

La auditoría posterior al despliegue confirmó que `loteria_runtime` no tiene
`USAGE` sobre esquemas de otras aplicaciones. La revisión agregada del central
detectó, fuera del alcance de Lotería:

- 49 grants de `anon` y 415 de `authenticated` en `hacienda`, incluidos
  privilegios estructurales;
- 74 grants de `authenticated` en `"Gestion_Fichajes"`, sin privilegios
  estructurales y con RLS en todas sus tablas;
- 48 grants de `authenticated` en `procesamiento_documentos`;
- `procesamiento_documentos._migration_history` sin RLS y con escritura para
  `authenticated`.

No se revocaron permisos de esas aplicaciones porque podría romper consumidores
ajenos. Requieren cambios coordinados en sus propios repositorios.

## Diseño objetivo

- `frontend/src/components`: presentación existente.
- `frontend/src/services`: contrato HTTP y tratamiento homogéneo de errores.
- `frontend/src/types`: tipos compartidos del contrato.
- `frontend/src/config`: única variable pública y validada por construcción.
- `backend/app/api`: rutas y autorización HTTP.
- `backend/app/services`: importaciones, procesamiento, consultas de sorteos y
  tareas programadas.
- `backend/app/repositories`: todas las consultas SQL de la aplicación.
- `backend/app/integrations`: PostgreSQL/Supavisor y automatización SELAE.
- `backend/app/schemas`: validación de entradas.
- `backend/app/config.py`: separación y validación de secretos.
- `supabase`: migraciones y pruebas que nunca crean objetos en `public`.

El frontend nunca recibe la URL PostgreSQL ni una clave de servicio. La clave
administrativa se introduce por el operador y sólo vive en memoria del
navegador durante esa sesión. Para una futura interfaz multiusuario debe
reemplazarse por Supabase Auth y perfiles/roles propios de
`loteria_numeros`; no se crean perfiles innecesarios en esta fase.

El backend usa SQL totalmente cualificado y fija `search_path=pg_catalog`.
Las cargas masivas usan `execute_values` en páginas de 5.000 filas dentro de
una transacción. Un índice parcial único garantiza una sola importación activa
incluso con varias réplicas.

Los dominios quedan cubiertos por sorteos (`DrawService`), números y consultas
(`LotteryRepository` + rutas), importaciones (`ImportService`), descargas
(`SelaeClient`), procesamiento (`parse_lottery_csv`) y tareas programadas
(`scheduler`). Estadísticas no tiene todavía un caso de uso en el producto;
se añadirá como servicio y consulta propia cuando exista un requisito real,
sin introducir ahora una carpeta vacía.

## Decisiones

Se mantienen React, FastAPI, Nginx, Playwright y el diseño visual. No hay
ventaja demostrable en una reescritura. El esquema no se publica en PostgREST:
el único acceso es el backend mediante una conexión PostgreSQL de servidor.
Storage no se usa, por lo que no se crea bucket.
