/**
 * Script para criar usuário administrador
 * Uso: node scripts/create-admin-user.js
 */

import bcrypt from 'bcrypt';
import {
    pool
} from '../backend/database/db.js';
import dotenv from 'dotenv';
import path from 'path';
import {
    fileURLToPath
} from 'url';

const __filename = fileURLToPath(
    import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar .env
dotenv.config({
    path: path.resolve(__dirname, '../.env')
});

async function createAdminUser() {
    try {
        // Dados do admin (você pode alterar aqui)
        const email = process.env.ADMIN_EMAIL || 'admin@promoping.com';
        const password = process.env.ADMIN_PASSWORD || 'admin123';
        const nome = process.env.ADMIN_NOME || 'Administrador';

        console.log('\n=== Criando Usuário Administrador ===\n');
        console.log(`Email: ${email}`);
        console.log(`Nome: ${nome}`);
        console.log(`Senha: ${password}\n`);

        // Verificar se o usuário já existe
        const [existingUsers] = await pool.query(
            'SELECT * FROM Utilizadores WHERE Email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            console.log('⚠️  Usuário já existe! Atualizando...\n');
            const userId = existingUsers[0].Id;

            // Hash da senha
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Atualizar usuário existente
            await pool.query(
                `UPDATE Utilizadores 
                 SET Nome = ?, 
                     SenhaHash = ?, 
                     PerfilId = 1, 
                     EmailVerificado = 1, 
                     Ativo = 1 
                 WHERE Id = ?`,
                [nome, hashedPassword, userId]
            );

            console.log('✅ Usuário atualizado com sucesso!');
            console.log(`\nID: ${userId}`);
            console.log(`Email: ${email}`);
            console.log(`PerfilId: 1 (Admin)`);
            console.log(`EmailVerificado: Sim`);
            console.log(`Ativo: Sim\n`);
        } else {
            // Hash da senha
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Inserir novo usuário
            const [result] = await pool.query(
                `INSERT INTO Utilizadores 
                 (Nome, Email, SenhaHash, PerfilId, EmailVerificado, Ativo, Data_Registo) 
                 VALUES (?, ?, ?, 1, 1, 1, NOW())`,
                [nome, email, hashedPassword]
            );

            console.log('✅ Usuário criado com sucesso!');
            console.log(`\nID: ${result.insertId}`);
            console.log(`Email: ${email}`);
            console.log(`Senha: ${password}`);
            console.log(`PerfilId: 1 (Admin)`);
            console.log(`EmailVerificado: Sim`);
            console.log(`Ativo: Sim\n`);
        }

        console.log('=== Credenciais de Login ===');
        console.log(`Email: ${email}`);
        console.log(`Senha: ${password}\n`);
        console.log('Agora você pode fazer login no painel administrativo!\n');

    } catch (error) {
        console.error('\n❌ Erro ao criar usuário:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Executar
createAdminUser();