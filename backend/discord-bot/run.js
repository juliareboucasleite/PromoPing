// PromoPing - Script de execução principal
// Silenciar dotenv globalmente
process.env.DOTENV_CONFIG_SILENT = 'true';
process.env.DOTENV_CONFIG_DEBUG = 'false';

// Interceptar console.log para filtrar mensagens do dotenv
const originalConsoleLog = console.log;
console.log = (...args) => {
    const message = args.join(' ');
    if (!message.includes('[dotenv@') && !message.includes('injecting env')) {
        originalConsoleLog(...args);
    }
};

import {
    execSync,
    spawn
} from 'child_process';
import fs from 'fs';
import path from 'path';
import {
    fileURLToPath
} from 'url';

const __filename = fileURLToPath(
    import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '../..');

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
            execSync(`where ${command}`, {
                stdio: 'ignore'
            });
        } else {
            execSync(`which ${command}`, {
                stdio: 'ignore'
            });
        }
        return true;
    } catch {
        return false;
    }
}

function checkFile(file) {
    return fs.existsSync(path.join(rootDir, file));
}

function runSetup() {
    log('Executando setup automático...', 'blue');
    try {
        execSync('node scripts/setup.js', {
            stdio: 'inherit',
            cwd: rootDir
        });
        return true;
    } catch (error) {
        log('Erro no setup automático', 'red');
        return false;
    }
}

function runDocker() {
    log('Iniciando com Docker...', 'blue');
    log('Isso pode demorar alguns minutos na primeira vez...', 'yellow');

    const dockerComposeFile = checkFile('docker-files/docker-compose.dev.yml') ? 'docker-files/docker-compose.dev.yml' : 'docker-files/docker-compose.yml';

    try {
        execSync(`docker-compose -f ${dockerComposeFile} up --build`, {
            stdio: 'inherit',
            cwd: rootDir
        });
    } catch (error) {
        log('Erro ao executar Docker', 'red');
        process.exit(1);
    }
}

