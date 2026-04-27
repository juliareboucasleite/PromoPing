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
    if (dupIds.rows.length === 0) {
      console.log('No duplicates found');
      await client.end();
      return;
    }
    for (const row of dupIds.rows) {
      const referencia = row.referenciaid;
      console.log('Deduplicating', referencia);
      // delete all but the most recently updated row for this ReferenciaID
      const delRes = await client.query(
        `DELETE FROM google_oauth_tokens WHERE ctid IN (
          SELECT ctid FROM google_oauth_tokens WHERE ReferenciaID = $1 ORDER BY updated_at DESC, id DESC OFFSET 1
        )`,
        [referencia]
      );
      console.log('Deleted rows count for', referencia, ':', delRes.rowCount);
    }

    // try to create unique index now
    try {
      const idxRes = await client.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_google_oauth_tokens_referenciaid ON google_oauth_tokens (ReferenciaID);");
      console.log('Index creation result:', idxRes.command || idxRes);
    } catch (idxErr) {
      console.error('Error creating unique index after dedupe:', idxErr);
    }

    await client.end();
  } catch (err) {
    console.error('Error during dedupe:', err);
    try { await client.end(); } catch (_) {}
    process.exit(1);
  }
})();
