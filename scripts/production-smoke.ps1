param(
    [string]$ApiBase = "http://localhost:8080/apps/loteria-consulta/api",
    [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\artifacts")
)

$ErrorActionPreference = "Stop"
$health = Invoke-WebRequest -Uri "$ApiBase/health" -UseBasicParsing -TimeoutSec 10
$state = (
    Invoke-WebRequest -Uri "$ApiBase/importacion-estado" -UseBasicParsing -TimeoutSec 10
).Content | ConvertFrom-Json
$query = (
    Invoke-WebRequest -Uri (
        "$ApiBase/numeros?tipo_filtro=empieza&filtro_valor=00" +
        "&orden=asc&limit=5&offset=0"
    ) -UseBasicParsing -TimeoutSec 10
).Content | ConvertFrom-Json

$backendHealth = docker inspect loteria_backend_supabase `
    --format "{{.State.Health.Status}}"
if ($LASTEXITCODE -ne 0) { throw "No se pudo inspeccionar el backend" }
$frontendStatus = docker inspect loteria_frontend_supabase `
    --format "{{.State.Status}}"
if ($LASTEXITCODE -ne 0) { throw "No se pudo inspeccionar el frontend" }
$legacyCount = @(
    docker ps -a --filter "label=com.docker.compose.project=loterianacional" `
        --format "{{.Names}}"
).Count

if ($health.StatusCode -ne 200 -or $backendHealth -ne "healthy") {
    throw "La aplicación no está sana"
}
if ($state.total_registros -ne 28283 -or $query.total -ne 745) {
    throw "Los conteos de control no coinciden"
}
if ($legacyCount -ne 0) {
    throw "Han reaparecido contenedores del proyecto antiguo"
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$result = [ordered]@{
    checked_at = (Get-Date).ToUniversalTime().ToString("o")
    health_status = $health.StatusCode
    backend_health = $backendHealth
    frontend_status = $frontendStatus
    total_registros = $state.total_registros
    prefix_00_total = $query.total
    legacy_containers = $legacyCount
}
$json = $result | ConvertTo-Json -Compress
Add-Content -LiteralPath (
    Join-Path $OutputDirectory "production-validation.jsonl"
) -Value $json -Encoding utf8
$result
