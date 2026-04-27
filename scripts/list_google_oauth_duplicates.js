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
    const dupIds = await client.query("SELECT ReferenciaID, COUNT(*) as cnt FROM google_oauth_tokens GROUP BY ReferenciaID HAVING COUNT(*)>1;");
    console.log('Duplicate ReferenciaIDs:');
    console.table(dupIds.rows);

    for (const row of dupIds.rows) {
      console.log('\nRows for', row.referenciaid);
      const rows = await client.query("SELECT id, referenciaid, access_token, refresh_token, expires_at, created_at, updated_at FROM google_oauth_tokens WHERE ReferenciaID = $1 ORDER BY updated_at DESC, id DESC", [row.referenciaid]);
      console.table(rows.rows);
    }

    await client.end();
  } catch (err) {
    console.error('Error listing duplicates:', err);
    try { await client.end(); } catch (_) {}
    process.exit(1);
  }
})();
