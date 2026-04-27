const { Client } = require('pg');
(async () => {
  const client = new Client({ host: '127.0.0.1', port: 5432, user: 'postgres', password: '1234', database: 'papv5' });
  try {
    await client.connect();
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name LIMIT 200");
    console.log('Tables in public schema:');
    res.rows.forEach(r => console.log(' -', r.table_name));
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('DB check failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
