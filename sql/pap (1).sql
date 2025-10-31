-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Tempo de geração: 31/10/2025 às 21:53
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
  `PlanoAtualId` int(11) NOT NULL DEFAULT 1,
  `PlanoAtivoId` int(11) NOT NULL DEFAULT 1,
  `DataInicio` datetime DEFAULT current_timestamp(),
  `DataCancelamento` datetime DEFAULT NULL,
  `DataExpiracao` datetime DEFAULT NULL,
  `StatusAssinatura` enum('Ativa','Cancelada','Expirada','Gratuita','PeriodoGraca') DEFAULT 'Gratuita',
  `LimiteProdutos` int(11) DEFAULT 5,
  `CanalPreferido` varchar(50) DEFAULT 'discord',
  `NotificacoesEnviadas` int(11) DEFAULT 0,
  `HistoricoAtivo` tinyint(1) DEFAULT 1,
  `UltimoLogin` datetime DEFAULT NULL,
  `HistoricoDias` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `configutilizador`
--

INSERT INTO `configutilizador` (`Id`, `UserId`, `PlanoAtualId`, `PlanoAtivoId`, `DataInicio`, `DataCancelamento`, `DataExpiracao`, `StatusAssinatura`, `LimiteProdutos`, `CanalPreferido`, `NotificacoesEnviadas`, `HistoricoAtivo`, `UltimoLogin`, `HistoricoDias`) VALUES
(1, 6, 3, 2, '2025-10-20 22:36:57', NULL, NULL, 'Ativa', 25, 'email', 0, 1, NULL, 30),
(2, 4, 1, 2, '2025-10-20 22:46:06', '2025-10-20 23:43:29', NULL, 'Gratuita', 25, 'email', 0, 1, NULL, 30),
(3, 5, 3, 1, '2025-10-20 22:46:06', NULL, NULL, 'Ativa', 9999, 'email', 0, 1, NULL, 30),
(4, 16, 1, 1, '2025-10-20 22:46:06', NULL, NULL, 'Gratuita', 5, 'email', 0, 1, NULL, 30),
(5, 17, 1, 1, '2025-10-20 22:46:06', NULL, NULL, 'Gratuita', 5, 'email', 0, 1, NULL, 30),
(6, 18, 1, 1, '2025-10-20 22:46:06', NULL, NULL, 'Gratuita', 5, 'email', 0, 1, NULL, 30);

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
(164, 60, 1499.00, '2025-10-27 22:55:09'),
(165, 60, 287.08, '2025-10-28 22:06:12'),
(166, 60, 262.77, '2025-10-28 22:10:06'),
(167, 60, 82.17, '2025-10-28 22:14:53'),
(168, 60, 540.40, '2025-10-28 22:14:55'),
(169, 60, 426.69, '2025-10-28 22:14:56'),
(170, 60, 391.43, '2025-10-28 22:14:57'),
(171, 60, 798.66, '2025-10-28 22:14:58'),
(172, 60, 566.74, '2025-10-28 22:14:59'),
(173, 60, 198.49, '2025-10-28 22:14:59'),
(174, 60, 795.05, '2025-10-28 22:14:59'),
(175, 60, 261.27, '2025-10-28 22:23:54'),
(177, 60, 1499.00, '2025-10-31 20:50:59');

-- --------------------------------------------------------

--
-- Estrutura para tabela `incidentes`
--

