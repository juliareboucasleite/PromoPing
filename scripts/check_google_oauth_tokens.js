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

    console.log('== Indexes ==');
    const idxRes = await client.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'google_oauth_tokens';");
    console.table(idxRes.rows);

    console.log('\n== Constraints ==');
    const consRes = await client.query("SELECT c.conname, c.contype, pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'google_oauth_tokens';");
    console.table(consRes.rows);

    console.log('\n== Columns ==');
    const colRes = await client.query("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'google_oauth_tokens' ORDER BY ordinal_position;");
    console.table(colRes.rows);

    await client.end();
  } catch (err) {
    console.error('Error checking google_oauth_tokens:', err);
    try { await client.end(); } catch (_) {}
    process.exit(1);
  }
})();
