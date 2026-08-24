param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,
    [switch]$Apply
)

$ErrorActionPreference = "Stop"
if (-not $Apply) {
    throw "Operación no ejecutada. Añada -Apply tras validar backup, migraciones y ventana."
}
if (-not $env:TARGET_DATABASE_URL) {
    throw "Falta TARGET_DATABASE_URL en el entorno."
}

$resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
pg_restore `
    --dbname=$env:TARGET_DATABASE_URL `
    --data-only `
    --schema=loteria_numeros `
    --no-owner `
    --no-acl `
    --single-transaction `
    --exit-on-error `
    $resolvedBackup
if ($LASTEXITCODE -ne 0) { throw "La copia de datos falló y se revirtió." }

Write-Output "Copia terminada. Ejecute scripts/compare-data.sql en origen y destino."
