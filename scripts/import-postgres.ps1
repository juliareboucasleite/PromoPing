# Importa o arquivo sql/PAPv5.postgres.sql para um banco PostgreSQL e ajusta sequences para colunas Id
param(
  [string]$DBHost = $env:PGHOST -or 'localhost',
  [string]$DBPort = $env:PGPORT -or '5432',
  [string]$DBUser = $env:PGUSER -or 'postgres',
  [string]$DBPassword = $env:PGPASSWORD -or '',
  [string]$DBName = $env:PGDATABASE -or 'papv5'
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$sqlFile = Join-Path $scriptDir '..\sql\PAPv5.postgres.sql'
$sqlFile = (Resolve-Path $sqlFile).Path

function Check-Psql {
  $psql = Get-Command psql -ErrorAction SilentlyContinue
  if (-not $psql) {
    Write-Error "psql não encontrado no PATH. Instale o cliente psql ou adicione ao PATH."
    exit 2
  }
}

Check-Psql

if (-not (Test-Path $sqlFile)) {
  Write-Error "Arquivo SQL não encontrado em: $sqlFile"
  exit 2
}

# Define PGPASSWORD para psql (somente nesta sessão)
if ($DBPassword -ne '') {
  $env:PGPASSWORD = $DBPassword
}

Write-Host "Conectando em ${DBHost}:${DBPort} (DB=${DBName}) como ${DBUser}..."

$psqlArgs = @('-h', $DBHost, '-p', $DBPort, '-U', $DBUser, '-d', $DBName, '-f', $sqlFile)

$proc = Start-Process -FilePath psql -ArgumentList $psqlArgs -NoNewWindow -Wait -PassThru -RedirectStandardOutput ([IO.Path]::GetTempFileName()) -RedirectStandardError ([IO.Path]::GetTempFileName())
if ($proc.ExitCode -ne 0) {
  Write-Error "Importação falhou. Verifique credenciais e se o servidor Postgres está acessível."
  exit $proc.ExitCode
}
Write-Host "Importação concluída com sucesso." -ForegroundColor Green

# Agora criar/ajustar sequences para colunas Id sem DEFAULT
$tempSql = [IO.Path]::Combine([IO.Path]::GetTempPath(), [IO.Path]::GetRandomFileName() + '.sql')
@"
DO $$
DECLARE
  r record;
  seq_name text;
  max_id bigint;
BEGIN
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.columns c
    WHERE c.column_name = 'Id'
      AND c.data_type IN ('integer','bigint')
      AND c.table_schema = 'public'
  LOOP
    -- Se não há default para a coluna Id, criamos uma sequence e definimos DEFAULT nextval
    PERFORM 1 FROM information_schema.columns WHERE table_schema = r.table_schema AND table_name = r.table_name AND column_name='Id' AND column_default IS NOT NULL;
    IF NOT FOUND THEN
      seq_name := r.table_schema || '.' || r.table_name || '_id_seq';
      EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I', seq_name);
      EXECUTE format('SELECT COALESCE(MAX(Id),0) FROM %I.%I', r.table_schema, r.table_name) INTO max_id;
      IF max_id IS NULL THEN
        max_id := 0;
      END IF;
      EXECUTE format('ALTER SEQUENCE %I RESTART WITH %s', seq_name, (max_id + 1));
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN Id SET DEFAULT nextval(%L)', r.table_schema, r.table_name, seq_name);
    END IF;
  END LOOP;
END
$$;
"@ > $tempSql

Write-Host "Ajustando sequences para colunas 'Id' (criação automática de sequences)..."
$psqlArgs2 = @('-h', $DBHost, '-p', $DBPort, '-U', $DBUser, '-d', $DBName, '-f', $tempSql)
$proc2 = Start-Process -FilePath psql -ArgumentList $psqlArgs2 -NoNewWindow -Wait -PassThru -RedirectStandardOutput ([IO.Path]::GetTempFileName()) -RedirectStandardError ([IO.Path]::GetTempFileName())
Remove-Item $tempSql -ErrorAction SilentlyContinue
if ($proc2.ExitCode -ne 0) {
  Write-Warning "Ajuste de sequences retornou código $($proc2.ExitCode). Verifique manualmente as sequences no banco."
} else {
  Write-Host "Sequences ajustadas com sucesso." -ForegroundColor Green
}

Write-Host "Pronto. Atualize seu arquivo .env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME) e reinicie o backend."