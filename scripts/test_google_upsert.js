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
    const referencia = 'REF-543020393';
    const accessToken = 'TEST_ACCESS_TOKEN_' + Date.now();
    const refreshToken = null;
    const expiresAt = new Date(Date.now() + 3600 * 1000);
    const scope = 'calendar.readonly';

    const sql = `INSERT INTO google_oauth_tokens (ReferenciaID, access_token, refresh_token, expires_at, scope)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (ReferenciaID) DO UPDATE SET
                   access_token = EXCLUDED.access_token,
                   refresh_token = EXCLUDED.refresh_token,
                   expires_at = EXCLUDED.expires_at,
                   scope = EXCLUDED.scope,
                   updated_at = NOW()`;

    const res = await client.query(sql, [referencia, accessToken, refreshToken, expiresAt, scope]);
    console.log('Upsert result:', res.command, res.rowCount);
    await client.end();
  } catch (err) {
    console.error('Upsert error:', err);
    try { await client.end(); } catch(_) {}
    process.exit(1);
  }
})();
