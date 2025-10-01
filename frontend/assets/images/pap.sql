-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Tempo de geração: 01/10/2025 às 12:47
-- Versão do servidor: 10.4.28-MariaDB
-- Versão do PHP: 8.2.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Banco de dados: `pap`
--

-- --------------------------------------------------------

--
-- Estrutura para tabela `codigossms`
--

CREATE TABLE `codigossms` (
  `Telefone` varchar(20) NOT NULL,
  `Codigo` varchar(6) NOT NULL,
  `ExpiraEm` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `codigossms`
--

INSERT INTO `codigossms` (`Telefone`, `Codigo`, `ExpiraEm`) VALUES
('+351933992199', '733910', '2025-09-30 22:47:21');

-- --------------------------------------------------------

--
-- Estrutura para tabela `configutilizador`
--

CREATE TABLE `configutilizador` (
  `Id` int(10) UNSIGNED NOT NULL,
  `UserId` int(10) UNSIGNED NOT NULL,
  `Email` varchar(150) DEFAULT NULL,
  `Telefone` varchar(20) DEFAULT NULL,
  `Plano` varchar(50) DEFAULT 'free',
  `LimiteProdutos` int(11) DEFAULT 5,
  `CanalPreferido` varchar(50) DEFAULT 'discord',
  `NotificacoesEnviadas` int(11) DEFAULT 0,
  `HistoricoAtivo` tinyint(1) DEFAULT 1,
  `UltimoLogin` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `configutilizador`
--

INSERT INTO `configutilizador` (`Id`, `UserId`, `Email`, `Telefone`, `Plano`, `LimiteProdutos`, `CanalPreferido`, `NotificacoesEnviadas`, `HistoricoAtivo`, `UltimoLogin`) VALUES
(3, 4, 'julia.admin@gmail.com', '+351912345678', 'Premium', 50, 'email', 0, 1, '2025-09-30 16:56:10'),
(5, 5, 'juliareboucasleite@gmail.com', NULL, 'free', 5, 'email', 0, 1, NULL),
(6, 6, 'gustavovyski@gmail.com', NULL, 'free', 5, 'email', 0, 1, NULL),
(7, 7, 'juliareboucasleite19@gmail.com', NULL, 'free', 5, 'email', 0, 1, NULL),
(8, 8, 'juliareboucasleite@hotmail.com', NULL, 'free', 5, 'email', 0, 1, NULL),
(9, 9, 'reboucasj08@gmail.com', NULL, 'free', 5, 'email', 0, 1, NULL);

-- --------------------------------------------------------

--
-- Estrutura para tabela `contasconectadas`
--

CREATE TABLE `contasconectadas` (
  `Id` int(10) UNSIGNED NOT NULL,
  `UserId` int(10) UNSIGNED NOT NULL,
  `Tipo` varchar(50) NOT NULL,
  `Identificador` varchar(100) NOT NULL,
  `Conectado` tinyint(1) DEFAULT 1,
  `DataConexao` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `contasconectadas`
--

INSERT INTO `contasconectadas` (`Id`, `UserId`, `Tipo`, `Identificador`, `Conectado`, `DataConexao`) VALUES
(2, 4, 'google', 'julia.admin@gmail.com', 1, '2025-09-29 16:56:51'),
(3, 4, 'google', 'julia.admin@gmail.com', 1, '2025-09-29 16:57:02'),
(4, 4, 'discord', 'julia_admin#1234', 0, '2025-09-30 16:57:02'),
(5, 4, 'telefone', '+351912345678', 1, '2025-09-29 16:57:02');

-- --------------------------------------------------------

--
-- Estrutura para tabela `historicoprecos`
--

CREATE TABLE `historicoprecos` (
  `Id` int(10) UNSIGNED NOT NULL,
  `ProdutoId` int(10) UNSIGNED NOT NULL,
  `Preco` decimal(10,2) NOT NULL,
  `DataRegisto` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `historicoprecos`
--

INSERT INTO `historicoprecos` (`Id`, `ProdutoId`, `Preco`, `DataRegisto`) VALUES
(46, 31, 209.00, '2025-10-01 11:27:48'),
(47, 32, 279.99, '2025-10-01 11:27:57'),
(48, 33, 64.99, '2025-10-01 11:28:04');

-- --------------------------------------------------------

--
-- Estrutura para tabela `lojas`
--

CREATE TABLE `lojas` (
  `id` int(11) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `dominio` varchar(100) NOT NULL,
  `codigo` varchar(50) NOT NULL,
  `ativa` tinyint(1) NOT NULL DEFAULT 1,
  `nivelStealth` enum('low','medium','high') NOT NULL DEFAULT 'medium',
  `regiao` varchar(10) NOT NULL DEFAULT 'pt',
  `seletores` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Seletores CSS específicos para scraping desta loja' CHECK (json_valid(`seletores`)),
  `configuracao` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Configurações específicas da loja' CHECK (json_valid(`configuracao`)),
  `ultimaVerificacao` datetime DEFAULT NULL COMMENT 'Última vez que a loja foi verificada',
  `taxaSucesso` decimal(5,2) DEFAULT 0.00 COMMENT 'Taxa de sucesso do scraping (0-100%)',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `notificacoes`
--

CREATE TABLE `notificacoes` (
  `Id` int(10) UNSIGNED NOT NULL,
  `UserId` int(10) UNSIGNED NOT NULL,
  `ProdutoId` int(10) UNSIGNED NOT NULL,
  `Tipo` varchar(50) NOT NULL,
  `Mensagem` text NOT NULL,
  `Enviada` tinyint(1) NOT NULL DEFAULT 1,
  `DataEnvio` datetime NOT NULL DEFAULT current_timestamp(),
  `ValorPoupado` decimal(10,2) DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `notificacoes`
--

INSERT INTO `notificacoes` (`Id`, `UserId`, `ProdutoId`, `Tipo`, `Mensagem`, `Enviada`, `DataEnvio`, `ValorPoupado`) VALUES
(35, 5, 31, 'email', '\n      <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background: #f9f9f9; border-radius: 8px; border: 1px solid #ddd; color: #333;\">\n        \n        <style>\n          @media (prefers-color-scheme: dark) {\n            div { background: #1e1e1e !important; color: #f0f0f0 !important; border: 1px solid #333 !important; }\n            h2 { color: #4dabf7 !important; }\n            .alert-box { background: #2d3748 !important; border: 1px solid #4a5568 !important; }\n            .price-highlight { color: #68d391 !important; }\n            a.btn { background: #4dabf7 !important; color: #fff !important; }\n          }\n        </style>\n\n        <h2 style=\"color: #1e90ff; text-align: center;\">🎉 Preço Alvo Atingido!</h2>\n        \n        <div class=\"alert-box\" style=\"padding: 15px; background: #fff; border-radius: 8px; border: 1px solid #eee; margin: 20px 0;\">\n          <p><b>📌 Produto:</b> Cadeira de Escritório Urban Factory Ergo Ajustável ESC01UF</p>\n          <p><b>🏪 Loja:</b> FNAC</p>\n          <p><b>💰 Preço atual:</b> <span class=\"price-highlight\">209,00 €</span></p>\n          <p><b>🎯 Preço alvo:</b> 500,00 €</p>\n          <p><b>💵 Poupança:</b> 291,00 € (58.2%)</p>\n        </div>\n\n        <div style=\"text-align: center; margin: 20px 0;\">\n          <a class=\"btn\" href=\"https://www.fnac.pt/Cadeira-de-Escritorio-Urban-Factory-Ergo-Ajustavel-ESC01UF-Periferico-ou-Jogo-Cadeiras-gaming/a9374108?oref=60876c5d-d454-83a8-1a01-4fce696b7feb\" target=\"_blank\" \n             style=\"display: inline-block; padding: 12px 24px; background: #1e90ff; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;\">\n            🔗 Ver oferta agora\n          </a>\n        </div>\n\n        <p style=\"text-align: center; color: #666; font-size: 14px;\">\n          Aproveite antes que o preço volte a subir! ⏰\n        </p>\n\n        <hr style=\"margin: 30px 0; border: none; border-top: 1px solid #ddd;\" />\n\n        <p style=\"font-size: 13px; color: #666; text-align: center;\">\n          Atenciosamente, <br/>\n          <b>Equipe PromoPing 🚀</b><br/>\n          <small>Esta é uma notificação automática — não responda a este email.</small>\n        </p>\n      </div>\n    ', 1, '2025-10-01 11:27:49', 291.00);

-- --------------------------------------------------------

--
-- Estrutura para tabela `pages`
--

CREATE TABLE `pages` (
  `id` int(11) NOT NULL,
  `url` text NOT NULL,
  `read` tinyint(1) NOT NULL DEFAULT 0,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `pages`
--

INSERT INTO `pages` (`id`, `url`, `read`, `createdAt`, `updatedAt`) VALUES
(1, 'https://lista.mercadolivre.com.br/fone-de-ouvido-beats-original#D[A:fone-de-ouvido-beats-original]', 1, '2025-10-01 08:27:15', '2025-10-01 08:28:11'),
(2, 'https://lista.mercadolivre.com.br/iphone-15#D[A:iphone-15]', 1, '2025-10-01 08:30:30', '2025-10-01 08:30:42'),
(3, 'https://www.worten.pt/produtos/telemoveis-e-tablets/telemoveis/iphone-15-128gb-preto-12345678', 1, '2025-10-01 08:30:30', '2025-10-01 08:30:48'),
(4, 'https://www.worten.pt/produtos/audio-e-video/auscultadores/airpods-pro-2-geracao-87654321', 1, '2025-10-01 08:30:30', '2025-10-01 08:30:54'),
(5, 'https://www.fnac.pt/iPhone-15-128GB-Preto-Apple/a1234567', 1, '2025-10-01 08:30:30', '2025-10-01 08:34:38'),
(6, 'https://www.fnac.pt/AirPods-Pro-2-geracao-Apple/a8765432', 1, '2025-10-01 08:30:30', '2025-10-01 08:34:52'),
(7, 'https://www.amazon.pt/dp/B0CHX1W1XY', 1, '2025-10-01 08:30:30', '2025-10-01 08:35:00'),
(8, 'https://www.amazon.pt/dp/B0BDJ7J9Z5', 1, '2025-10-01 08:30:30', '2025-10-01 08:38:04'),
(9, 'https://www.ikea.pt/pt/p/billy-estante-branca-00263850/', 1, '2025-10-01 08:30:30', '2025-10-01 08:38:12'),
(10, 'https://www.ikea.pt/pt/p/hemnes-cama-160x200-cm-cinzento-castanho-escuro-80263850/', 1, '2025-10-01 08:30:30', '2025-10-01 08:38:21'),
(11, 'https://www.zara.com/pt/pt/camiseta-basica-p04264020.html', 1, '2025-10-01 08:30:30', '2025-10-01 08:39:22'),
(12, 'https://www.zara.com/pt/pt/jeans-skinny-p04264030.html', 1, '2025-10-01 08:30:30', '2025-10-01 08:39:30'),
(13, 'https://www2.hm.com/pt_pt/productpage.12345678.html', 1, '2025-10-01 08:30:30', '2025-10-01 08:39:37'),
(14, 'https://www2.hm.com/pt_pt/productpage.87654321.html', 0, '2025-10-01 08:30:30', '2025-10-01 08:30:30'),
(15, 'https://www.worten.pt/produtos/maquina-de-cafe-delta-q-mini-qool-cinzento-7623244', 1, '2025-10-01 08:37:47', '2025-10-01 08:40:06');

-- --------------------------------------------------------

--
-- Estrutura para tabela `perfis`
--

CREATE TABLE `perfis` (
  `Id` int(10) UNSIGNED NOT NULL,
  `Nome` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `perfis`
--

INSERT INTO `perfis` (`Id`, `Nome`) VALUES
(1, 'Admin'),
(2, 'User');

-- --------------------------------------------------------

--
-- Estrutura para tabela `preferenciasnotificacao`
--

CREATE TABLE `preferenciasnotificacao` (
  `Id` int(10) UNSIGNED NOT NULL,
  `UserId` int(10) UNSIGNED NOT NULL,
  `Tipo` varchar(50) NOT NULL,
  `Ativo` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `preferenciasnotificacao`
--

INSERT INTO `preferenciasnotificacao` (`Id`, `UserId`, `Tipo`, `Ativo`) VALUES
(3, 4, 'email', 1),
(4, 4, 'sms', 1),
(5, 4, 'push', 0),
(6, 8, 'email', 1);

-- --------------------------------------------------------

--
-- Estrutura para tabela `produtos`
--

CREATE TABLE `produtos` (
  `Id` int(10) UNSIGNED NOT NULL,
  `UserId` int(10) UNSIGNED NOT NULL,
  `Nome` varchar(150) NOT NULL,
  `Link` varchar(500) NOT NULL,
  `PrecoAtual` decimal(10,2) DEFAULT NULL,
  `Shipping` varchar(100) DEFAULT '',
  `PrecoAlvo` decimal(10,2) DEFAULT NULL,
  `DataLimite` date DEFAULT NULL,
  `DataCriacao` timestamp NOT NULL DEFAULT current_timestamp(),
  `UpdatedAt` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `DeletedAt` timestamp NULL DEFAULT NULL,
  `Loja` varchar(60) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `produtos`
--

INSERT INTO `produtos` (`Id`, `UserId`, `Nome`, `Link`, `PrecoAtual`, `Shipping`, `PrecoAlvo`, `DataLimite`, `DataCriacao`, `UpdatedAt`, `DeletedAt`, `Loja`) VALUES
(31, 5, 'Cadeira de Escritório Urban Factory Ergo Ajustável ESC01UF', 'https://www.fnac.pt/Cadeira-de-Escritorio-Urban-Factory-Ergo-Ajustavel-ESC01UF-Periferico-ou-Jogo-Cadeiras-gaming/a9374108?oref=60876c5d-d454-83a8-1a01-4fce696b7feb', 209.00, '', 500.00, '2025-10-31', '2025-10-01 10:05:52', '2025-10-01 10:27:48', NULL, 'FNAC'),
(32, 5, 'iPhone 17 Pro Max APPLE (6.9\'\' - 256 GB - Prateado)', 'https://www.worten.pt/produtos/apple-watch-se-3-gps-40-mm-luz-das-estrelas-aluminio-com-bracelete-desportiva-luz-das-estrelas-tamanho-s-m-8600284', 279.99, '', 100.00, '2025-10-11', '2025-10-01 10:17:57', '2025-10-01 10:27:57', NULL, 'Worten'),
(33, 5, 'Auscultadores Gaming Bluetooth LOGITECH Lightspeed G435 (Over Ear - PC/PS4/PS5 - Noise Cancelling - Preto)', 'https://www.worten.pt/produtos/auscultadores-gaming-bluetooth-logitech-lightspeed-g435-over-ear-pc-ps4-ps5-noise-cancelling-preto-7463688', 64.99, '', 50.00, '2025-11-06', '2025-10-01 10:19:32', '2025-10-01 10:28:04', NULL, 'Worten');

-- --------------------------------------------------------

--
-- Estrutura para tabela `recuperar_senha`
--

CREATE TABLE `recuperar_senha` (
  `Id` int(10) UNSIGNED NOT NULL,
  `UserId` int(10) UNSIGNED NOT NULL,
  `Token` varchar(255) NOT NULL,
  `ExpiraEm` datetime NOT NULL,
  `Usado` tinyint(1) DEFAULT 0,
  `CriadoEm` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `utilizadores`
--

CREATE TABLE `utilizadores` (
  `Id` int(10) UNSIGNED NOT NULL,
  `Nome` varchar(100) NOT NULL,
  `Email` varchar(150) NOT NULL,
  `SenhaHash` varchar(255) NOT NULL,
  `DiscordId` varchar(50) DEFAULT NULL,
  `Telefone` varchar(20) DEFAULT NULL,
  `Ativo` tinyint(1) NOT NULL DEFAULT 1,
  `Data_Registo` datetime NOT NULL DEFAULT current_timestamp(),
  `PerfilId` int(10) UNSIGNED DEFAULT NULL,
  `GoogleId` varchar(100) DEFAULT NULL,
  `EmailVerificado` tinyint(1) DEFAULT 0,
  `CodigoEmail` varchar(6) DEFAULT NULL,
  `discord_id` varchar(50) DEFAULT NULL,
  `ultimo_login` timestamp NULL DEFAULT NULL,
  `dinheiro_poupado` decimal(10,2) DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `utilizadores`
--

INSERT INTO `utilizadores` (`Id`, `Nome`, `Email`, `SenhaHash`, `DiscordId`, `Telefone`, `Ativo`, `Data_Registo`, `PerfilId`, `GoogleId`, `EmailVerificado`, `CodigoEmail`, `discord_id`, `ultimo_login`, `dinheiro_poupado`) VALUES
(4, 'julia_admin', 'julia.admin@gmail.com', '$2a$11$EBuekNdjZ6.8BSB4nOXdKOD/ezP1flxjPejPZ1CHHE7.d/D5/xN6q', NULL, NULL, 1, '2025-09-30 15:26:07', 1, NULL, 0, NULL, NULL, NULL, 0.00),
(5, 'Julia Rebouças', 'juliareboucasleite@gmail.com', '$2b$10$8S7l1v4v0iiLr52noJBnE.cfy01PyiNH..A8jQ/U6gyFnBqJ6bYoi', NULL, '933992199', 1, '2025-09-30 19:19:05', NULL, NULL, 0, '137468', NULL, NULL, 0.00),
(6, 'Gustavo', 'gustavovyski@gmail.com', '$2b$10$ULwfdij7cBcAWCDbsWahcu2ESPzpSk8mDjFl7bdN8DDXruZoj7Uki', NULL, NULL, 1, '2025-09-30 19:21:30', NULL, NULL, 1, NULL, NULL, NULL, 0.00),
(7, 'Julia Leite', 'juliareboucasleite19@gmail.com', '$2b$10$vq0G6q8BxrR6g4PyfGAL2uFCQu2iIFYl1aCfPICsEEtuxhHrM/K7.', NULL, NULL, 1, '2025-09-30 20:12:23', NULL, NULL, 1, NULL, NULL, NULL, 0.00),
(8, 'Julia Leite', 'juliareboucasleite@hotmail.com', '$2b$10$uN1R5T4vUHloMCMiqT4gGOQccWomOAI/OTqCfS1p3cjS2BI9/Djv2', NULL, '+351933992199', 1, '2025-09-30 22:44:22', NULL, NULL, 1, NULL, NULL, NULL, 0.00),
(9, 'Julia Rebouças', 'reboucasj08@gmail.com', '$2b$10$VU21i81IlbZOR3kCVMtKReKbDFgDahSINAR/KIydAXrFPrTPGP7CK', NULL, NULL, 1, '2025-10-01 08:47:03', NULL, NULL, 1, NULL, NULL, NULL, 0.00);

--
-- Índices para tabelas despejadas
--

--
-- Índices de tabela `codigossms`
--
ALTER TABLE `codigossms`
  ADD PRIMARY KEY (`Telefone`);

--
-- Índices de tabela `configutilizador`
--
ALTER TABLE `configutilizador`
  ADD PRIMARY KEY (`Id`),
  ADD UNIQUE KEY `uq_config_user` (`UserId`),
  ADD UNIQUE KEY `uq_config_email` (`Email`);

--
-- Índices de tabela `contasconectadas`
--
ALTER TABLE `contasconectadas`
  ADD PRIMARY KEY (`Id`),
  ADD KEY `UserId` (`UserId`);

--
-- Índices de tabela `historicoprecos`
--
ALTER TABLE `historicoprecos`
  ADD PRIMARY KEY (`Id`),
  ADD KEY `idx_historico_produto` (`ProdutoId`);

--
-- Índices de tabela `lojas`
--
ALTER TABLE `lojas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `dominio` (`dominio`),
  ADD UNIQUE KEY `codigo` (`codigo`),
  ADD UNIQUE KEY `lojas_dominio` (`dominio`),
  ADD UNIQUE KEY `lojas_codigo` (`codigo`),
  ADD KEY `lojas_ativa` (`ativa`),
  ADD KEY `lojas_regiao` (`regiao`);

--
-- Índices de tabela `notificacoes`
--
ALTER TABLE `notificacoes`
  ADD PRIMARY KEY (`Id`),
  ADD KEY `UserId` (`UserId`),
  ADD KEY `ProdutoId` (`ProdutoId`);

--
-- Índices de tabela `pages`
--
ALTER TABLE `pages`
  ADD PRIMARY KEY (`id`);

--
-- Índices de tabela `perfis`
--
ALTER TABLE `perfis`
  ADD PRIMARY KEY (`Id`),
  ADD UNIQUE KEY `Nome` (`Nome`);

--
-- Índices de tabela `preferenciasnotificacao`
--
ALTER TABLE `preferenciasnotificacao`
  ADD PRIMARY KEY (`Id`),
  ADD KEY `UserId` (`UserId`);

--
-- Índices de tabela `produtos`
--
ALTER TABLE `produtos`
  ADD PRIMARY KEY (`Id`),
  ADD KEY `UserId` (`UserId`);

--
-- Índices de tabela `recuperar_senha`
--
ALTER TABLE `recuperar_senha`
  ADD PRIMARY KEY (`Id`),
  ADD KEY `UserId` (`UserId`);

--
-- Índices de tabela `utilizadores`
--
ALTER TABLE `utilizadores`
  ADD PRIMARY KEY (`Id`),
  ADD UNIQUE KEY `Email` (`Email`),
  ADD UNIQUE KEY `uq_googleid` (`GoogleId`),
  ADD UNIQUE KEY `discord_id` (`discord_id`),
  ADD KEY `PerfilId` (`PerfilId`);

--
-- AUTO_INCREMENT para tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `configutilizador`
--
ALTER TABLE `configutilizador`
  MODIFY `Id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT de tabela `contasconectadas`
--
ALTER TABLE `contasconectadas`
  MODIFY `Id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de tabela `historicoprecos`
--
ALTER TABLE `historicoprecos`
  MODIFY `Id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=49;

--
-- AUTO_INCREMENT de tabela `lojas`
--
ALTER TABLE `lojas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `notificacoes`
--
ALTER TABLE `notificacoes`
  MODIFY `Id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=36;

--
-- AUTO_INCREMENT de tabela `pages`
--
ALTER TABLE `pages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT de tabela `perfis`
--
ALTER TABLE `perfis`
  MODIFY `Id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de tabela `preferenciasnotificacao`
--
ALTER TABLE `preferenciasnotificacao`
  MODIFY `Id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de tabela `produtos`
--
ALTER TABLE `produtos`
  MODIFY `Id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- AUTO_INCREMENT de tabela `recuperar_senha`
--
ALTER TABLE `recuperar_senha`
  MODIFY `Id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de tabela `utilizadores`
--
ALTER TABLE `utilizadores`
  MODIFY `Id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- Restrições para tabelas despejadas
--

--
-- Restrições para tabelas `configutilizador`
--
ALTER TABLE `configutilizador`
  ADD CONSTRAINT `configutilizador_ibfk_1` FOREIGN KEY (`UserId`) REFERENCES `utilizadores` (`Id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `contasconectadas`
--
ALTER TABLE `contasconectadas`
  ADD CONSTRAINT `contasconectadas_ibfk_1` FOREIGN KEY (`UserId`) REFERENCES `utilizadores` (`Id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `historicoprecos`
--
ALTER TABLE `historicoprecos`
  ADD CONSTRAINT `historicoprecos_ibfk_1` FOREIGN KEY (`ProdutoId`) REFERENCES `produtos` (`Id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `notificacoes`
--
ALTER TABLE `notificacoes`
  ADD CONSTRAINT `notificacoes_ibfk_1` FOREIGN KEY (`UserId`) REFERENCES `utilizadores` (`Id`) ON DELETE CASCADE,
  ADD CONSTRAINT `notificacoes_ibfk_2` FOREIGN KEY (`ProdutoId`) REFERENCES `produtos` (`Id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `preferenciasnotificacao`
--
ALTER TABLE `preferenciasnotificacao`
  ADD CONSTRAINT `preferenciasnotificacao_ibfk_1` FOREIGN KEY (`UserId`) REFERENCES `utilizadores` (`Id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `produtos`
--
ALTER TABLE `produtos`
  ADD CONSTRAINT `produtos_ibfk_1` FOREIGN KEY (`UserId`) REFERENCES `utilizadores` (`Id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `recuperar_senha`
--
ALTER TABLE `recuperar_senha`
  ADD CONSTRAINT `recuperar_senha_ibfk_1` FOREIGN KEY (`UserId`) REFERENCES `utilizadores` (`Id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `utilizadores`
--
ALTER TABLE `utilizadores`
  ADD CONSTRAINT `utilizadores_ibfk_1` FOREIGN KEY (`PerfilId`) REFERENCES `perfis` (`Id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
