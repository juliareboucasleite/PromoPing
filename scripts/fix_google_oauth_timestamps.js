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
    console.log('Updating NULL timestamps to now()');
    await client.query("UPDATE google_oauth_tokens SET created_at = now() WHERE created_at IS NULL");
    await client.query("UPDATE google_oauth_tokens SET updated_at = now() WHERE updated_at IS NULL");

    console.log('Altering defaults for created_at and updated_at');
    await client.query("ALTER TABLE google_oauth_tokens ALTER COLUMN created_at SET DEFAULT now()");
    await client.query("ALTER TABLE google_oauth_tokens ALTER COLUMN updated_at SET DEFAULT now()");

    console.log('Done.');
    await client.end();
  } catch (err) {
    console.error('Error fixing timestamps:', err);
    try { await client.end(); } catch(_){}
    process.exit(1);
  }
})();
