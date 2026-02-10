#!/usr/bin/env node
/**
 * Inicia o Nginx em Docker para desenvolvimento.
 * Verifica se frontend/pages/build existe antes de subir.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const buildDir = path.join(projectRoot, 'frontend', 'pages', 'build');
const indexHtml = path.join(buildDir, 'index.html');
const composePath = path.join(projectRoot, 'docker-files', 'docker-compose.nginx.yml');

function log(msg, color = '') {
  const c = { red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', reset: '\x1b[0m' };
  console.log(`${c[color] || ''}${msg}${c.reset}`);
}

if (!fs.existsSync(buildDir)) {
  log('\n[NGINX] A pasta do frontend build não existe.', 'red');
  log(`        Esperado: frontend/pages/build`, 'yellow');
  log('        Gera o build com: npm run prepare:frontend\n', 'yellow');
  process.exit(1);
}

if (!fs.existsSync(indexHtml)) {
  log('\n[NGINX] A pasta frontend/pages/build existe mas não contém index.html.', 'red');
  log('        Gera o build com: npm run prepare:frontend\n', 'yellow');
  process.exit(1);
}

if (!fs.existsSync(composePath)) {
  log('\n[NGINX] Ficheiro docker-compose.nginx.yml não encontrado.', 'red');
  process.exit(1);
}

log('[NGINX] A iniciar Nginx (Docker)...', 'green');
const proc = spawn(
  'docker',
  ['compose', '-f', 'docker-files/docker-compose.nginx.yml', 'up', '-d'],
  { stdio: 'inherit', shell: true, cwd: projectRoot }
);
proc.on('close', (code) => process.exit(code ?? 0));
