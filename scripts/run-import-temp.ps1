# Generated wrapper to run import-postgres.ps1 with provided env vars
$env:PGHOST='1234'
$env:PGPORT='5432'
$env:PGUSER='postgres'
$env:PGPASSWORD='1234'
$env:PGDATABASE='papv5'

Write-Host "Invoking import-postgres.ps1 with env vars..."
 & "$PSScriptRoot\import-postgres.ps1"
 & "$PSScriptRoot\import-postgres.ps1"
