#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function createEnvFile() {
  const envPath = path.join(projectRoot, ".env");
  if (fs.existsSync(envPath)) {
    log(" Arquivo .env já existe", "green");
    return;
  }

  const envContent = `
APP_ENV=development
APP_DEBUG=true
APP_URL=http://localhost:3000

# Base de dados local (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_NAME=papv5

# JWT Secret
JWT_SECRET=dev-secret-key-change-in-production

HOST=127.0.0.1
PORT=3000
`;

  fs.writeFileSync(envPath, envContent.trim(), "utf8");
  log(" Arquivo .env criado com configurações padrão de PostgreSQL", "green");
}

function loadEnv() {
  const envPath = path.join(projectRoot, ".env");
  if (!fs.existsSync(envPath)) return {};

  const env = {};
  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    env[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return env;
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: false,
    ...options,
  });
}

function queryPsql(envConfig, database, sql) {
  return spawnSync("psql", [
    "-h", envConfig.DB_HOST || "localhost",
    "-p", envConfig.DB_PORT || "5432",
    "-U", envConfig.DB_USER || "postgres",
    "-d", database,
    "-tAc", sql,
  ], {
    cwd: projectRoot,
    shell: false,
    encoding: "utf8",
    env: {
      ...process.env,
      PGPASSWORD: envConfig.DB_PASSWORD || "",
    },
  });
}

async function setupDatabase() {
  log("\n Configurando base de dados PostgreSQL...", "blue");
  const envConfig = loadEnv();
  const dbName = envConfig.DB_NAME || "papv5";

  const buildResult = run("node", ["scripts/build-postgres-init.js"]);
  if (buildResult.status !== 0) {
    throw new Error("Falha ao gerar sql/PAPv5.postgres.sql");
  }

  const existsResult = queryPsql(envConfig, "postgres", `SELECT 1 FROM pg_database WHERE datname = '${dbName.replace(/'/g, "''")}'`);
  if (existsResult.status !== 0) {
    throw new Error((existsResult.stderr || "").trim() || "Não foi possível consultar o PostgreSQL");
  }

  if (!String(existsResult.stdout || "").trim()) {
    const createResult = run("psql", [
      "-h", envConfig.DB_HOST || "localhost",
      "-p", envConfig.DB_PORT || "5432",
      "-U", envConfig.DB_USER || "postgres",
      "-d", "postgres",
      "-c", `CREATE DATABASE "${dbName.replace(/"/g, "\"\"")}"`,
    ], {
      env: {
        ...process.env,
        PGPASSWORD: envConfig.DB_PASSWORD || "",
      },
    });

    if (createResult.status !== 0) {
      throw new Error(`Falha ao criar a base de dados ${dbName}`);
    }
  }

  const importResult = run("psql", [
    "-h", envConfig.DB_HOST || "localhost",
    "-p", envConfig.DB_PORT || "5432",
    "-U", envConfig.DB_USER || "postgres",
    "-d", dbName,
    "-f", path.join("sql", "PAPv5.postgres.sql"),
  ], {
    env: {
      ...process.env,
      PGPASSWORD: envConfig.DB_PASSWORD || "",
    },
  });

  if (importResult.status !== 0) {
    throw new Error("Importação SQL falhou");
  }

  log(" Base de dados PostgreSQL configurada com sucesso", "green");
}

async function main() {
  log(" Setup PromoPing iniciado", "bright");
  createEnvFile();

  try {
    await setupDatabase();
  } catch (error) {
    log(" Erro ao configurar a base de dados. Execute manualmente:", "yellow");
    log("   node scripts/build-postgres-init.js", "cyan");
    log("   psql -U postgres -d papv5 -f sql/PAPv5.postgres.sql", "cyan");
    if (error.message) {
      log(`   Erro: ${error.message}`, "red");
    }
  }

  log("\n Setup concluído!", "green");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
