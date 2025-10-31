-- PromoPing - Schema base MySQL
-- Tabelas: Utilizadores, Administradores, Planos, ConfigUtilizador, Produtos, HistoricoPrecos, Notificacoes, ContasConectadas, PreferenciasNotificacao

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ========================
-- Utilizadores
-- ========================
CREATE TABLE IF NOT EXISTS Utilizadores (
  Id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  Nome            VARCHAR(120) NULL,
  Email           VARCHAR(190) NOT NULL UNIQUE,
  SenhaHash       VARCHAR(255) NULL,
  EmailVerificado TINYINT(1) DEFAULT 0,
  Telefone        VARCHAR(20) NULL,
  CodigoEmail     VARCHAR(10) NULL,
  CodigoTelefone  VARCHAR(10) NULL,
  Ativo           TINYINT(1) DEFAULT 1,
  discord_id      VARCHAR(50) UNIQUE NULL,
  ultimo_login    TIMESTAMP NULL,
  DataCriacao     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ========================
-- Administradores (separado para RBAC simples)
-- ========================
CREATE TABLE IF NOT EXISTS Administradores (
  Id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  Nome        VARCHAR(120) NOT NULL,
  Email       VARCHAR(190) NOT NULL UNIQUE,
  SenhaHash   VARCHAR(255) NOT NULL,
  Role        ENUM('admin','superadmin') NOT NULL DEFAULT 'admin',
  Ativo       TINYINT(1) DEFAULT 1,
  CriadoEm    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- Planos
-- ========================
CREATE TABLE IF NOT EXISTS Planos (
  Id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  Nome            VARCHAR(50) NOT NULL UNIQUE,
  LimiteProdutos  INT UNSIGNED NOT NULL DEFAULT 5,
  PrecoMensal     DECIMAL(10,2) DEFAULT 0.00
);

INSERT INTO Planos (Nome, LimiteProdutos, PrecoMensal)
SELECT 'Free', 5, 0.00
WHERE NOT EXISTS (SELECT 1 FROM Planos WHERE Nome = 'Free');

-- ========================
-- ConfigUtilizador
-- ========================
CREATE TABLE IF NOT EXISTS ConfigUtilizador (
  Id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserId         INT UNSIGNED NOT NULL,
  Email          VARCHAR(190) NULL,
  CanalPreferido ENUM('email','discord','telegram','whatsapp') DEFAULT 'email',
  PlanoAtualId   INT UNSIGNED NOT NULL,
  LimiteProdutos INT UNSIGNED NOT NULL DEFAULT 5,
  FOREIGN KEY (UserId) REFERENCES Utilizadores(Id) ON DELETE CASCADE,
  FOREIGN KEY (PlanoAtualId) REFERENCES Planos(Id) ON DELETE RESTRICT,
  UNIQUE KEY uq_config_user (UserId)
);

-- ========================
-- Produtos
-- ========================
CREATE TABLE IF NOT EXISTS Produtos (
  Id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserId       INT UNSIGNED NOT NULL,
  Nome         VARCHAR(255) NOT NULL,
  Link         TEXT NOT NULL,
  Loja         VARCHAR(60) NULL,
  PrecoAtual   DECIMAL(10,2) NULL,
  PrecoAlvo    DECIMAL(10,2) NOT NULL,
  DataCriacao  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  DataLimite   TIMESTAMP NULL,
  UpdatedAt    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (UserId) REFERENCES Utilizadores(Id) ON DELETE CASCADE,
  INDEX idx_user (UserId),
  INDEX idx_loja (Loja)
);

-- ========================
-- HistoricoPrecos
-- ========================
CREATE TABLE IF NOT EXISTS HistoricoPrecos (
  Id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ProdutoId    INT UNSIGNED NOT NULL,
  Preco        DECIMAL(10,2) NOT NULL,
  DataRegisto  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ProdutoId) REFERENCES Produtos(Id) ON DELETE CASCADE,
  INDEX idx_prod_data (ProdutoId, DataRegisto)
);

-- ========================
-- Notificacoes
-- ========================
CREATE TABLE IF NOT EXISTS Notificacoes (
  Id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserId        INT UNSIGNED NOT NULL,
  ProdutoId     INT UNSIGNED NULL,
  Tipo          ENUM('discord','email','whatsapp') NOT NULL,
  Mensagem      TEXT NOT NULL,
  Enviada       TINYINT(1) DEFAULT 0,
  DataEnvio     TIMESTAMP NULL,
  CriadoEm      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ValorPoupado  DECIMAL(10,2) NULL,
  FOREIGN KEY (UserId) REFERENCES Utilizadores(Id) ON DELETE CASCADE,
  FOREIGN KEY (ProdutoId) REFERENCES Produtos(Id) ON DELETE CASCADE
);

-- ========================
-- ContasConectadas
-- ========================
CREATE TABLE IF NOT EXISTS ContasConectadas (
  Id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserId        INT UNSIGNED NOT NULL,
  Tipo          ENUM('google','discord','telegram','whatsapp') NOT NULL,
  Identificador VARCHAR(255) NOT NULL,
  Conectado     TINYINT(1) DEFAULT 1,
  DataConexao   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (UserId) REFERENCES Utilizadores(Id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_tipo (UserId, Tipo)
);

-- ========================
-- PreferenciasNotificacao
-- ========================
CREATE TABLE IF NOT EXISTS PreferenciasNotificacao (
  Id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  UserId INT UNSIGNED NOT NULL,
  Tipo   ENUM('email','discord','telegram','whatsapp') NOT NULL,
  Ativo  TINYINT(1) DEFAULT 1,
  FOREIGN KEY (UserId) REFERENCES Utilizadores(Id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_tipo (UserId, Tipo)
);

-- Seed ConfigUtilizador para utilizadores existentes (se aplicável)
INSERT INTO ConfigUtilizador (UserId, Email, CanalPreferido, PlanoAtualId, LimiteProdutos)
SELECT u.Id, u.Email, 'email', p.Id, p.LimiteProdutos
FROM Utilizadores u
JOIN Planos p ON p.Nome = 'Free'
LEFT JOIN ConfigUtilizador c ON c.UserId = u.Id
WHERE c.Id IS NULL;


