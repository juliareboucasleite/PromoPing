#!/usr/bin/env node

/**
 * Script de Execução Rápida para PromoPing
 * Detecta automaticamente o melhor método de execução
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cores para output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkCommand(command) {
    try {
        if (process.platform === 'win32') {
            execSync(`where ${command}`, { stdio: 'ignore' });
        } else {
            execSync(`which ${command}`, { stdio: 'ignore' });
        }
        return true;
    } catch {
        return false;
    }
}

function checkFile(file) {
    return fs.existsSync(path.join(__dirname, file));
}

function runSetup() {
    log('🔧 Executando setup automático...', 'blue');
    try {
        execSync('node scripts/setup.js', { stdio: 'inherit', cwd: __dirname });
        return true;
    } catch (error) {
        log('❌ Erro no setup automático', 'red');
        return false;
    }
}

function runDocker() {
    log('🐳 Iniciando com Docker...', 'blue');
    log('📦 Isso pode demorar alguns minutos na primeira vez...', 'yellow');
    
    const dockerComposeFile = checkFile('docker-compose.dev.yml') ? 'docker-compose.dev.yml' : 'docker-compose.yml';
    
    try {
        execSync(`docker-compose -f ${dockerComposeFile} up --build`, { 
            stdio: 'inherit', 
            cwd: __dirname 
        });
    } catch (error) {
        log('❌ Erro ao executar Docker', 'red');
        process.exit(1);
    }
}

function runLocal() {
    log('💻 Iniciando localmente...', 'blue');
    
    // Verificar se .env existe
    if (!checkFile('.env')) {
        log('⚠️ Arquivo .env não encontrado, executando setup...', 'yellow');
        if (!runSetup()) {
            log('❌ Falha no setup, não é possível continuar', 'red');
            process.exit(1);
        }
    }
    
    // Verificar dependências
    if (!checkCommand('node')) {
        log('❌ Node.js não encontrado. Instale Node.js primeiro.', 'red');
        process.exit(1);
    }
    
    // Instalar dependências se necessário
    if (!checkFile('node_modules')) {
        log('📦 Instalando dependências...', 'blue');
        try {
            execSync('npm install', { stdio: 'inherit', cwd: __dirname });
        } catch (error) {
            log('❌ Erro ao instalar dependências', 'red');
            process.exit(1);
        }
    }
    
    // Iniciar servidor
    log('🚀 Iniciando servidor...', 'green');
    try {
        const server = spawn('node', ['server.js'], { 
            stdio: 'inherit', 
            cwd: __dirname 
        });
        
        server.on('error', (error) => {
            log(`❌ Erro no servidor: ${error.message}`, 'red');
            process.exit(1);
        });
        
        // Graceful shutdown
        process.on('SIGINT', () => {
            log('\n🛑 Parando servidor...', 'yellow');
            server.kill('SIGINT');
            process.exit(0);
        });
        
    } catch (error) {
        log(`❌ Erro ao iniciar servidor: ${error.message}`, 'red');
        process.exit(1);
    }
}

function main() {
    log('🎯 PromoPing - Execução Rápida', 'bright');
    log('================================', 'bright');
    
    const args = process.argv.slice(2);
    const mode = args[0] || 'auto';
    
    switch (mode) {
        case 'docker':
            if (checkCommand('docker') && checkCommand('docker-compose')) {
                runDocker();
            } else {
                log('❌ Docker não encontrado. Instale Docker e Docker Compose.', 'red');
                process.exit(1);
            }
            break;
            
        case 'local':
            runLocal();
            break;
            
        case 'setup':
            runSetup();
            break;
            
        case 'auto':
        default:
            // Detectar melhor método
            if (checkCommand('docker') && checkCommand('docker-compose')) {
                log('🐳 Docker detectado, usando Docker...', 'green');
                runDocker();
            } else {
                log('💻 Docker não encontrado, usando execução local...', 'yellow');
                runLocal();
            }
            break;
    }
}

// Mostrar ajuda
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    log('🎯 PromoPing - Execução Rápida', 'bright');
    log('================================', 'bright');
    log('');
    log('Uso: node run.js [modo]', 'cyan');
    log('');
    log('Modos disponíveis:', 'blue');
    log('  auto    - Detecta automaticamente o melhor método (padrão)', 'green');
    log('  docker  - Força execução com Docker', 'green');
    log('  local   - Força execução local', 'green');
    log('  setup   - Apenas executa o setup', 'green');
    log('');
    log('Exemplos:', 'blue');
    log('  node run.js           # Execução automática', 'cyan');
    log('  node run.js docker    # Com Docker', 'cyan');
    log('  node run.js local     # Local', 'cyan');
    log('  node run.js setup     # Apenas setup', 'cyan');
    log('');
    process.exit(0);
}

main();
