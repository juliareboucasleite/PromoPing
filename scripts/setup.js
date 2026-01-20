#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Cores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function createEnvFile() {
  const envPath = path.join(projectRoot, '.env');
  if (fs.existsSync(envPath)) {
    log(' Arquivo .env já existe', 'green');
    return;
  }

  const envContent = `
APP_ENV=development
APP_DEBUG=true
APP_URL=http://localhost:3000

# Base de dados local
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=pap

# JWT Secret
JWT_SECRET=dev-secret-key-change-in-production

HOST=127.0.0.1
PORT=3000
`;
  fs.writeFileSync(envPath, envContent.trim());
  log(' Arquivo .env criado com configurações padrão', 'green');
}

function setupDatabase() {
  log('\n Configurando base de dados...', 'blue');
  const sqlFile = path.join(projectRoot, 'sql', 'PAPv5.sql');

  if (!fs.existsSync(sqlFile)) {
    log(' Arquivo SQL não encontrado, pulando configuração da BD', 'yellow');
    return;
  }

  try {
    execSync(`mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS pap;"`, { stdio: 'inherit' });
    execSync(`mysql -u root -p pap < "${sqlFile}"`, { stdio: 'inherit' });
    log(' Base de dados configurada com sucesso', 'green');
  } catch (error) {
    log(' Erro ao configurar base de dados. Execute manualmente:', 'yellow');
    log(`   mysql -u root -p pap < ${sqlFile}`, 'cyan');
  }
}

function main() {
  log(' Setup PromoPing iniciado', 'bright');
  createEnvFile();
  setupDatabase();
  log('\n Setup concluído!', 'green');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
