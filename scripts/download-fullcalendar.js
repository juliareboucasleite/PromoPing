/**
 * Script para baixar FullCalendar localmente
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseDir = path.join(__dirname, '..', 'admin.promoping', 'lib', 'fullcalendar');

// Criar diretório se não existir
if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
}

function downloadFile(url, filepath) {
    return new Promise((resolve, reject) => {
        console.log(`Baixando ${url}...`);
        const file = fs.createWriteStream(filepath);
        
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                // Seguir redirect
                return downloadFile(response.headers.location, filepath).then(resolve).catch(reject);
            }
            
            if (response.statusCode !== 200) {
                file.close();
                fs.unlinkSync(filepath);
                reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
                return;
            }
            
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                console.log(`✓ ${path.basename(filepath)} baixado com sucesso`);
                resolve();
            });
        }).on('error', (err) => {
            file.close();
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
            }
            reject(err);
        });
    });
}

async function main() {
    const files = [
        {
            url: 'https://cdn.jsdelivr.net/npm/fullcalendar@5.11.5/main.min.css',
            path: path.join(baseDir, 'main.min.css')
        },
        {
            url: 'https://cdn.jsdelivr.net/npm/fullcalendar@5.11.5/main.min.js',
            path: path.join(baseDir, 'main.min.js')
        },
        {
            url: 'https://cdn.jsdelivr.net/npm/fullcalendar@5.11.5/locales/pt-br.js',
            path: path.join(baseDir, 'locales-pt-br.js')
        }
    ];

    try {
        for (const file of files) {
            await downloadFile(file.url, file.path);
        }
        console.log('\n✅ Todos os arquivos do FullCalendar foram baixados com sucesso!');
    } catch (error) {
        console.error('\n❌ Erro ao baixar arquivos:', error.message);
        process.exit(1);
    }
}

main();

