/**
 * Sistema Centralizado de Gerenciamento de Tabelas
 * 
 * Este módulo garante que todas as tabelas necessárias existam na base de dados,
 * recriando-as automaticamente quando necessário usando apenas definições existentes no código.
 * 
 * Regras:
 * - NÃO cria tabelas novas por inferência
 * - Usa apenas definições existentes no código
 * - Garante que ReferenciaID VARCHAR(13) seja usado para identificação de utilizador
 * - Mantém IDs externos (Discord, Twitch, etc.) quando apropriado
 */

import { pool } from './db.js';

/**
 * Obter query original para uso interno (evitar recursão)
 * Acessa pool._originalQuery de forma lazy para evitar referência circular
 * 
 * ===== ATENÇÃO: NÃO MEXA NESSA FUNÇÃO =====
 * Essa função aqui evita loops infinitos quando recria tabelas
 * Se tu mudar isso, pode criar um loop infinito e derrubar o servidor
 * Deixa essa merda quieta, ela faz o trabalho dela perfeitamente
 */
function getOriginalQuery() {
    // pool._originalQuery é definido em db.js antes de modificar pool.query
    return pool._originalQuery || pool.query.bind(pool);
}

/**
 * Controle de tabelas criadas neste boot
 * Previne múltiplas recriações da mesma tabela
 */
const tablesCreatedThisBoot = new Set();

/**
 * Controle de queries em processo de recuperação
 * Previne loops infinitos de reexecução
 */
const queriesInRecovery = new Set();

/**
 * Mapa de definições de tabelas existentes no código
 * Cada entrada contém:
 * - tableName: Nome da tabela (case-insensitive)
 * - definition: SQL CREATE TABLE
 * - usesReferenciaID: Se a tabela usa ReferenciaID para identificação de utilizador
 * - source: Origem da definição (para logs)
 */
