param(
    [string]$Container = "loteria_db",
    [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\backups")
)

$ErrorActionPreference = "Stop"
$resolvedRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$resolvedOutput = [IO.Path]::GetFullPath($OutputDirectory)
if (-not $resolvedOutput.StartsWith($resolvedRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "El directorio de backup debe estar dentro del repositorio: $resolvedRoot"
}

New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$name = "loteria_db-$timestamp.dump"
$containerFile = "/tmp/$name"
$hostFile = Join-Path $resolvedOutput $name
$listFile = "$hostFile.list.txt"

docker exec $Container pg_dump `
    --username=postgres `
    --dbname=postgres `
    --schema=loteria_numeros `
    --format=custom `
    --no-owner `
    --no-acl `
    --file=$containerFile
if ($LASTEXITCODE -ne 0) { throw "pg_dump falló" }

docker cp "${Container}:$containerFile" $hostFile
if ($LASTEXITCODE -ne 0) { throw "docker cp falló" }

docker exec $Container pg_restore --list $containerFile |
    Set-Content -LiteralPath $listFile -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw "No se pudo verificar el catálogo del backup" }

docker exec $Container rm $containerFile
$hash = Get-FileHash -LiteralPath $hostFile -Algorithm SHA256

[pscustomobject]@{
    Backup = $hostFile
    Catalog = $listFile
    Bytes = (Get-Item -LiteralPath $hostFile).Length
    SHA256 = $hash.Hash
}
