-- ============================
-- Criar base de dados
-- ============================

DROP DATABASE IF EXISTS pap;
CREATE DATABASE pap CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE pap;

-- ============================
-- TABELA: Utilizadores
-- ============================

CREATE TABLE utilizadores (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha VARCHAR(255) NULL, -- pode ser null (login externo ex: Discord)
    perfil ENUM('admin','user') DEFAULT 'user',
    ultimo_login TIMESTAMP NULL,
    ativo TINYINT(1) DEFAULT 1,
    data_registo TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================
-- TABELA: ConfigUtilizador
-- ============================

CREATE TABLE ConfigUtilizador (
    UserId INT UNSIGNED NOT NULL UNIQUE,
    Plano VARCHAR(20) DEFAULT 'free',
    CanalPreferido VARCHAR(20) DEFAULT 'whatsapp',
    LimiteProdutos INT DEFAULT 5,
    HistoricoAtivo TINYINT(1) DEFAULT 1,
    CONSTRAINT fk_config_user FOREIGN KEY (UserId) REFERENCES utilizadores(id) ON DELETE CASCADE
);

-- ============================
-- TABELA: Produtos
-- ============================

CREATE TABLE Produtos (
    Id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    UserId INT UNSIGNED NOT NULL,
    Nome VARCHAR(150) NOT NULL,
    Link VARCHAR(500) NOT NULL,
    PrecoAlvo DECIMAL(10,2) NULL,
    DataLimite DATE NULL,
    DataCriacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_prod_user FOREIGN KEY (UserId) REFERENCES utilizadores(id) ON DELETE CASCADE
);

-- ============================
-- TABELA: HistoricoPrecos
-- ============================

CREATE TABLE HistoricoPrecos (
    Id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ProdutoId INT UNSIGNED NOT NULL,
    Preco DECIMAL(10,2) NOT NULL,
    DataRegistro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ProdutoId) REFERENCES Produtos(Id) ON DELETE CASCADE
);

-- ============================
-- TABELA: Notificacoes
-- ============================

CREATE TABLE Notificacoes (
    Id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    UserId INT UNSIGNED NOT NULL,
    ProdutoId INT UNSIGNED,
    Tipo ENUM('discord','email','whatsapp') NOT NULL,
    Mensagem TEXT NOT NULL,
    Enviada BOOLEAN DEFAULT FALSE,
    DataEnvio TIMESTAMP NULL,
    CriadoEm TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (UserId) REFERENCES utilizadores(id) ON DELETE CASCADE,
    FOREIGN KEY (ProdutoId) REFERENCES Produtos(Id) ON DELETE CASCADE
);

-- ============================
-- Confirmação
-- ============================

SHOW TABLES;
