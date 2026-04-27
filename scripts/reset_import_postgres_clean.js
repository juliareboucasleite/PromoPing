import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getConfig() {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'papv5',
    port: parseInt(process.env.DB_PORT || '5432', 10),
  };
}

async function applyGoogleOAuthFixes(client) {
  const existsRes = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'google_oauth_tokens'
    ) AS exists
  `);

  if (!existsRes.rows[0].exists) {
    console.log('[post-fix] Tabela google_oauth_tokens não existe, pulando ajustes.');
    return;
  }

  console.log('[post-fix] Corrigindo duplicados de referenciaid...');
  await client.query(`
    WITH ranked AS (
      SELECT
        id,
        referenciaid,
        ROW_NUMBER() OVER (
          PARTITION BY referenciaid
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
        ) AS rn
      FROM google_oauth_tokens
      WHERE referenciaid IS NOT NULL
    )
    DELETE FROM google_oauth_tokens t
    USING ranked r
    WHERE t.id = r.id
      AND r.rn > 1
  `);

  console.log('[post-fix] Garantindo geração automática em id...');
  const idMetaRes = await client.query(`
    SELECT is_identity
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'google_oauth_tokens'
      AND column_name = 'id'
  `);
  const isIdentity = idMetaRes.rows[0]?.is_identity === 'YES';

  if (!isIdentity) {
    await client.query(`CREATE SEQUENCE IF NOT EXISTS google_oauth_tokens_id_seq`);
    await client.query(`
      SELECT setval(
        'google_oauth_tokens_id_seq',
        GREATEST(COALESCE((SELECT MAX(id) FROM google_oauth_tokens), 0), 1)
      )
    `);
    await client.query(`
      ALTER TABLE google_oauth_tokens
      ALTER COLUMN id SET DEFAULT nextval('google_oauth_tokens_id_seq')
    `);
  }

  console.log('[post-fix] Garantindo PK em id...');
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'google_oauth_tokens'::regclass
          AND contype = 'p'
      ) THEN
        ALTER TABLE google_oauth_tokens ADD PRIMARY KEY (id);
      END IF;
    END $$;
  `);

  console.log('[post-fix] Garantindo defaults de timestamp...');
  await client.query(`UPDATE google_oauth_tokens SET created_at = NOW() WHERE created_at IS NULL`);
  await client.query(`UPDATE google_oauth_tokens SET updated_at = NOW() WHERE updated_at IS NULL`);
  await client.query(`ALTER TABLE google_oauth_tokens ALTER COLUMN created_at SET DEFAULT NOW()`);
  await client.query(`ALTER TABLE google_oauth_tokens ALTER COLUMN updated_at SET DEFAULT NOW()`);

  console.log('[post-fix] Garantindo índice único para ON CONFLICT...');
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_google_oauth_tokens_referenciaid
    ON google_oauth_tokens (referenciaid)
  `);
}

async function main() {
  const config = getConfig();
  const sqlPath = path.resolve(__dirname, '..', 'sql', 'PAPv5.postgres.sql');

  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Arquivo SQL não encontrado: ${sqlPath}`);
  }

  let sql = fs.readFileSync(sqlPath, 'utf8');
  // Dump legado contém escapes MySQL (\') que quebram no PostgreSQL.
  sql = sql.replace(/\\'/g, "''");
  // Remove COMMENT inline de colunas (sintaxe MySQL incompatível com PostgreSQL).
  sql = sql.replace(/\s+COMMENT\s+'[^']*'/g, '');
  // Converte sintaxe de VIEW exportada do MySQL para sintaxe PostgreSQL.
  sql = sql.replace(
    /CREATE\s+ALGORITHM=UNDEFINED\s+DEFINER=[^\s]+\s+SQL\s+SECURITY\s+DEFINER\s+VIEW/gi,
    'CREATE OR REPLACE VIEW'
  );
  const client = new Client(config);

  await client.connect();
  console.log(`[reset] Conectado em ${config.host}:${config.port}/${config.database}`);

  try {
    console.log('[reset] Dropando e recriando schema public...');
    await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');

    console.log('[import] Executando dump PAPv5.postgres.sql...');
    await client.query(sql);

    console.log('[post-fix] Aplicando ajustes de compatibilidade...');
    await applyGoogleOAuthFixes(client);

    console.log('[ok] Reset/import concluído com sucesso.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[erro] Falha no reset/import:', err.message);
  console.error(err.stack || err);
  process.exit(1);
});
