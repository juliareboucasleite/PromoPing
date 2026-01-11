import { pool } from '../database/db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function checkPlanos() {
    try {
        const [planos] = await pool.query('SELECT Id, Nome, Preco FROM planos ORDER BY Id');
        console.log('\nPlanos na base de dados:');
        planos.forEach(p => console.log(`  ID ${p.Id}: ${p.Nome} (€${p.Preco})`));
        
        // Verificar qual plano o usuário tem
        const [userConfig] = await pool.query(
            `SELECT c.PlanoAtualId, p.Nome as PlanoNome 
             FROM configutilizador c 
             JOIN planos p ON c.PlanoAtualId = p.Id 
             WHERE c.ReferenciaID = ?`,
            ['REF-557643948']
        );
        
        if (userConfig.length > 0) {
            console.log(`\nPlano atual do usuário REF-557643948: ${userConfig[0].PlanoNome} (ID: ${userConfig[0].PlanoAtualId})`);
        }
        
        await pool.end();
    } catch (error) {
        console.error('Erro:', error);
        process.exit(1);
    }
}

checkPlanos();
