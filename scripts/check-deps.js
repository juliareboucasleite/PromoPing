#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

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

function checkFile(file) {
  return fs.existsSync(path.join(projectRoot, file));
}

function checkEnvFile() {
  if (!checkFile('.env')) return { status: false, message: 'Arquivo .env não encontrado' };

  const envContent = fs.readFileSync(path.join(projectRoot, '.env'), 'utf8');
  const requiredVars = ['DB_HOST', 'DB_USER', 'DB_NAME'];
  const missingVars = requiredVars.filter(v => !envContent.includes(v));

  return missingVars.length > 0
    ? { status: false, message: `Variáveis faltando: ${missingVars.join(', ')}` }
    : { status: true, message: 'Arquivo .env OK' };
}

function main() {
  log('🔍 Verificador de dependências PromoPing', 'bright');

  if (!checkFile('package.json')) log('❌ package.json não encontrado', 'red');
  if (!checkFile('node_modules')) log('⚠️ node_modules não encontrado. Execute npm install', 'yellow');
  const envCheck = checkEnvFile();
  log(envCheck.message, envCheck.status ? 'green' : 'red');
}

main();
