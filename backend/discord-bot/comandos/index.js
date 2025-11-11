const fs = require('fs');
const path = require('path');

const comandos = new Map();

console.log('📁 Carregando comandos do Discord Bot...');

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
                console.warn(` Comando inválido em ${file} (faltando 'name' ou 'execute')`);
                continue;
            }

            if (comandos.has(comando.name)) {
                console.warn(` Nome duplicado ignorado: ${comando.name}`);
                continue;
            }

            comandos.set(comando.name, comando);
            count++;

            // Registra aliases, se houver
            if (Array.isArray(comando.aliases)) {
                for (const alias of comando.aliases) {
                    if (comandos.has(alias)) {
                        console.warn(` Alias duplicado ignorado: ${alias}`);
                        continue;
                    }
                    comandos.set(alias, comando);
                }
            }

            console.log(` Carregado: !${comando.name}${comando.aliases ? ` (${comando.aliases.join(', ')})` : ''}`);

        } catch (error) {
            console.error(` Erro ao carregar comando ${file}:`, error.message);
        }
    }

    console.log(`${count} comandos carregados com sucesso!`);
    console.log('Comandos disponíveis:', 
        Array.from(new Set(comandos.keys())).join(', ')
    );

} catch (error) {
    console.error(' Erro ao carregar comandos:', error);
}

module.exports = comandos;
