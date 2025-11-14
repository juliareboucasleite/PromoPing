#!/usr/bin/env node
/**
 * Script para preparar o frontend para produção
 * Ajusta os base href e caminhos para funcionar na raiz do domínio
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Cores para output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Remove ou ajusta base href nos arquivos HTML
 */
function fixBaseHref(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        // Remover base href antigo
        const baseHrefRegex = /<base\s+href=["'][^"']*["']\s*>/gi;
        if (baseHrefRegex.test(content)) {
            content = content.replace(baseHrefRegex, '');
            modified = true;
        }

        // Adicionar base href correto para produção (raiz)
        if (!content.includes('<base href')) {
            // Inserir após a tag <head>
            content = content.replace(
                /(<head[^>]*>)/i,
                '$1\n  <base href="/">'
            );
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            return true;
        }
        return false;
    } catch (error) {
        log(`Erro ao processar ${filePath}: ${error.message}`, 'red');
        return false;
    }
}

/**
 * Ajusta caminhos relativos em arquivos HTML e JavaScript
 */
function fixPaths(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        // Substituir caminhos da API que podem estar incorretos
        // Ex: /PromoPing/frontend/api/ -> /api/
        const apiPathRegex = /\/PromoPing\/frontend\/api\//g;
        if (apiPathRegex.test(content)) {
            content = content.replace(apiPathRegex, '/api/');
            modified = true;
        }

        // Garantir que caminhos da API começam com /api/
        const relativeApiRegex = /(['"`])(\.\.\/)+api\//g;
        if (relativeApiRegex.test(content)) {
            content = content.replace(relativeApiRegex, '$1/api/');
            modified = true;
        }

        // Corrigir caminhos pages/inc/ para inc/ (já que base href é /)
        const pagesIncRegex = /(['"`])pages\/inc\//g;
        if (pagesIncRegex.test(content)) {
            content = content.replace(pagesIncRegex, '$1inc/');
            modified = true;
        }

        // Corrigir caminhos pages/ para / (se necessário)
        const pagesPathRegex = /(['"`])pages\/(?!inc)/g;
        if (pagesPathRegex.test(content)) {
            content = content.replace(pagesPathRegex, '$1');
            modified = true;
        }

        // Corrigir URLs hardcoded da API (http://127.0.0.1:3000/api/ → /api/)
        const apiUrlRegex = /http:\/\/127\.0\.0\.1:3000\/api\//g;
        if (apiUrlRegex.test(content)) {
            content = content.replace(apiUrlRegex, '/api/');
            modified = true;
        }

        // Corrigir URLs localhost:3000/api/ → /api/
        const localhostApiRegex = /http:\/\/localhost:3000\/api\//g;
        if (localhostApiRegex.test(content)) {
            content = content.replace(localhostApiRegex, '/api/');
            modified = true;
        }

        // Corrigir caminhos /PromoPing/frontend/pages/dashboard/ → /dashboard
        const dashboardPathRegex = /\/PromoPing\/frontend\/pages\/dashboard\//g;
        if (dashboardPathRegex.test(content)) {
            content = content.replace(dashboardPathRegex, '/dashboard/');
            modified = true;
        }

        // Corrigir caminhos /PromoPing/frontend/pages/ → /
        const frontendPagesRegex = /\/PromoPing\/frontend\/pages\//g;
        if (frontendPagesRegex.test(content)) {
            content = content.replace(frontendPagesRegex, '/');
            modified = true;
        }

        // Corrigir caminhos /PromoPing/frontend/ → /
        const frontendRegex = /\/PromoPing\/frontend\//g;
        if (frontendRegex.test(content)) {
            content = content.replace(frontendRegex, '/');
            modified = true;
        }

        // Corrigir /inc/Login.html → /login
        const loginPathRegex = /\/inc\/Login\.html/g;
        if (loginPathRegex.test(content)) {
            content = content.replace(loginPathRegex, '/login');
            modified = true;
        }

        // Corrigir window.location.href com caminhos antigos
        const windowLocationRegex = /window\.location\.href\s*=\s*["']\/PromoPing\/frontend\/pages\/dashboard\/Painel\.html["']/g;
        if (windowLocationRegex.test(content)) {
            content = content.replace(windowLocationRegex, "window.location.href = '/dashboard'");
            modified = true;
        }

        // Corrigir window.location.href com /inc/Login.html
        const windowLocationLoginRegex = /window\.location\.href\s*=\s*["']\/inc\/Login\.html["']/g;
        if (windowLocationLoginRegex.test(content)) {
            content = content.replace(windowLocationLoginRegex, "window.location.href = '/login'");
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            return true;
        }
        return false;
    } catch (error) {
        log(`Erro ao processar ${filePath}: ${error.message}`, 'red');
        return false;
    }
}

/**
 * Lista arquivos recursivamente
 */
function listFilesRecursive(dir, extension, files = []) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            // Ignorar node_modules e outras pastas desnecessárias
            if (!item.startsWith('.') && item !== 'node_modules') {
                listFilesRecursive(fullPath, extension, files);
            }
        } else if (stat.isFile() && item.endsWith(extension)) {
            files.push(fullPath);
        }
    }
    
    return files;
}

/**
 * Processa todos os arquivos HTML do frontend
 */
function processHtmlFiles() {
    log('Processando arquivos HTML...', 'blue');
    
    const frontendDir = path.join(projectRoot, 'frontend');
    const htmlFiles = listFilesRecursive(frontendDir, '.html');

    let processed = 0;
    for (const file of htmlFiles) {
        if (fixBaseHref(file)) {
            processed++;
            log(`  ✓ ${path.relative(projectRoot, file)}`, 'green');
        }
    }

    log(`\n${processed} arquivo(s) HTML processado(s)`, 'green');
    return processed;
}

/**
 * Processa arquivos JavaScript e HTML para corrigir caminhos
 */
function processJsFiles() {
    log('Processando arquivos JavaScript e corrigindo caminhos em HTML...', 'blue');
    
    const frontendDir = path.join(projectRoot, 'frontend');
    const jsFiles = listFilesRecursive(frontendDir, '.js');
    const htmlFiles = listFilesRecursive(frontendDir, '.html');

    let processed = 0;
    
    // Processar arquivos JS
    for (const file of jsFiles) {
        if (fixPaths(file)) {
            processed++;
            log(`  ✓ ${path.relative(projectRoot, file)}`, 'green');
        }
    }
    
    // Processar arquivos HTML novamente para corrigir caminhos
    for (const file of htmlFiles) {
        if (fixPaths(file)) {
            processed++;
            log(`  ✓ ${path.relative(projectRoot, file)}`, 'green');
        }
    }

    log(`\n${processed} arquivo(s) processado(s)`, 'green');
    return processed;
}

/**
 * Cria um arquivo de configuração para o frontend em produção
 */
function createProductionConfig() {
    const configPath = path.join(projectRoot, 'frontend', '.production-config.json');
    const config = {
        production: true,
        apiBaseUrl: '/api',
        basePath: '/',
        timestamp: new Date().toISOString()
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    log(`\nConfiguração de produção criada: ${path.relative(projectRoot, configPath)}`, 'green');
}

/**
 * Função principal
 */
function main() {
    log('================================', 'blue');
    log('Preparação do Frontend para Produção', 'blue');
    log('================================\n', 'blue');

    try {
        processHtmlFiles();
        processJsFiles();
        createProductionConfig();

        log('\n✓ Frontend preparado para produção!', 'green');
        log('\nPróximos passos:', 'yellow');
        log('1. Copiar a pasta frontend para /var/www/promoping/', 'yellow');
        log('2. Configurar NGINX com o arquivo config-files/nginx-promoping.pt.conf', 'yellow');
        log('3. Reiniciar o NGINX: sudo systemctl restart nginx', 'yellow');
        log('4. Verificar os logs: sudo tail -f /var/log/nginx/promoping-error.log', 'yellow');
    } catch (error) {
        log(`\n✗ Erro: ${error.message}`, 'red');
        process.exit(1);
    }
}

main();