function runLocal() {
    // Log removido para reduzir verbosidade

    // Verificar se .env existe
    if (!checkFile('.env')) {
        log('Arquivo .env não encontrado, executando setup...', 'yellow');
        if (!runSetup()) {
            log('Falha no setup, não é possível continuar', 'red');
            process.exit(1);
        }
    }

    // Verificar dependências
    if (!checkCommand('node')) {
        log('Node.js não encontrado. Instale Node.js primeiro.', 'red');
        process.exit(1);
    }

    // Instalar dependências se necessário
    if (!checkFile('node_modules')) {
        log('Instalando dependências...', 'blue');
        try {
            execSync('npm install', {
                stdio: 'inherit',
                cwd: rootDir
            });
        } catch (error) {
            log('Erro ao instalar dependências', 'red');
            process.exit(1);
        }
    }

    // Array para armazenar todos os processos
    const processes = [];

    // Iniciar Rich Presence (se disponível)
    let presenceProcess = null;
    if (checkFile('presence.js')) {
        // Inicia silenciosamente
        try {
            presenceProcess = spawn('node', ['presence.js'], {
                stdio: 'pipe',
                cwd: rootDir
            });
            processes.push(presenceProcess);

            presenceProcess.stdout.on('data', (data) => {
                const message = data.toString().trim()
                    .replace(/[]/g, '')
                    .replace(/^\s+|\s+$/g, '');

                if (message === '') return;

                // Só mostra erros críticos
                if (message.includes('Erro') || message.includes('ERROR') || message.includes('FATAL')) {
                    log(`Rich Presence: ${message}`, 'red');
                }
                // Ignora todas as outras mensagens (incluindo conexão bem-sucedida)
            });

            presenceProcess.stderr.on('data', (data) => {
                const message = data.toString().trim();
                if (message.includes('Client ID')) {
                    log('Configure seu Client ID do Discord no presence.js', 'yellow');
                } else {
                    log(`Rich Presence: ${message}`, 'red');
                }
            });

            presenceProcess.on('error', (error) => {
                log(`Erro no Rich Presence: ${error.message}`, 'red');
            });

        } catch (error) {
            log('Não foi possível iniciar Rich Presence', 'yellow');
        }
    }

    // Iniciar Bot do Discord
    let discordBotProcess = null;
    // Verificar se package.json existe na pasta atual (já estamos em backend/discord-bot)
    if (fs.existsSync(path.join(__dirname, 'package.json'))) {
        // Inicia silenciosamente
        try {
            // Verificar se as dependências do bot estão instaladas
            const botNodeModules = path.join(__dirname, 'node_modules');
            if (!fs.existsSync(botNodeModules)) {
                log('Instalando dependências do bot do Discord...', 'yellow');
                try {
                    execSync('npm install', {
                        stdio: 'inherit',
                        cwd: __dirname
                    });
                } catch (error) {
                    log('Aviso: Erro ao instalar dependências do bot, continuando...', 'yellow');
                }
            }

            discordBotProcess = spawn('node', ['index.js'], {
                cwd: __dirname,
                stdio: 'pipe'
            });
            processes.push(discordBotProcess);

            discordBotProcess.stdout.on('data', (data) => {
                const message = data.toString().trim();
                // Mostrar apenas erros críticos do bot
                if (message && (
                        message.includes('ERROR') ||
                        message.includes('FATAL') ||
                        message.includes('CRITICAL') ||
                        message.includes('Erro ao verificar lives')
                    )) {
                    log(`Bot Discord: ${message}`, 'magenta');
                }
                // Ignorar mensagens de sucesso e rotinas normais
            });

            discordBotProcess.stderr.on('data', (data) => {
                const message = data.toString().trim();
                // Mostrar erros importantes, ignorando apenas deprecations
                if (message &&
                    !message.includes('DeprecationWarning') &&
                    !message.includes('Use `node --trace-deprecation') &&
                    (message.includes('ERROR') ||
                        message.includes('FATAL') ||
                        message.includes('CRITICAL') ||
                        message.includes('Erro') ||
                        message.includes('Falha'))
                ) {
                    log(`Bot Discord: ${message}`, 'red');
                }
            });

            discordBotProcess.on('error', (error) => {
                log(`Erro no Bot do Discord: ${error.message}`, 'red');
            });

        } catch (error) {
            log(`Não foi possível iniciar Bot do Discord: ${error.message}`, 'yellow');
        }
    } else {
        log('Bot do Discord não encontrado, pulando...', 'yellow');
    }

    // Iniciar servidor (log removido - servidor mostra sua própria mensagem)
    try {
        const server = spawn('node', ['backend/server.js'], {
            stdio: 'inherit',
            cwd: rootDir
        });
        processes.push(server);

        server.on('error', (error) => {
            log(`Erro no servidor: ${error.message}`, 'red');
            // Parar todos os processos
            processes.forEach(proc => {
                if (proc && !proc.killed) {
                    proc.kill('SIGTERM');
                }
            });
            process.exit(1);
        });

        // Graceful shutdown
        const shutdown = (signal) => {
            log(`\n${signal} recebido. Parando todos os serviços...`, 'yellow');

            // Parar todos os processos
            processes.forEach((proc, index) => {
                if (proc && !proc.killed) {
                    const names = ['Rich Presence', 'Bot Discord', 'Servidor'];
                    const name = names[index] || `Processo ${index + 1}`;
                    log(`Parando ${name}...`, 'yellow');
                    proc.kill(signal);
                }
            });

            // Aguardar um pouco e forçar encerramento se necessário
            setTimeout(() => {
                processes.forEach(proc => {
                    if (proc && !proc.killed) {
                        proc.kill('SIGKILL');
                    }
                });
                process.exit(0);
            }, 5000);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));

        // Log removido para reduzir verbosidade - servidor mostra suas próprias mensagens

    } catch (error) {
        log(`Erro ao iniciar servidor: ${error.message}`, 'red');
        // Parar todos os processos em caso de erro
        processes.forEach(proc => {
            if (proc && !proc.killed) {
                proc.kill('SIGTERM');
            }
        });
        process.exit(1);
    }
}

function main() {
    // Logs de cabeçalho removidos para reduzir verbosidade

    const args = process.argv.slice(2);
    const mode = args[0] || 'auto';

    switch (mode) {
        case 'docker':
            if (checkCommand('docker') && checkCommand('docker-compose')) {
                runDocker();
            } else {
                log('Docker não encontrado. Instale Docker e Docker Compose.', 'red');
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
                if (process.env.NODE_ENV !== 'production') {
                    log('Docker detectado, usando Docker...', 'green');
                }
                runDocker();
            } else {
                runLocal();
            }
            break;
    }
}

// Mostrar ajuda
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    log('PromoPing - Execução Rápida', 'bright');
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