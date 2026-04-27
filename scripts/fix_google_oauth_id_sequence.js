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
    console.log('Checking max id...');
    const maxRes = await client.query("SELECT MAX(id) as maxid FROM google_oauth_tokens");
    const maxId = maxRes.rows[0].maxid || 0;
    const seqName = 'google_oauth_tokens_id_seq';

    console.log('Creating sequence if not exists:', seqName);
    await client.query(`CREATE SEQUENCE IF NOT EXISTS ${seqName} START WITH ${maxId + 1}`);

    console.log('Setting default for id column to nextval sequence');
    await client.query(`ALTER TABLE google_oauth_tokens ALTER COLUMN id SET DEFAULT nextval('${seqName}')`);

    console.log('Setting sequence value to max(id)');
    await client.query(`SELECT setval('${seqName}', GREATEST((SELECT MAX(id) FROM google_oauth_tokens), 1))`);

    // Add primary key if not exists
    const pkRes = await client.query("SELECT conname FROM pg_constraint WHERE contype = 'p' AND conrelid = 'google_oauth_tokens'::regclass");
    if (pkRes.rows.length === 0) {
      console.log('Adding primary key on id');
      await client.query('ALTER TABLE google_oauth_tokens ADD PRIMARY KEY (id)');
    } else {
      console.log('Primary key already exists:', pkRes.rows.map(r => r.conname).join(','));
    }

    console.log('Done.');
    await client.end();
  } catch (err) {
    console.error('Error fixing id sequence:', err);
    try { await client.end(); } catch(_){}
    process.exit(1);
  }
})();
