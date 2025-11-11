const fs = require('fs');
const path = require('path');

const comandos = new Map();

// Carregando comandos silenciosamente

try {
    // Lê todos os arquivos .js na pasta comandos (exceto este index)
    const comandoFiles = fs.readdirSync(__dirname)
        .filter(file => file.endsWith('.js') && file !== 'index.js')
        .filter(file => fs.statSync(path.join(__dirname, file)).isFile());

    let count = 0;

    for (const file of comandoFiles) {
        try {
            const comando = require(path.join(__dirname, file));

            if (!comando.name || typeof comando.execute !== 'function') {
                // Comando inválido - log silencioso
                continue;
            }

            if (comandos.has(comando.name)) {
                // Nome duplicado - log silencioso
                continue;
            }

            comandos.set(comando.name, comando);
            count++;

            // Registra aliases, se houver
            if (Array.isArray(comando.aliases)) {
                for (const alias of comando.aliases) {
                    if (comandos.has(alias)) {
                        // Alias duplicado - log silencioso
                        continue;
                    }
                    comandos.set(alias, comando);
                }
            }

            // Log silencioso - só mostra em modo debug

        } catch (error) {
            console.error(` Erro ao carregar comando ${file}:`, error.message);
        }
    }

    // Log silencioso - comandos carregados

} catch (error) {
    console.error(' Erro ao carregar comandos:', error);
}

module.exports = comandos;
