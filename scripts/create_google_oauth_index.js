import pg from 'pg';
const { Client } = pg;
(async () => {
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'papv5',
    port: parseInt(process.env.DB_PORT) || 5432,
  });
  try {
    await client.connect();
    const res = await client.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_google_oauth_tokens_referenciaid ON google_oauth_tokens (ReferenciaID);");
    console.log('CREATE INDEX result:', res.command || res);
    await client.end();
  } catch (err) {
    console.error('Error creating index:', err);
    try { await client.end(); } catch (_) {}
    process.exit(1);
  }
})();
