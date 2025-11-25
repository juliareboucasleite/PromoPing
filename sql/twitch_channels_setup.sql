-- Criar tabela para canais Twitch monitorados
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Criar tabela para configurações de webhooks
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Adicionar canal leeksxy (ignora se já existir)
INSERT IGNORE INTO twitch_channels (ChannelName) VALUES ('leeksxy');