const TABLE_DEFINITIONS = {
    // Tabelas principais que usam ReferenciaID
    'utilizadores': {
        definition: `CREATE TABLE IF NOT EXISTS utilizadores (
            ReferenciaID VARCHAR(13) NOT NULL PRIMARY KEY,
            Nome VARCHAR(100) NOT NULL,
            Email VARCHAR(150) NOT NULL UNIQUE,
            SenhaHash VARCHAR(255) NOT NULL,
            Telefone VARCHAR(20) DEFAULT NULL,
            CodigoTelefone VARCHAR(10) DEFAULT NULL,
            Ativo TINYINT(1) DEFAULT 1,
            DataDesativacao DATETIME DEFAULT NULL,
            DataRegisto DATETIME DEFAULT CURRENT_TIMESTAMP,
            UltimoLogin DATETIME DEFAULT NULL,
            PerfilId INT(10) UNSIGNED NOT NULL DEFAULT 2,
            EmailVerificado TINYINT(1) DEFAULT 0,
            CodigoEmail VARCHAR(6) DEFAULT NULL,
            DinheiroPoupado DECIMAL(10,2) DEFAULT 0.00,
            DataNascimento DATE DEFAULT NULL,
            discord_id VARCHAR(50) DEFAULT NULL,
            google_id VARCHAR(50) DEFAULT NULL,
            FotoPerfil VARCHAR(500) DEFAULT NULL COMMENT 'URL da foto de perfil do usuário (GitHub, Google, etc.)',
            CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_email (Email),
            INDEX idx_perfil (PerfilId),
            UNIQUE KEY idx_discord_id (discord_id),
            INDEX idx_google_id (google_id),
            FOREIGN KEY (PerfilId) REFERENCES perfis(Id) ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: true,
        source: 'estrutura real da base de dados verificada'
    },

    'produtos': {
        definition: `CREATE TABLE IF NOT EXISTS produtos (
            Id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            ReferenciaID VARCHAR(13) NOT NULL,
            Nome VARCHAR(150) NOT NULL,
            Link VARCHAR(500) NOT NULL,
            PrecoAtual DECIMAL(10,2) DEFAULT NULL,
            PrecoAlvo DECIMAL(10,2) DEFAULT NULL,
            DataLimite DATE DEFAULT NULL,
            Shipping VARCHAR(100) DEFAULT '',
            LojaId INT(10) UNSIGNED DEFAULT NULL,
            CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UpdatedAt TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
            DeletedAt TIMESTAMP NULL DEFAULT NULL,
            INDEX idx_ReferenciaID (ReferenciaID),
            INDEX idx_DeletedAt (DeletedAt),
            FOREIGN KEY (ReferenciaID) REFERENCES utilizadores(ReferenciaID) ON DELETE CASCADE,
            FOREIGN KEY (LojaId) REFERENCES lojas(Id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: true,
        source: 'sql/PAPv5.sql - estrutura real da base de dados'
    },

    'notificacoes': {
        definition: `CREATE TABLE IF NOT EXISTS notificacoes (
            Id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            ReferenciaID VARCHAR(13) NOT NULL,
            ProdutoId INT(10) UNSIGNED NOT NULL,
            Tipo VARCHAR(50) NOT NULL,
            Mensagem TEXT NOT NULL,
            Enviada TINYINT(1) NOT NULL DEFAULT 1,
            DataEnvio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ValorPoupado DECIMAL(10,2) DEFAULT 0.00,
            Data DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ReferenciaID (ReferenciaID),
            INDEX idx_ProdutoId (ProdutoId),
            FOREIGN KEY (ReferenciaID) REFERENCES utilizadores(ReferenciaID) ON DELETE CASCADE,
            FOREIGN KEY (ProdutoId) REFERENCES produtos(Id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: true,
        source: 'sql/pap (1).sql - atualizado para ReferenciaID'
    },

    'preferenciasnotificacao': {
        definition: `CREATE TABLE IF NOT EXISTS preferenciasnotificacao (
            Id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            ReferenciaID VARCHAR(13) NOT NULL,
            Tipo VARCHAR(50) NOT NULL,
            Ativo TINYINT(1) DEFAULT 1,
            UNIQUE KEY unique_user_tipo (ReferenciaID, Tipo),
            INDEX idx_ReferenciaID (ReferenciaID),
            FOREIGN KEY (ReferenciaID) REFERENCES utilizadores(ReferenciaID) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: true,
        source: 'sql/pap (1).sql - atualizado para ReferenciaID'
    },

    'contasconectadas': {
        definition: `CREATE TABLE IF NOT EXISTS contasconectadas (
            Id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            ReferenciaID VARCHAR(13) NOT NULL,
            Tipo VARCHAR(50) NOT NULL,
            Identificador VARCHAR(100) NOT NULL,
            Conectado TINYINT(1) DEFAULT 1,
            DataConexao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_user_tipo (ReferenciaID, Tipo),
            INDEX idx_ReferenciaID (ReferenciaID),
            FOREIGN KEY (ReferenciaID) REFERENCES utilizadores(ReferenciaID) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: true,
        source: 'sql/pap (1).sql - atualizado para ReferenciaID'
    },

    'configutilizador': {
        definition: `CREATE TABLE IF NOT EXISTS configutilizador (
            Id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            ReferenciaID VARCHAR(13) NOT NULL UNIQUE,
            PlanoAtualId INT(11) NOT NULL DEFAULT 1,
            PlanoAtivoId INT(11) NOT NULL DEFAULT 1,
            DataInicio DATETIME DEFAULT CURRENT_TIMESTAMP,
            DataCancelamento DATETIME DEFAULT NULL,
            DataExpiracao DATETIME DEFAULT NULL,
            StatusAssinatura ENUM('Ativa','Cancelada','Expirada','Gratuita','PeriodoGraca') DEFAULT 'Gratuita',
            LimiteProdutos INT(11) DEFAULT 5,
            CanalPreferido VARCHAR(50) DEFAULT 'discord',
            NotificacoesEnviadas INT(11) DEFAULT 0,
            HistoricoAtivo TINYINT(1) DEFAULT 1,
            UltimoLogin DATETIME DEFAULT NULL,
            HistoricoDias INT(11) DEFAULT 0,
            INDEX idx_ReferenciaID (ReferenciaID),
            INDEX idx_PlanoAtualId (PlanoAtualId),
            INDEX idx_PlanoAtivoId (PlanoAtivoId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: true,
        source: 'sql/pap (1).sql - atualizado para ReferenciaID (FK adicionadas separadamente)'
    },


    'google_oauth_tokens': {
        definition: `CREATE TABLE IF NOT EXISTS google_oauth_tokens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ReferenciaID VARCHAR(13) NOT NULL,
            access_token TEXT NOT NULL,
            refresh_token TEXT,
            token_type VARCHAR(50) DEFAULT 'Bearer',
            expires_at TIMESTAMP NULL,
            scope TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_ReferenciaID (ReferenciaID),
            INDEX idx_expires_at (expires_at),
            FOREIGN KEY (ReferenciaID) REFERENCES utilizadores(ReferenciaID) ON DELETE CASCADE,
            UNIQUE KEY unique_user_token (ReferenciaID)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: true,
        source: 'scripts/create-google-oauth-tokens-table.js - atualizado para ReferenciaID'
    },


    // Tabelas que NÃO usam ReferenciaID (IDs externos ou outras entidades)
    'historicoprecos': {
        definition: `CREATE TABLE IF NOT EXISTS historicoprecos (
            Id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            ProdutoId INT(10) UNSIGNED NOT NULL,
            Preco DECIMAL(10,2) NOT NULL,
            DataRegisto DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_historico_produto (ProdutoId),
            FOREIGN KEY (ProdutoId) REFERENCES produtos(Id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: false,
        source: 'sql/pap (1).sql - estrutura real da base de dados'
    },

    'reviews': {
        definition: `CREATE TABLE IF NOT EXISTS reviews (
            Id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
            ReferenciaID VARCHAR(13) NOT NULL,
            Tipo ENUM('site','bot','suporte') NOT NULL,
            Texto TEXT NOT NULL,
            Rating INT DEFAULT NULL,
            IsAnonimo TINYINT(1) DEFAULT 0,
            CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ReferenciaID (ReferenciaID),
            INDEX idx_Tipo (Tipo),
            INDEX idx_Rating (Rating),
            INDEX idx_CreatedAt (CreatedAt),
            FOREIGN KEY (ReferenciaID) REFERENCES utilizadores(ReferenciaID) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: true,
        source: 'sql/pap (1).sql - estrutura real da base de dados'
    },

    'planos': {
        definition: `CREATE TABLE IF NOT EXISTS planos (
            Id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
            Nome VARCHAR(50) NOT NULL,
            Preco DECIMAL(6,2) NOT NULL,
            LimiteProdutos INT(11) DEFAULT NULL,
            HistoricoDias INT(11) DEFAULT NULL,
            IntervaloVerificacao VARCHAR(50) DEFAULT NULL,
            PermiteSMS TINYINT(1) DEFAULT NULL,
            Relatorios VARCHAR(50) DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: false,
        source: 'sql/pap (1).sql'
    },

    'perfis': {
        definition: `CREATE TABLE IF NOT EXISTS perfis (
            Id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            Nome VARCHAR(50) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: false,
        source: 'sql/pap (1).sql'
    },

    'lojas': {
        definition: `CREATE TABLE IF NOT EXISTS lojas (
            Id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            Nome VARCHAR(100) NOT NULL,
            Dominio VARCHAR(255) NOT NULL,
            CssSelectorPreco VARCHAR(500) NOT NULL,
            CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: false,
        source: 'sql/PAPv5.sql - estrutura real da base de dados'
    },

    'metricas_sistema': {
        definition: `CREATE TABLE IF NOT EXISTS metricas_sistema (
            Id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            UptimeGeral DECIMAL(5,2) DEFAULT 99.90,
            TempoRespostaMedia INT(11) DEFAULT 45,
            UtilizadoresAtivos INT(11) DEFAULT 0,
            ProdutosMonitorizados INT(11) DEFAULT 0,
            NotificacoesEnviadas INT(11) DEFAULT 0,
            AtualizadoEm DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: false,
        source: 'sql/pap (1).sql - estrutura real da base de dados'
    },

    'status_componentes': {
        definition: `CREATE TABLE IF NOT EXISTS status_componentes (
            Id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            Nome VARCHAR(100) NOT NULL,
            Estado ENUM('Operacional','Manutenção','Degradado','Inativo') DEFAULT 'Operacional',
            Uptime DECIMAL(5,2) DEFAULT 100.00,
            LatenciaMedia INT(11) DEFAULT NULL,
            UltimaVerificacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            Notas TEXT DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: false,
        source: 'sql/pap (1).sql - estrutura real da base de dados'
    },

    'incidentes': {
        definition: `CREATE TABLE IF NOT EXISTS incidentes (
            Id INT AUTO_INCREMENT PRIMARY KEY,
            Titulo VARCHAR(200) NOT NULL,
            Descricao TEXT,
            DataInicio TIMESTAMP NOT NULL,
            DataFim TIMESTAMP NULL,
            Duracao VARCHAR(50),
            Impacto TEXT,
            Status ENUM('investigating', 'identified', 'monitoring', 'resolved') DEFAULT 'investigating',
            ComponenteAfetado VARCHAR(100),
            DataCriacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            DataAtualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_data_inicio (DataInicio),
            INDEX idx_status (Status),
            INDEX idx_componente (ComponenteAfetado)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: false,
        source: 'backend/database/migrations/create_status_tables.sql'
    },

    'atualizacoes': {
        definition: `CREATE TABLE IF NOT EXISTS atualizacoes (
            Id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
            Titulo VARCHAR(200) NOT NULL,
            Descricao TEXT NOT NULL,
            Tipo ENUM('Melhoria','Correção','Nova Funcionalidade','Manutenção') DEFAULT 'Melhoria',
            DataPublicacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            Status ENUM('Implementado','Em Desenvolvimento','Planeado') DEFAULT 'Implementado',
            DataCriacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            DataAtualizacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_data_publicacao (DataPublicacao),
            INDEX idx_tipo (Tipo),
            INDEX idx_status (Status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: false,
        source: 'sql/pap (1).sql - estrutura real da base de dados'
    },

    'atualizacoes_sistema': {
        definition: `CREATE TABLE IF NOT EXISTS atualizacoes_sistema (
            Id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
            Titulo VARCHAR(200) NOT NULL,
            Descricao TEXT DEFAULT NULL,
            Tipo ENUM('feature','fix','improvement','maintenance') DEFAULT 'feature',
            DataCriacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_tipo (Tipo),
            INDEX idx_data_criacao (DataCriacao)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
        usesReferenciaID: false,
        source: 'sql/pap (1).sql - estrutura real da base de dados'
    },

    'bugsprojetos': {
        definition: `CREATE TABLE IF NOT EXISTS bugsprojetos (
            Id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
            Titulo VARCHAR(200) NOT NULL,
            Descricao TEXT DEFAULT NULL,
            Tipo ENUM('bug','projeto','melhoria') DEFAULT 'bug',
            Prioridade ENUM('low','medium','high','critical') DEFAULT 'medium',
            Status ENUM('open','in-progress','resolved','closed') DEFAULT 'open',
            DataCriacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            DataAtualizacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_status (Status),
            INDEX idx_tipo (Tipo),
            INDEX idx_data_criacao (DataCriacao)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
        usesReferenciaID: false,
        source: 'sql/pap (1).sql - estrutura real da base de dados'
    },

    'recuperar_senha': {
        definition: `CREATE TABLE IF NOT EXISTS recuperar_senha (
            Id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            ReferenciaID VARCHAR(13) NOT NULL,
            Token VARCHAR(255) NOT NULL,
            ExpiraEm DATETIME NOT NULL,
            Usado TINYINT(1) DEFAULT 0,
            CriadoEm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ReferenciaID (ReferenciaID),
            FOREIGN KEY (ReferenciaID) REFERENCES utilizadores(ReferenciaID) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: true,
        source: 'sql/pap (1).sql - atualizado para ReferenciaID'
    },

    'password_reset_tokens': {
        definition: `CREATE TABLE IF NOT EXISTS password_reset_tokens (
            Id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
            ReferenciaID VARCHAR(13) NOT NULL,
            Token VARCHAR(255) NOT NULL UNIQUE,
            Email VARCHAR(255) NOT NULL,
            ExpiresAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            Used TINYINT(1) DEFAULT 0,
            CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_token (Token),
            INDEX idx_ReferenciaID (ReferenciaID),
            INDEX idx_email (Email),
            INDEX idx_expires_at (ExpiresAt),
            FOREIGN KEY (ReferenciaID) REFERENCES utilizadores(ReferenciaID) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: true,
        source: 'sql/pap (1).sql - atualizado para ReferenciaID'
    },

    'twitch_channels': {
        definition: `CREATE TABLE IF NOT EXISTS twitch_channels (
            Id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
            ChannelName VARCHAR(100) NOT NULL UNIQUE,
            TwitchUserId VARCHAR(50) DEFAULT NULL,
            IsLive TINYINT(1) DEFAULT 0,
            LastLiveCheck TIMESTAMP NULL DEFAULT NULL,
            CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_channel_name (ChannelName),
            INDEX idx_is_live (IsLive)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: false,
        source: 'sql/pap (1).sql - estrutura real da base de dados'
    },

    'counting_config': {
        definition: `CREATE TABLE IF NOT EXISTS counting_config (
            Id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
            GuildId VARCHAR(50) NOT NULL UNIQUE,
            ChannelId VARCHAR(50) NOT NULL,
            CurrentNumber INT(11) DEFAULT 0,
            HighScore INT(11) DEFAULT 0,
            LastUserId VARCHAR(50) DEFAULT NULL,
            LastMessageId VARCHAR(50) DEFAULT NULL,
            CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_guild (GuildId),
            INDEX idx_channel (ChannelId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: false,
        source: 'sql/pap (1).sql - estrutura real da base de dados'
    },

    'processed_releases': {
        definition: `CREATE TABLE IF NOT EXISTS processed_releases (
            Id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
            ReleaseId VARCHAR(255) NOT NULL UNIQUE,
            TagName VARCHAR(100) NOT NULL,
            Repository VARCHAR(200) NOT NULL,
            ProcessedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_release_id (ReleaseId),
            INDEX idx_repository (Repository),
            INDEX idx_processed_at (ProcessedAt)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: false,
        source: 'sql/pap (1).sql - estrutura real da base de dados'
    },

    'pages': {
        definition: `CREATE TABLE IF NOT EXISTS pages (
            id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
            url TEXT NOT NULL,
            \`read\` TINYINT(1) NOT NULL DEFAULT 0,
            createdAt DATETIME NOT NULL,
            updatedAt DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: false,
        source: 'sql/pap (1).sql - estrutura real da base de dados'
    },

    'webhook_configs': {
        definition: `CREATE TABLE IF NOT EXISTS webhook_configs (
            Id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
            Type ENUM('github','twitch','other') NOT NULL DEFAULT 'other',
            WebhookUrl VARCHAR(500) DEFAULT NULL,
            Secret VARCHAR(255) DEFAULT NULL,
            IsActive TINYINT(1) DEFAULT 1,
            CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_type (Type),
            INDEX idx_is_active (IsActive)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: false,
        source: 'sql/pap (1).sql - estrutura real da base de dados'
    },

    'stripe_subscriptions': {
        definition: `CREATE TABLE IF NOT EXISTS stripe_subscriptions (
            id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
            ReferenciaID VARCHAR(13) NOT NULL,
            customer_id VARCHAR(255) NOT NULL,
            subscription_id VARCHAR(255) NOT NULL,
            subscription_status VARCHAR(50) NOT NULL DEFAULT 'active',
            price_id VARCHAR(255) DEFAULT NULL,
            plan_name VARCHAR(100) DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            status ENUM('active','canceled','past_due','unpaid') DEFAULT 'active',
            grace_period_end TIMESTAMP NULL DEFAULT NULL,
            cancellation_reason VARCHAR(255) DEFAULT NULL,
            UNIQUE KEY unique_active_user (ReferenciaID, status),
            INDEX idx_ReferenciaID (ReferenciaID),
            INDEX idx_customer_id (customer_id),
            INDEX idx_subscription_id (subscription_id),
            INDEX idx_status (status),
            FOREIGN KEY (ReferenciaID) REFERENCES utilizadores(ReferenciaID) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: true,
        source: 'sql/pap (1).sql - atualizado para ReferenciaID'
    },

    'supportmessages': {
        definition: `CREATE TABLE IF NOT EXISTS supportmessages (
            id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
            ReferenciaID VARCHAR(13) NOT NULL,
            message TEXT NOT NULL,
            createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            senderType ENUM('user','support') DEFAULT 'user',
            replyTo INT(11) DEFAULT NULL,
            threadId INT(11) DEFAULT NULL,
            INDEX idx_ReferenciaID (ReferenciaID),
            INDEX idx_replyTo (replyTo),
            INDEX idx_threadId (threadId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
        usesReferenciaID: true,
        source: 'sql/pap (1).sql - atualizado para ReferenciaID (FK adicionadas separadamente)'
    },

    'newsletter_subscribers': {
        definition: `CREATE TABLE IF NOT EXISTS newsletter_subscribers (
            id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            newsletter BOOLEAN DEFAULT TRUE,
            promotions BOOLEAN DEFAULT TRUE,
            articles BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: false,
        source: 'backend/routes/newsletter.js - estrutura da tabela'
    },

    'sugestoes': {
        definition: `CREATE TABLE IF NOT EXISTS sugestoes (
            Id INT AUTO_INCREMENT PRIMARY KEY,
            Titulo VARCHAR(200) NOT NULL,
            Descricao TEXT,
            Plataforma ENUM('site', 'bot', 'ambos') DEFAULT 'ambos',
            Prioridade ENUM('low', 'medium', 'high') DEFAULT 'medium',
            Status ENUM('pendente', 'em-analise', 'aprovada', 'em-desenvolvimento', 'implementada', 'rejeitada') DEFAULT 'pendente',
            Votos INT DEFAULT 0,
            DataCriacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            DataAtualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_status (Status),
            INDEX idx_plataforma (Plataforma),
            INDEX idx_data_criacao (DataCriacao)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        usesReferenciaID: false,
        source: 'backend/routes/admin.js - painel de sugestões'
    }
};

/**
 * Verifica se uma tabela existe na base de dados
 */
async function tableExists(tableName) {
    try {
        // Usar query original para evitar recursão
        const originalQuery = getOriginalQuery();
        const [rows] = await originalQuery(
            `SELECT COUNT(*) as count FROM information_schema.tables 
             WHERE table_schema = DATABASE() AND table_name = ?`,
            [tableName]
        );
        return rows[0].count > 0;
    } catch (error) {
        console.error(`[TABLE MANAGER] Erro ao verificar existência da tabela ${tableName}:`, error);
        return false;
    }
}

/**
 * Obtém a definição de uma tabela (case-insensitive)
 */
function getTableDefinition(tableName) {
    const normalizedName = tableName.toLowerCase();
    return TABLE_DEFINITIONS[normalizedName];
}

/**
 * Recria uma tabela usando sua definição existente
 * Garante que cada tabela é criada no máximo uma vez por boot
 */
async function recreateTable(tableName, forceRecreate = false) {
    const normalizedName = tableName.toLowerCase();
    
    // Verificar se já foi criada neste boot (a menos que seja forçado)
    if (!forceRecreate && tablesCreatedThisBoot.has(normalizedName)) {
        return false; // Indica que não foi recriada (já existe)
    }
    
    const definition = getTableDefinition(normalizedName);
    
    if (!definition) {
        throw new Error(
            `[TABLE MANAGER] Definição não encontrada para a tabela "${normalizedName}". ` +
            `A tabela não será criada automaticamente. ` +
            `Adicione a definição em backend/database/tableManager.js se necessário.`
        );
    }
    
    try {
        // Remover IF NOT EXISTS para garantir recriação
        const createSql = definition.definition.replace(/CREATE TABLE IF NOT EXISTS/gi, 'CREATE TABLE');
        
        // Tentar dropar a tabela se existir (pode falhar se não existir, mas não é crítico)
        // Usar query original para evitar recursão
        const originalQuery = getOriginalQuery();
        try {
            await originalQuery(`DROP TABLE IF EXISTS \`${normalizedName}\``);
        } catch (dropError) {
            // Ignorar erros ao dropar (tabela pode não existir)
        }

        // Criar a tabela usando query original para evitar recursão
        await originalQuery(definition.definition);
        
        // Marcar como criada neste boot
        tablesCreatedThisBoot.add(normalizedName);
        
        return true;
    } catch (error) {
        console.error(`[TABLE MANAGER] Erro ao criar tabela ${normalizedName}:`, error.message);
        throw error;
    }
}

/**
 * Garante que uma tabela existe, recriando se necessário
 */
async function ensureTable(tableName) {
    const normalizedName = tableName.toLowerCase();
    const exists = await tableExists(normalizedName);
    
    if (!exists) {
        await recreateTable(normalizedName);
        return true; // Tabela foi criada
    } else {
        return false; // Tabela já existia
    }
}

/**
 * Handler de erro para queries SQL que detecta tabelas ausentes
 * e as recria automaticamente
 * 
 * IMPORTANTE: Recriação automática ocorre APENAS para ER_NO_SUCH_TABLE
 * Outros erros SQL são propagados normalmente
 */
export async function handleTableError(error, tableName = null) {
    // Verificar APENAS ER_NO_SUCH_TABLE (hardening: não recriar para outros erros)
    if (error.code !== 'ER_NO_SUCH_TABLE') {
        // Não é ER_NO_SUCH_TABLE, propagar erro normalmente
        throw error;
    }

    // Tentar extrair nome da tabela do erro se não foi fornecido
    if (!tableName) {
        const match = error.message?.match(/Table ['`](\w+)['`]/i) || 
                     error.message?.match(/table ['`](\w+)['`]/i);
        if (match) {
            tableName = match[1];
        }
    }

    if (!tableName) {
        throw new Error(
            `[TABLE MANAGER] Erro ER_NO_SUCH_TABLE detectado, mas não foi possível identificar o nome da tabela. ` +
            `Erro original: ${error.message}`
        );
    }

    const normalizedName = tableName.toLowerCase();
    
    // Verificar se já foi criada neste boot (prevenir loops)
    if (tablesCreatedThisBoot.has(normalizedName)) {
        throw new Error(
            `[TABLE MANAGER] Tabela ${normalizedName} já foi criada neste boot, mas ainda não existe. ` +
            `Possível problema de permissões ou conexão com a base de dados. ` +
            `Erro original: ${error.message}`
        );
    }

    // Verificar se temos definição para esta tabela
    const definition = getTableDefinition(normalizedName);
    if (!definition) {
        throw new Error(
            `[TABLE MANAGER] Tabela "${normalizedName}" não existe e não há definição disponível no código. ` +
            `Adicione a definição em backend/database/tableManager.js se necessário. ` +
            `Erro original: ${error.message}`
        );
    }

    // Recriar a tabela (já tem proteção contra múltiplas criações)
    await recreateTable(normalizedName);
}

/**
 * Wrapper para queries SQL que automaticamente recria tabelas se necessário
 * 
 * IMPORTANTE: Query é reexecutada apenas UMA vez após recriação.
 * Erros subsequentes são propagados normalmente.
 * 
 * CARALHO, NÃO MEXA NESSA FUNÇÃO SEM ENTENDER O QUE ELA FAZ
 * Essa função aqui é mágica: quando uma tabela não existe, ela recria automaticamente
 * Se tu fuder a lógica de prevenção de loops, pode criar um loop infinito
 * E aí o servidor vai ficar travado tentando recriar tabela infinitamente
 * A parte do queriesInRecovery é ESSENCIAL, não remove ela
 */
export async function queryWithTableRecovery(sql, params = []) {
    // Criar uma chave única para esta query (para prevenir loops)
    // ESSA CHAVE AQUI É O QUE PREVINE LOOPS INFINITOS
    // Se tu mudar a forma de gerar a chave, pode quebrar a proteção
    const queryKey = `${sql.substring(0, 50)}_${JSON.stringify(params).substring(0, 50)}`;
    
    // Se esta query já está em processo de recuperação, não tentar novamente
    // ESSA VERIFICAÇÃO AQUI É CRÍTICA, sem ela pode ter loop infinito
    if (queriesInRecovery.has(queryKey)) {
        throw new Error(
            `[TABLE MANAGER] Query já está em processo de recuperação. ` +
            `Evitando loop infinito. Erro original será propagado.`
        );
    }
    
    try {
        // Usar query original para evitar recursão infinita
        // NÃO MUDE ISSO, usa originalQuery pra não criar loop
        const originalQuery = getOriginalQuery();
        return await originalQuery(sql, params);
    } catch (error) {
        // Verificar se é ER_NO_SUCH_TABLE antes de tentar recuperação
        // Só recria tabela se for esse erro específico, outros erros são propagados
        if (error.code === 'ER_NO_SUCH_TABLE') {
            // Marcar query como em recuperação
            // ESSA LINHA AQUI PREVINE QUE A MESMA QUERY TENTE RECRIAR A TABELA VÁRIAS VEZES
            queriesInRecovery.add(queryKey);
            
            try {
                await handleTableError(error);
                
                // Reexecutar a query APENAS UMA VEZ após recriação (usar original para evitar loop)
                const originalQuery = getOriginalQuery();
                const result = await originalQuery(sql, params);
                
                // Remover da lista de recuperação após sucesso
                queriesInRecovery.delete(queryKey);
                
                return result;
            } catch (recoveryError) {
                // Remover da lista mesmo em caso de erro
                queriesInRecovery.delete(queryKey);
                
                // Propagar erro de recuperação
                throw recoveryError;
            }
        } else {
            // Não é ER_NO_SUCH_TABLE, propagar erro normalmente
            throw error;
        }
    }
}

/**
 * Inicializa todas as tabelas definidas (útil na inicialização do sistema)
 * 
 * Garante que cada tabela é verificada/criada apenas uma vez por boot
 * Cria tabelas em ordem de dependência para evitar erros de foreign key
 */
export async function initializeAllTables() {
    const results = {
        created: [],
        existing: [],
        errors: []
    };

    // Ordem de criação: tabelas base primeiro, depois dependentes
    // Tabelas sem dependências (ou com dependências já criadas)
    const creationOrder = [
        'perfis',           // Base - sem dependências
        'planos',           // Base - sem dependências
        'lojas',            // Base - sem dependências
        'utilizadores',     // Base - depende de perfis
        'produtos',         // Depende de utilizadores e lojas
        'historicoprecos',  // Depende de produtos
        'notificacoes',     // Depende de utilizadores e produtos
        'preferenciasnotificacao', // Depende de utilizadores
        'contasconectadas', // Depende de utilizadores
        'configutilizador', // Depende de utilizadores e planos
        'password_reset_tokens', // Depende de utilizadores
        'recuperar_senha',  // Depende de utilizadores
        'stripe_subscriptions', // Depende de utilizadores
        'supportmessages',   // Depende de utilizadores (auto-referência)
        'twitch_channels',   // Sem dependências
        'counting_config',   // Sem dependências
        'processed_releases', // Sem dependências
        'pages',            // Sem dependências
        'webhook_configs',  // Sem dependências
        'metricas_sistema', // Sem dependências
        'status_componentes', // Sem dependências
        'incidentes',       // Sem dependências
        'atualizacoes',    // Sem dependências
        'atualizacoes_sistema', // Sem dependências
        'bugsprojetos',    // Sem dependências
        'reviews',         // Sem dependências (usa discord_id, não ReferenciaID)
        'newsletter_subscribers', // Sem dependências
        'sugestoes'        // Sem dependências
    ];

    // Processar tabelas na ordem definida
    for (const tableName of creationOrder) {
        const definition = TABLE_DEFINITIONS[tableName];
        if (!definition) {
            continue;
        }

        try {
            const exists = await tableExists(tableName);
            if (!exists) {
                const wasCreated = await recreateTable(tableName);
                
                if (wasCreated) {
                    results.created.push({
                        table: tableName,
                        source: definition.source,
                        status: 'criada'
                    });
                } else {
                    // Já foi criada neste boot (não deveria acontecer, mas protegido)
                    results.existing.push({
                        table: tableName,
                        source: definition.source,
                        status: 'já_criada_neste_boot'
                    });
                }
            } else {
                results.existing.push({
                    table: tableName,
                    source: definition.source,
                    status: 'já_existia'
                });
            }
        } catch (error) {
            console.error(`[TABLE MANAGER] Erro ao inicializar tabela ${tableName}:`, error.message);
            results.errors.push({ 
                table: tableName, 
                source: definition.source,
                error: error.message 
            });
        }
    }

    // Processar tabelas que não estão na ordem (caso alguma tenha sido esquecida)
    for (const [tableName, definition] of Object.entries(TABLE_DEFINITIONS)) {
        if (!creationOrder.includes(tableName)) {
            try {
                const exists = await tableExists(tableName);
                if (!exists) {
                    const wasCreated = await recreateTable(tableName);
                    
                    if (wasCreated) {
                        results.created.push({
                            table: tableName,
                            source: definition.source,
                            status: 'criada'
                        });
                    }
                } else {
                    results.existing.push({
                        table: tableName,
                        source: definition.source,
                        status: 'já_existia'
                    });
                }
            } catch (error) {
                console.error(`[TABLE MANAGER] Erro ao inicializar tabela ${tableName}:`, error.message);
                results.errors.push({ 
                    table: tableName, 
                    source: definition.source,
                    error: error.message 
                });
            }
        }
    }

    if (results.created.length > 0 || results.errors.length > 0) {
        console.log(`[TABLE MANAGER] Inicialização: ${results.created.length} criadas, ${results.existing.length} existentes${results.errors.length > 0 ? `, ${results.errors.length} erros` : ''}`);
    }

    return results;
}

/**
 * Lista todas as tabelas definidas
 */
export function listDefinedTables() {
    return Object.keys(TABLE_DEFINITIONS).map(name => ({
        name,
        usesReferenciaID: TABLE_DEFINITIONS[name].usesReferenciaID,
        source: TABLE_DEFINITIONS[name].source
    }));
}

export {
    ensureTable,
    recreateTable,
    getTableDefinition,
    tableExists,
    TABLE_DEFINITIONS
};
