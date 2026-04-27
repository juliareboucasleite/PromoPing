#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function parseArgs() {
  const args = {};
  const raw = process.argv.slice(2);
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = raw[i+1] && !raw[i+1].startsWith('--') ? raw[++i] : true;
      args[k] = v;
    }
  }
  return args;
}

(async function main(){
  try {
    const args = parseArgs();
    const host = args.host || process.env.PGHOST || 'localhost';
    const port = parseInt(args.port || process.env.PGPORT || '5432');
    const user = args.user || process.env.PGUSER || 'postgres';
    const password = args.password || process.env.PGPASSWORD || '';
    const database = args.database || process.env.PGDATABASE || 'papv5';

    const sqlPath = path.resolve(__dirname, '..', 'sql', 'PAPv5.postgres.sql');
    if (!fs.existsSync(sqlPath)) {
      console.error('Arquivo SQL não encontrado em', sqlPath);
      process.exit(2);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log(`Conectando em ${host}:${port} DB=${database} como ${user}...`);

    const client = new Client({ host, port, user, password, database });
    await client.connect();

    console.log('Executando import SQL... (pode demorar alguns segundos)');
    await client.query(sql);
    console.log('Importação concluída com sucesso.');

    console.log('Ajustando sequences para colunas Id...');
    const adjustSeq = `DO $$
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
$$;`;

    await client.query(adjustSeq);
    console.log('Sequences ajustadas com sucesso.');

    await client.end();
    console.log('Pronto. Atualize .env e reinicie o backend.');

    process.exit(0);
  } catch (err) {
    console.error('Erro durante a importação:', err.message || err);
    console.error(err.stack || '');
    process.exit(1);
  }
})();