CREATE TABLE `incidentes` (
  `Id` int(10) UNSIGNED NOT NULL,
  `Titulo` varchar(150) NOT NULL,
  `Descricao` text NOT NULL,
  `DataInicio` datetime NOT NULL,
  `DataFim` datetime DEFAULT NULL,
  `Impacto` varchar(255) DEFAULT NULL,
  `Estado` enum('Ativo','Resolvido','Planeado') DEFAULT 'Resolvido',
  `ComponenteId` int(10) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `incidentes`
--

INSERT INTO `incidentes` (`Id`, `Titulo`, `Descricao`, `DataInicio`, `DataFim`, `Impacto`, `Estado`, `ComponenteId`) VALUES
(1, 'Manutenção Programada - API', 'Atualização de segurança e otimização de performance.', '2025-01-12 14:00:00', '2025-01-12 14:15:00', 'Interrupção temporária da API', 'Resolvido', 1),
(2, 'Problema de Latência - Notificações', 'Atrasos no envio de emails e mensagens.', '2025-01-08 09:30:00', '2025-01-08 11:30:00', 'Atraso nas notificações', 'Resolvido', 3);

-- --------------------------------------------------------

--
-- Estrutura para tabela `lojas`
--

CREATE TABLE `lojas` (
  `id` int(11) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `dominio` varchar(255) NOT NULL,
  `css_selector_preco` varchar(500) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `lojas`
--

INSERT INTO `lojas` (`id`, `nome`, `dominio`, `css_selector_preco`, `created_at`) VALUES
(1, 'Amazon', 'amazon.com', '.a-price-whole, .a-price-fraction, .a-offscreen, [data-asin-price], .a-price .a-offscreen', '2025-10-08 19:52:46'),
(2, 'Amazon', 'amazon.es', '.a-price-whole, .a-price-fraction, .a-offscreen, [data-asin-price], .a-price .a-offscreen', '2025-10-08 19:52:46'),
(3, 'Worten', 'worten.pt', 'span.value, sup.decimal, .current-price, .product-price', '2025-10-08 19:52:46'),
(4, 'FNAC', 'fnac.pt', '.f-priceBox__price, .f-priceBox-price, .price, .userPrice.checked', '2025-10-08 19:52:46'),
(5, 'Continente', 'continente.pt', 'span.ct-price-formatted, .price, .product-price, .current-price', '2025-10-08 19:52:46'),
(6, 'PCDiga', 'pcdiga.com', '.product-price, .price, .current-price, [data-testid=\"price\"]', '2025-10-08 19:52:46'),
(7, 'GlobalData', 'globaldata.pt', '.price, .current-price, .product-price, [data-testid=\"price\"]', '2025-10-08 19:52:46'),
(8, 'Radio Popular', 'radiopopular.pt', '.sales, .price, .product-price, .current-price', '2025-10-08 19:52:46'),
(9, 'MediaMarkt', 'mediamarkt.pt', '.Price.price, .price, .current-price, [data-testid=\"price\"]', '2025-10-08 19:52:46'),
(10, 'IKEA', 'ikea.pt', 'span.product-pip__price__value, .pip-price__integer, .pip-price__integer--medium', '2025-10-08 19:52:46'),
(11, 'Leroy Merlin', 'leroymerlin.pt', 'span.m-price__line, .price, .product-price, .current-price', '2025-10-08 19:52:46'),
(12, 'Zara', 'zara.com', '.price._product-price, .money-amount', '2025-10-08 19:52:46'),
(13, 'H&M', 'hm.com', 'span.price-value, .price, .new-price', '2025-10-08 19:52:46');

-- --------------------------------------------------------

--
-- Estrutura para tabela `metricas_sistema`
--

CREATE TABLE `metricas_sistema` (
  `Id` int(10) UNSIGNED NOT NULL,
  `UptimeGeral` decimal(5,2) DEFAULT 99.90,
  `TempoRespostaMedia` int(11) DEFAULT 45,
  `UtilizadoresAtivos` int(11) DEFAULT 0,
  `ProdutosMonitorizados` int(11) DEFAULT 0,
  `NotificacoesEnviadas` int(11) DEFAULT 0,
  `AtualizadoEm` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `metricas_sistema`
--

INSERT INTO `metricas_sistema` (`Id`, `UptimeGeral`, `TempoRespostaMedia`, `UtilizadoresAtivos`, `ProdutosMonitorizados`, `NotificacoesEnviadas`, `AtualizadoEm`) VALUES
(1, 99.90, 45, 12847, 1200000, 8542, '2025-10-08 17:27:47');

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
  `ValorPoupado` decimal(10,2) DEFAULT 0.00,
  `Data` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
-- Estrutura para tabela `planos`
--

CREATE TABLE `planos` (
  `Id` int(11) NOT NULL,
  `Nome` varchar(50) NOT NULL,
  `Preco` decimal(6,2) NOT NULL,
  `LimiteProdutos` int(11) DEFAULT NULL,
  `HistoricoDias` int(11) DEFAULT NULL,
  `IntervaloVerificacao` varchar(50) DEFAULT NULL,
  `PermiteSMS` tinyint(1) DEFAULT NULL,
  `Relatorios` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `planos`
--

INSERT INTO `planos` (`Id`, `Nome`, `Preco`, `LimiteProdutos`, `HistoricoDias`, `IntervaloVerificacao`, `PermiteSMS`, `Relatorios`) VALUES
(1, 'Free', 0.00, 5, 7, '24', 0, 'nenhum'),
(2, 'Basic', 4.99, 25, 30, '4', 1, 'basico'),
(3, 'Premium', 15.30, 9999, 9999, '0', 1, 'avancado'),
(4, 'Standard', 12.99, 9999, 9999, '0.5', 1, 'avancado');

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
(114, 5, 'email', 1),
(115, 5, 'telefone', 0),
(116, 6, 'email', 1),
(117, 6, 'telefone', 0),
(118, 18, 'email', 1),
(120, 18, 'email', 1),
(121, 18, 'telefone', 1),
(122, 6, 'email', 1),
(123, 6, 'telefone', 0),
(124, 18, 'email', 1),
(125, 18, 'telefone', 1),
(126, 5, 'email', 1),
(127, 5, 'telefone', 0),
(128, 6, 'email', 1),
(129, 6, 'telefone', 0),
(130, 6, 'email', 1),
(131, 6, 'telefone', 0);

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
  `LojaId` int(11) DEFAULT NULL,
  `Loja` varchar(60) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `produtos`
--

INSERT INTO `produtos` (`Id`, `UserId`, `Nome`, `Link`, `PrecoAtual`, `Shipping`, `PrecoAlvo`, `DataLimite`, `DataCriacao`, `UpdatedAt`, `DeletedAt`, `LojaId`, `Loja`) VALUES
(60, 5, 'iPhone 17 Pro Max APPLE (6.9\'\' - 256 GB - Prateado)', 'https://www.worten.pt/produtos/iphone-17-pro-max-apple-6-9-256-gb-prateado-8600349', 1499.00, '', 1500.00, NULL, '2025-10-27 22:54:28', '2025-10-31 20:50:59', NULL, 3, 'Worten');

--
-- Acionadores `produtos`
--
DELIMITER $$
CREATE TRIGGER `trg_produto_define_loja` BEFORE INSERT ON `produtos` FOR EACH ROW BEGIN
    DECLARE loja_id INT;

    -- FNAC
    IF NEW.Link LIKE '%fnac.pt%' THEN
        SELECT id INTO loja_id FROM lojas WHERE dominio = 'fnac.pt' LIMIT 1;

    -- WORTEN
    ELSEIF NEW.Link LIKE '%worten.pt%' THEN
        SELECT id INTO loja_id FROM lojas WHERE dominio = 'worten.pt' LIMIT 1;

    -- AMAZON (.com / .es)
    ELSEIF NEW.Link LIKE '%amazon.com%' THEN
        SELECT id INTO loja_id FROM lojas WHERE dominio = 'amazon.com' LIMIT 1;
    ELSEIF NEW.Link LIKE '%amazon.es%' THEN
        SELECT id INTO loja_id FROM lojas WHERE dominio = 'amazon.es' LIMIT 1;

    -- CONTINENTE
    ELSEIF NEW.Link LIKE '%continente.pt%' THEN
        SELECT id INTO loja_id FROM lojas WHERE dominio = 'continente.pt' LIMIT 1;

    -- LEROY MERLIN
    ELSEIF NEW.Link LIKE '%leroymerlin.pt%' THEN
        SELECT id INTO loja_id FROM lojas WHERE dominio = 'leroymerlin.pt' LIMIT 1;

    -- PCDIGA
    ELSEIF NEW.Link LIKE '%pcdiga.com%' THEN
        SELECT id INTO loja_id FROM lojas WHERE dominio = 'pcdiga.com' LIMIT 1;

    -- GLOBALDATA
    ELSEIF NEW.Link LIKE '%globaldata.pt%' THEN
        SELECT id INTO loja_id FROM lojas WHERE dominio = 'globaldata.pt' LIMIT 1;

    -- MEDIA MARKT
    ELSEIF NEW.Link LIKE '%mediamarkt.pt%' THEN
        SELECT id INTO loja_id FROM lojas WHERE dominio = 'mediamarkt.pt' LIMIT 1;

    -- RADIO POPULAR
    ELSEIF NEW.Link LIKE '%radiopopular.pt%' THEN
        SELECT id INTO loja_id FROM lojas WHERE dominio = 'radiopopular.pt' LIMIT 1;

    -- IKEA
    ELSEIF NEW.Link LIKE '%ikea.pt%' THEN
        SELECT id INTO loja_id FROM lojas WHERE dominio = 'ikea.pt' LIMIT 1;

    -- ZARA
    ELSEIF NEW.Link LIKE '%zara.com%' THEN
        SELECT id INTO loja_id FROM lojas WHERE dominio = 'zara.com' LIMIT 1;

    -- H&M
    ELSEIF NEW.Link LIKE '%hm.com%' THEN
        SELECT id INTO loja_id FROM lojas WHERE dominio = 'hm.com' LIMIT 1;

    ELSE
        SET loja_id = NULL;
    END IF;

    -- Define o valor antes da inserção
    SET NEW.LojaId = loja_id;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_produto_update_loja` BEFORE UPDATE ON `produtos` FOR EACH ROW BEGIN
    DECLARE loja_id INT;

    -- Só executa se o link foi alterado
    IF NEW.Link <> OLD.Link THEN

        -- FNAC
        IF NEW.Link LIKE '%fnac.pt%' THEN
            SELECT id INTO loja_id FROM lojas WHERE dominio = 'fnac.pt' LIMIT 1;

        -- WORTEN
        ELSEIF NEW.Link LIKE '%worten.pt%' THEN
            SELECT id INTO loja_id FROM lojas WHERE dominio = 'worten.pt' LIMIT 1;

        -- AMAZON (.com / .es)
        ELSEIF NEW.Link LIKE '%amazon.com%' THEN
            SELECT id INTO loja_id FROM lojas WHERE dominio = 'amazon.com' LIMIT 1;
        ELSEIF NEW.Link LIKE '%amazon.es%' THEN
            SELECT id INTO loja_id FROM lojas WHERE dominio = 'amazon.es' LIMIT 1;

        -- CONTINENTE
        ELSEIF NEW.Link LIKE '%continente.pt%' THEN
            SELECT id INTO loja_id FROM lojas WHERE dominio = 'continente.pt' LIMIT 1;

        -- LEROY MERLIN
        ELSEIF NEW.Link LIKE '%leroymerlin.pt%' THEN
            SELECT id INTO loja_id FROM lojas WHERE dominio = 'leroymerlin.pt' LIMIT 1;

        -- PCDIGA
        ELSEIF NEW.Link LIKE '%pcdiga.com%' THEN
            SELECT id INTO loja_id FROM lojas WHERE dominio = 'pcdiga.com' LIMIT 1;

        -- GLOBALDATA
        ELSEIF NEW.Link LIKE '%globaldata.pt%' THEN
            SELECT id INTO loja_id FROM lojas WHERE dominio = 'globaldata.pt' LIMIT 1;

        -- MEDIA MARKT
        ELSEIF NEW.Link LIKE '%mediamarkt.pt%' THEN
            SELECT id INTO loja_id FROM lojas WHERE dominio = 'mediamarkt.pt' LIMIT 1;

        -- RADIO POPULAR
        ELSEIF NEW.Link LIKE '%radiopopular.pt%' THEN
            SELECT id INTO loja_id FROM lojas WHERE dominio = 'radiopopular.pt' LIMIT 1;

        -- IKEA
        ELSEIF NEW.Link LIKE '%ikea.pt%' THEN
            SELECT id INTO loja_id FROM lojas WHERE dominio = 'ikea.pt' LIMIT 1;

        -- ZARA
        ELSEIF NEW.Link LIKE '%zara.com%' THEN
            SELECT id INTO loja_id FROM lojas WHERE dominio = 'zara.com' LIMIT 1;

        -- H&M
        ELSEIF NEW.Link LIKE '%hm.com%' THEN
            SELECT id INTO loja_id FROM lojas WHERE dominio = 'hm.com' LIMIT 1;

        ELSE
            SET loja_id = NULL;
        END IF;

        -- Define o novo valor antes da atualização
        SET NEW.LojaId = loja_id;

    END IF;
END
$$
DELIMITER ;

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
-- Estrutura para tabela `status_componentes`
--

CREATE TABLE `status_componentes` (
  `Id` int(10) UNSIGNED NOT NULL,
  `Nome` varchar(100) NOT NULL,
  `Estado` enum('Operacional','Manutenção','Degradado','Inativo') DEFAULT 'Operacional',
  `Uptime` decimal(5,2) DEFAULT 100.00,
  `LatenciaMedia` int(11) DEFAULT NULL,
  `UltimaVerificacao` datetime DEFAULT current_timestamp(),
  `Notas` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `status_componentes`
--

INSERT INTO `status_componentes` (`Id`, `Nome`, `Estado`, `Uptime`, `LatenciaMedia`, `UltimaVerificacao`, `Notas`) VALUES
(1, 'API Principal', 'Operacional', 99.90, 45, '2025-10-08 17:26:34', NULL),
(2, 'Monitorização de Preços', 'Operacional', 99.70, 52, '2025-10-08 17:26:34', NULL),
(3, 'Sistema de Notificações', 'Operacional', 99.80, 35, '2025-10-08 17:26:34', NULL),
(4, 'Base de Dados', 'Operacional', 99.95, 40, '2025-10-08 17:26:34', NULL),
(5, 'Autenticação', 'Operacional', 99.80, 12, '2025-10-08 17:26:34', NULL),
(6, 'Pagamentos', 'Operacional', 99.10, 55, '2025-10-08 17:26:34', NULL);

-- --------------------------------------------------------

--
-- Estrutura para tabela `stripe_subscriptions`
--

CREATE TABLE `stripe_subscriptions` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `customer_id` varchar(255) NOT NULL,
  `subscription_id` varchar(255) NOT NULL,
  `subscription_status` varchar(50) NOT NULL DEFAULT 'active',
  `price_id` varchar(255) DEFAULT NULL,
  `plan_name` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` enum('active','canceled','past_due','unpaid') DEFAULT 'active',
  `grace_period_end` timestamp NULL DEFAULT NULL,
  `cancellation_reason` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `stripe_subscriptions`
--

INSERT INTO `stripe_subscriptions` (`id`, `user_id`, `customer_id`, `subscription_id`, `subscription_status`, `price_id`, `plan_name`, `created_at`, `updated_at`, `status`, `grace_period_end`, `cancellation_reason`) VALUES
(3, 5, 'cus_test_5', 'sub_test_5', 'canceled', 'price_test_standard', 'Standard', '2025-10-20 21:20:48', '2025-10-20 21:24:02', 'canceled', '2025-11-19 22:24:02', 'test_cancellation'),
(4, 6, 'cus_test_6', 'sub_test_6', 'canceled', 'price_test_premium', 'Premium', '2025-10-20 21:20:48', '2025-10-20 21:24:02', 'canceled', '2025-11-19 22:24:02', 'test_cancellation'),
(8, 16, 'cus_16', 'sub_16', 'canceled', 'price_16', 'Basic', '2025-10-20 21:24:02', '2025-10-20 21:24:02', 'canceled', '2025-11-19 22:24:02', 'test_cancellation'),
(9, 17, 'cus_17', 'sub_17', 'canceled', 'price_17', 'Basic', '2025-10-20 21:24:02', '2025-10-20 21:24:02', 'canceled', '2025-11-19 22:24:02', 'test_cancellation'),
(10, 18, 'cus_18', 'sub_18', 'canceled', 'price_18', 'Basic', '2025-10-20 21:24:02', '2025-10-20 21:24:02', 'canceled', '2025-11-19 22:24:02', 'test_cancellation'),
(13, 5, 'cus_standard_5', 'sub_standard_5', 'active', 'price_standard', 'Standard', '2025-10-20 22:24:27', '2025-10-20 22:24:27', 'active', NULL, NULL),
(14, 6, 'cus_premium_6', 'sub_premium_6', 'active', 'price_premium', 'Premium', '2025-10-20 22:24:27', '2025-10-20 22:24:27', 'active', NULL, NULL),
(16, 4, 'cus_basic_4', 'sub_basic_4', 'expired', 'price_basic', 'Basic', '2025-10-20 22:34:02', '2025-10-20 22:43:29', '', '2025-10-19 22:43:29', 'user_cancellation');

-- --------------------------------------------------------

--
-- Estrutura para tabela `supportmessages`
--

CREATE TABLE `supportmessages` (
  `id` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `message` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT current_timestamp(),
  `senderType` enum('user','support') DEFAULT 'user',
  `replyTo` int(11) DEFAULT NULL,
  `threadId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Despejando dados para a tabela `supportmessages`
--

INSERT INTO `supportmessages` (`id`, `userId`, `message`, `createdAt`, `senderType`, `replyTo`, `threadId`) VALUES
(1, 5, 'a', '2025-10-30 21:57:40', 'user', NULL, NULL),
(2, 5, 'Vai haver testes?', '2025-10-30 22:08:07', 'user', 1, 1),
(3, 5, 'Suporte?', '2025-10-30 22:08:18', 'user', 2, 1),
(4, 5, 'sim', '2025-10-30 22:11:12', 'support', 3, 1),
(5, 5, 'A atualizacoes constantes no github!', '2025-10-30 22:24:50', 'support', 4, 1),
(6, 5, 'Outra atualizacao disponivel!', '2025-10-30 23:50:13', 'support', 5, 1);

-- --------------------------------------------------------

--
-- Estrutura para tabela `utilizadores`
--

CREATE TABLE `utilizadores` (
  `Id` int(10) UNSIGNED NOT NULL,
  `Nome` varchar(100) NOT NULL,
  `Email` varchar(150) NOT NULL,
  `SenhaHash` varchar(255) NOT NULL,
  `Telefone` varchar(20) DEFAULT NULL,
  `CodigoTelefone` varchar(10) DEFAULT NULL,
  `Ativo` tinyint(1) NOT NULL DEFAULT 1,
  `Data_Registo` datetime NOT NULL DEFAULT current_timestamp(),
  `PerfilId` int(10) UNSIGNED NOT NULL DEFAULT 2,
  `EmailVerificado` tinyint(1) DEFAULT 0,
  `CodigoEmail` varchar(6) DEFAULT NULL,
  `ultimo_login` timestamp NULL DEFAULT NULL,
  `dinheiro_poupado` decimal(10,2) DEFAULT 0.00,
  `discord_id` varchar(50) DEFAULT NULL,
  `FotoPerfil` varchar(500) DEFAULT NULL COMMENT 'URL da foto de perfil do usuário (GitHub, Google, etc.)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Despejando dados para a tabela `utilizadores`
--

INSERT INTO `utilizadores` (`Id`, `Nome`, `Email`, `SenhaHash`, `Telefone`, `CodigoTelefone`, `Ativo`, `Data_Registo`, `PerfilId`, `EmailVerificado`, `CodigoEmail`, `ultimo_login`, `dinheiro_poupado`, `discord_id`, `FotoPerfil`) VALUES
(4, 'julia_admin', 'julia.admin@gmail.com', '$2a$11$EBuekNdjZ6.8BSB4nOXdKOD/ezP1flxjPejPZ1CHHE7.d/D5/xN6q', NULL, NULL, 1, '2025-09-30 15:26:07', 1, 1, NULL, NULL, 0.00, NULL, NULL),
(5, 'Julia Rebouças', 'juliareboucasleite@gmail.com', '$2b$10$8S7l1v4v0iiLr52noJBnE.cfy01PyiNH..A8jQ/U6gyFnBqJ6bYoi', '', NULL, 1, '2025-09-30 19:19:05', 1, 1, '137468', NULL, 0.00, NULL, NULL),
(6, 'Gustavo Mateus', 'gustavovyski@gmail.com', '$2b$10$ULwfdij7cBcAWCDbsWahcu2ESPzpSk8mDjFl7bdN8DDXruZoj7Uki', '933992199', NULL, 1, '2025-09-30 19:21:30', 2, 1, NULL, NULL, 0.00, NULL, NULL),
(16, 'professor1', 'professor1@exemple.com', '$2a$11$AML2/kWSYcJXmPlQoi15ueElz8FgVjpbrk7y.O/AktehJTcPbyuXy', NULL, NULL, 1, '2025-10-09 21:23:15', 1, 0, NULL, NULL, 0.00, NULL, NULL),
(17, 'professor2', 'professor2@example.com', '$2a$11$A24Ry.zamf6Iym5gFtNFoOhJi4//e9YZTs2G.cAQ7.tpmz6q6rmbC', NULL, NULL, 1, '2025-10-09 21:38:12', 1, 0, NULL, NULL, 0.00, NULL, NULL),
(18, 'Luncks', 'luncks@exemple.com', '$2a$11$jQ.M2K6Oou8PuKH/wyA9Dec8ZRaMyQMu34tGZ/EdsMWp3HBWMtNTu', '', NULL, 1, '2025-10-09 22:01:53', 2, 1, '0', NULL, 0.00, NULL, NULL),
(20, 'Alexandre Smigon', 'alexandre.smigon@gmail.com', '$2b$10$aRN3hTwjpB9WJspXGpKSj.I51GO7u3I.1le1FLZyiMSMp4yJi7Vge', NULL, NULL, 1, '2025-10-21 17:50:15', 2, 0, NULL, NULL, 0.00, NULL, NULL),
(22, 'leeksxy', 'julia.exemple@gmail.com', '$2b$10$c7v5LG56Ds3Lmr0nlxqTteXAd7P7c8ORrdN5BsX6cA7SSGSo6fh22', NULL, NULL, 1, '2025-10-29 00:06:08', 1, 0, NULL, '2025-10-29 00:17:54', 0.00, '916737425978589235', NULL);

-- --------------------------------------------------------

--
-- Estrutura stand-in para view `vw_produtos_lojas`
-- (Veja abaixo para a visão atual)
--
CREATE TABLE `vw_produtos_lojas` (
`ProdutoId` int(10) unsigned
,`UserId` int(10) unsigned
,`ProdutoNome` varchar(150)
,`Link` varchar(500)
,`PrecoAtual` decimal(10,2)
,`PrecoAlvo` decimal(10,2)
,`DataLimite` date
,`DataCriacao` timestamp
,`UpdatedAt` timestamp
,`Shipping` varchar(100)
,`DeletedAt` timestamp
,`LojaId` int(11)
,`LojaNome` varchar(100)
,`LojaDominio` varchar(255)
,`LojaSelector` varchar(500)
);

-- --------------------------------------------------------

--
-- Estrutura para view `vw_produtos_lojas`
--
DROP TABLE IF EXISTS `vw_produtos_lojas`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vw_produtos_lojas`  AS SELECT `p`.`Id` AS `ProdutoId`, `p`.`UserId` AS `UserId`, `p`.`Nome` AS `ProdutoNome`, `p`.`Link` AS `Link`, `p`.`PrecoAtual` AS `PrecoAtual`, `p`.`PrecoAlvo` AS `PrecoAlvo`, `p`.`DataLimite` AS `DataLimite`, `p`.`DataCriacao` AS `DataCriacao`, `p`.`UpdatedAt` AS `UpdatedAt`, `p`.`Shipping` AS `Shipping`, `p`.`DeletedAt` AS `DeletedAt`, `l`.`id` AS `LojaId`, `l`.`nome` AS `LojaNome`, `l`.`dominio` AS `LojaDominio`, `l`.`css_selector_preco` AS `LojaSelector` FROM (`produtos` `p` left join `lojas` `l` on(`p`.`LojaId` = `l`.`id`)) ;

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
  ADD KEY `UserId` (`UserId`),
  ADD KEY `PlanoAtualId` (`PlanoAtualId`),
  ADD KEY `PlanoAtivoId` (`PlanoAtivoId`);

--
-- Índices de tabela `contasconectadas`
--
ALTER TABLE `contasconectadas`
  ADD PRIMARY KEY (`Id`),
  ADD UNIQUE KEY `unique_user_tipo` (`UserId`,`Tipo`);

--
-- Índices de tabela `historicoprecos`
--
ALTER TABLE `historicoprecos`
  ADD PRIMARY KEY (`Id`),
  ADD KEY `idx_historico_produto` (`ProdutoId`);

--
-- Índices de tabela `incidentes`
--
ALTER TABLE `incidentes`
  ADD PRIMARY KEY (`Id`),
  ADD KEY `ComponenteId` (`ComponenteId`);

--
-- Índices de tabela `lojas`
--
ALTER TABLE `lojas`
  ADD PRIMARY KEY (`id`);

--
-- Índices de tabela `metricas_sistema`
--
ALTER TABLE `metricas_sistema`
  ADD PRIMARY KEY (`Id`);

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
-- Índices de tabela `planos`
--
ALTER TABLE `planos`
  ADD PRIMARY KEY (`Id`);

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
  ADD KEY `UserId` (`UserId`),
  ADD KEY `fk_produtos_lojas_1` (`LojaId`);

--
-- Índices de tabela `recuperar_senha`
--
ALTER TABLE `recuperar_senha`
  ADD PRIMARY KEY (`Id`),
  ADD KEY `UserId` (`UserId`);

--
-- Índices de tabela `status_componentes`
--
ALTER TABLE `status_componentes`
  ADD PRIMARY KEY (`Id`);

--
-- Índices de tabela `stripe_subscriptions`
--
ALTER TABLE `stripe_subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_active_user` (`user_id`,`status`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_customer_id` (`customer_id`),
  ADD KEY `idx_subscription_id` (`subscription_id`),
  ADD KEY `idx_status` (`status`);

--
-- Índices de tabela `supportmessages`
--
ALTER TABLE `supportmessages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_replyTo` (`replyTo`),
  ADD KEY `idx_threadId` (`threadId`);

--
-- Índices de tabela `utilizadores`
--
ALTER TABLE `utilizadores`
  ADD PRIMARY KEY (`Id`),
  ADD UNIQUE KEY `Email` (`Email`),
  ADD UNIQUE KEY `discord_id` (`discord_id`),
  ADD KEY `idx_PerfilId` (`PerfilId`);

--
-- AUTO_INCREMENT para tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `configutilizador`
--
ALTER TABLE `configutilizador`
  MODIFY `Id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de tabela `contasconectadas`
--
ALTER TABLE `contasconectadas`
  MODIFY `Id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de tabela `historicoprecos`
--
ALTER TABLE `historicoprecos`
  MODIFY `Id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=178;

--
-- AUTO_INCREMENT de tabela `incidentes`
--
ALTER TABLE `incidentes`
  MODIFY `Id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de tabela `lojas`
--
ALTER TABLE `lojas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT de tabela `metricas_sistema`
--
ALTER TABLE `metricas_sistema`
  MODIFY `Id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de tabela `notificacoes`
--
ALTER TABLE `notificacoes`
  MODIFY `Id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

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
-- AUTO_INCREMENT de tabela `planos`
--
ALTER TABLE `planos`
  MODIFY `Id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de tabela `preferenciasnotificacao`
--
ALTER TABLE `preferenciasnotificacao`
  MODIFY `Id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=132;

--
-- AUTO_INCREMENT de tabela `produtos`
--
ALTER TABLE `produtos`
  MODIFY `Id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=61;

--
-- AUTO_INCREMENT de tabela `recuperar_senha`
--
ALTER TABLE `recuperar_senha`
  MODIFY `Id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de tabela `status_componentes`
--
ALTER TABLE `status_componentes`
  MODIFY `Id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de tabela `stripe_subscriptions`
--
ALTER TABLE `stripe_subscriptions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT de tabela `supportmessages`
--
ALTER TABLE `supportmessages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de tabela `utilizadores`
--
ALTER TABLE `utilizadores`
  MODIFY `Id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- Restrições para tabelas despejadas
--

--
-- Restrições para tabelas `configutilizador`
--
ALTER TABLE `configutilizador`
  ADD CONSTRAINT `configutilizador_ibfk_1` FOREIGN KEY (`UserId`) REFERENCES `utilizadores` (`Id`) ON DELETE CASCADE,
  ADD CONSTRAINT `configutilizador_ibfk_2` FOREIGN KEY (`PlanoAtualId`) REFERENCES `planos` (`Id`),
  ADD CONSTRAINT `configutilizador_ibfk_3` FOREIGN KEY (`PlanoAtivoId`) REFERENCES `planos` (`Id`);

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
-- Restrições para tabelas `incidentes`
--
ALTER TABLE `incidentes`
  ADD CONSTRAINT `incidentes_ibfk_1` FOREIGN KEY (`ComponenteId`) REFERENCES `status_componentes` (`Id`) ON DELETE SET NULL;

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
  ADD CONSTRAINT `fk_produtos_lojas` FOREIGN KEY (`LojaId`) REFERENCES `lojas` (`id`),
  ADD CONSTRAINT `fk_produtos_lojas_1` FOREIGN KEY (`LojaId`) REFERENCES `lojas` (`id`),
  ADD CONSTRAINT `produtos_ibfk_1` FOREIGN KEY (`UserId`) REFERENCES `utilizadores` (`Id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `recuperar_senha`
--
ALTER TABLE `recuperar_senha`
  ADD CONSTRAINT `recuperar_senha_ibfk_1` FOREIGN KEY (`UserId`) REFERENCES `utilizadores` (`Id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `supportmessages`
--
ALTER TABLE `supportmessages`
  ADD CONSTRAINT `fk_replyTo` FOREIGN KEY (`replyTo`) REFERENCES `supportmessages` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_threadId` FOREIGN KEY (`threadId`) REFERENCES `supportmessages` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `utilizadores`
--
ALTER TABLE `utilizadores`
  ADD CONSTRAINT `fk_utilizadores_perfis_final` FOREIGN KEY (`PerfilId`) REFERENCES `perfis` (`Id`) ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
