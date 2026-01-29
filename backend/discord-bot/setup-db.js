const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function setupDatabase() {
    console.log('Configurando banco de dados para Discord Bot...');
    
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'papv5',
        port: parseInt(process.env.DB_PORT) || 3306
    };

    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('Conectado ao banco de dados');

        // Criar tabela historico_precos se não existir
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS historicoprecos (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                ProdutoId INT NOT NULL,
                Preco DECIMAL(10, 2) NOT NULL,
                PrecoAnterior DECIMAL(10, 2) DEFAULT NULL,
                Data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                Loja VARCHAR(255),
                Status ENUM('Ativo', 'Inativo', 'Pausado') DEFAULT 'Ativo',
                Observacoes TEXT,
                INDEX idx_produto_data (ProdutoId, Data),
                INDEX idx_data (Data),
                INDEX idx_loja (Loja),
                FOREIGN KEY (ProdutoId) REFERENCES produtos(Id) ON DELETE CASCADE
            )
        `);
        console.log('Tabela historicoprecos criada/verificada');

        // Verificar se a coluna discord_id existe
        const [columns] = await connection.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'utilizadores' AND COLUMN_NAME = 'discord_id'
        `, [dbConfig.database]);

        if (columns.length === 0) {
            await connection.execute(`
                ALTER TABLE utilizadores 
                ADD COLUMN discord_id VARCHAR(50) UNIQUE NULL
            `);
            console.log('Coluna discord_id adicionada à tabela utilizadores');
        } else {
            console.log('Coluna discord_id já existe na tabela utilizadores');
        }

        // Inserir dados de exemplo se não existirem
        const [existingData] = await connection.execute('SELECT COUNT(*) as count FROM historicoprecos');
        if (existingData[0].count === 0) {
            await connection.execute(`
                INSERT INTO historicoprecos (ProdutoId, Preco, PrecoAnterior, Loja, Status, Observacoes) VALUES
                (1, 299.99, 319.99, 'Amazon', 'Ativo', 'Preço atualizado via scraper'),
                (1, 319.99, 299.99, 'Amazon', 'Ativo', 'Preço aumentou'),
                (2, 199.99, 219.99, 'Fnac', 'Ativo', 'Desconto aplicado')
            `);
            console.log('Dados de exemplo inseridos');
        }

        // Atualizar um usuário com discord_id para teste
        await connection.execute(`
            UPDATE utilizadores 
            SET discord_id = '123456789012345678' 
            WHERE Id = 1 AND discord_id IS NULL
        `);
        console.log('Usuário de teste configurado com discord_id');

        // Criar tabela para canais Twitch monitorados
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS twitch_channels (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                ChannelName VARCHAR(100) NOT NULL UNIQUE,
                TwitchUserId VARCHAR(50),
                IsLive BOOLEAN DEFAULT FALSE,
                LastLiveCheck TIMESTAMP NULL,
                CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_channel_name (ChannelName),
                INDEX idx_is_live (IsLive)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('Tabela twitch_channels criada/verificada');

        // Adicionar canal leeksxy por padrão (se não existir)
        const [existingChannel] = await connection.execute(
            'SELECT Id FROM twitch_channels WHERE ChannelName = ?',
            ['leeksxy']
        );

        if (existingChannel.length === 0) {
            await connection.execute(
                'INSERT INTO twitch_channels (ChannelName) VALUES (?)',
                ['leeksxy']
            );
            console.log('Canal Twitch leeksxy adicionado ao monitoramento');
        } else {
            console.log('Canal Twitch leeksxy já está sendo monitorado');
        }

        // Criar tabela para configurações de webhooks
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS webhook_configs (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                Type ENUM('github', 'twitch', 'other') NOT NULL DEFAULT 'other',
                WebhookUrl VARCHAR(500),
                Secret VARCHAR(255),
                IsActive BOOLEAN DEFAULT TRUE,
                CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_type (Type),
                INDEX idx_is_active (IsActive)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('Tabela webhook_configs criada/verificada');

        // Criar tabela para sistema de counting
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS counting_config (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                GuildId VARCHAR(50) NOT NULL UNIQUE,
                ChannelId VARCHAR(50) NOT NULL,
                CurrentNumber INT DEFAULT 0,
                HighScore INT DEFAULT 0,
                LastUserId VARCHAR(50),
                LastMessageId VARCHAR(50),
                CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_guild (GuildId),
                INDEX idx_channel (ChannelId)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('Tabela counting_config criada/verificada');

        await connection.end();
        console.log('Configuração do banco concluída!');
        return true;

    } catch (error) {
        console.error('Erro ao configurar banco:', error);
        return false;
    }
}

if (require.main === module) {
    setupDatabase();
}

module.exports = setupDatabase;
