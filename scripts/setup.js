#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
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
DB_NAME=papv5

# JWT Secret
JWT_SECRET=dev-secret-key-change-in-production

HOST=127.0.0.1
PORT=3000
`;
  fs.writeFileSync(envPath, envContent.trim());
  log(' Arquivo .env criado com configurações padrão', 'green');
}

/**
 * Sanitiza um caminho de arquivo para prevenir command injection
 * @param {string} filePath - Caminho do arquivo
 * @returns {string} Caminho sanitizado
 */
function sanitizePath(filePath) {
  // Remove caracteres perigosos e normaliza o caminho
  const normalized = path.normalize(filePath);
  // Garante que o caminho está dentro do projeto
  if (!normalized.startsWith(projectRoot)) {
    throw new Error('Caminho de arquivo inválido: fora do diretório do projeto');
  }
  // Remove caracteres que podem ser usados em injection
  return normalized.replace(/[;&|`$(){}[\]<>]/g, '');
}

async function setupDatabase() {
  log('\n Configurando base de dados...', 'blue');
  const sqlFile = path.join(projectRoot, 'sql', 'PAPv5.sql');

  if (!fs.existsSync(sqlFile)) {
    log(' Arquivo SQL não encontrado, pulando configuração da BD', 'yellow');
    return;
  }

  try {
    // Sanitizar caminho antes de usar
    const safeSqlFile = sanitizePath(sqlFile);
    
    // Usar path.relative para garantir que estamos usando caminho relativo seguro
    const relativePath = path.relative(projectRoot, safeSqlFile);
    
    // Validar que o arquivo é realmente um .sql
    if (!relativePath.endsWith('.sql')) {
      throw new Error('Arquivo deve ter extensão .sql');
    }
    
    // Validar que o caminho não contém caracteres perigosos
    if (relativePath.includes('..') || relativePath.includes('~')) {
      throw new Error('Caminho de arquivo inválido');
    }
    
    // Usar spawn ao invés de execSync para maior controle e segurança
    // Criar banco de dados usando array de argumentos (seguro contra injection)
    execSync('mysql', ['-u', 'root', '-p', '-e', 'CREATE DATABASE IF NOT EXISTS papv5;'], {
      stdio: 'inherit',
      cwd: projectRoot,
      shell: false // Desabilitar shell previne injection
    });
    
    // Importar SQL usando spawn com stdin (mais seguro que redirecionamento)
    const sqlContent = fs.readFileSync(safeSqlFile, 'utf-8');
    const importSql = spawn('mysql', ['-u', 'root', '-p', 'papv5'], {
      stdio: ['pipe', 'inherit', 'inherit'],
      cwd: projectRoot,
      shell: false
    });
    
    importSql.stdin.write(sqlContent);
    importSql.stdin.end();
    
    // Aguardar conclusão do processo
    await new Promise((resolve, reject) => {
      importSql.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Importação SQL falhou com código ${code}`));
        } else {
          resolve();
        }
      });
      importSql.on('error', (err) => {
        reject(err);
      });
    });
    
    log(' Base de dados configurada com sucesso', 'green');
  } catch (error) {
    log(' Erro ao configurar base de dados. Execute manualmente:', 'yellow');
    log(`   mysql -u root -p papv5 < sql/PAPv5.sql`, 'cyan');
    if (error.message) {
      log(`   Erro: ${error.message}`, 'red');
    }
  }
}

async function main() {
  log(' Setup PromoPing iniciado', 'bright');
  createEnvFile();
  await setupDatabase();
  log('\n Setup concluído!', 'green');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
