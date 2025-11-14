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
 * Ajusta caminhos relativos em arquivos JavaScript que referenciam a API
 */
function fixApiPaths(filePath) {
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
 * Processa arquivos JavaScript do frontend
 */
function processJsFiles() {
    log('Processando arquivos JavaScript...', 'blue');
    
    const frontendDir = path.join(projectRoot, 'frontend');
    const jsFiles = listFilesRecursive(frontendDir, '.js');

    let processed = 0;
    for (const file of jsFiles) {
        if (fixApiPaths(file)) {
            processed++;
            log(`  ✓ ${path.relative(projectRoot, file)}`, 'green');
        }
    }

    log(`\n${processed} arquivo(s) JavaScript processado(s)`, 'green');
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

