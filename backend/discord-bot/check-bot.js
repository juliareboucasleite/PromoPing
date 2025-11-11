const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function checkBotStatus() {
    console.log('🔍 Verificando status do bot Discord...');
    console.log('=====================================');
    
    // Verificar configurações
    console.log('📋 Configurações:');
    console.log(`Token: ${process.env.DISCORD_BOT_TOKEN ? ' Configurado' : ' Não configurado'}`);
    console.log(`Client ID: ${process.env.DISCORD_CLIENT_ID || ' Não configurado'}`);
    console.log(`Guild ID: ${process.env.DISCORD_GUILD_ID || ' Não configurado'}`);
    
    // Verificar banco de dados
    console.log('\n Banco de dados:');
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'pap',
            port: parseInt(process.env.DB_PORT) || 3306
        });
        
        // Verificar usuários com Discord
        const [users] = await connection.execute(`
            SELECT COUNT(*) as total 
            FROM utilizadores 
            WHERE discord_id IS NOT NULL AND discord_id != ''
        `);
        console.log(`Usuários com Discord: ${users[0].total}`);
        
        // Verificar produtos
        const [products] = await connection.execute(`
            SELECT COUNT(*) as total 
            FROM produtos 
            WHERE DeletedAt IS NULL
        `);
        console.log(`Produtos monitorados: ${products[0].total}`);
        
        // Verificar histórico
        const [history] = await connection.execute(`
            SELECT COUNT(*) as total 
            FROM historicoprecos 
            WHERE DataRegisto > DATE_SUB(NOW(), INTERVAL 1 DAY)
        `);
        console.log(`Mudanças nas últimas 24h: ${history[0].total}`);
        
        await connection.end();
        console.log(' Conexão com banco OK');
        
    } catch (error) {
        console.error(' Erro no banco:', error.message);
    }
    
    console.log('\n📱 Para testar o bot no Discord:');
    console.log('1. Vá para o servidor onde o bot foi convidado');
    console.log('2. Digite: !ping');
    console.log('3. Digite: !status');
    console.log('4. Digite: !iniciar (para começar monitoramento)');
    
    console.log('\nO bot deve aparecer como online no Discord!');
}

checkBotStatus().catch(console.error);
