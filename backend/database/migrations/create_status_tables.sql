-- ================== TABELAS PARA SISTEMA DE STATUS ==================

-- Tabela para métricas do sistema
CREATE TABLE IF NOT EXISTS metricas_sistema (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    UptimeGeral DECIMAL(5,2) DEFAULT 99.9,
    TempoRespostaMedia INT DEFAULT 45,
    UtilizadoresAtivos INT DEFAULT 0,
    ProdutosMonitorizados INT DEFAULT 0,
    NotificacoesEnviadas INT DEFAULT 0,
    DataAtualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_data_atualizacao (DataAtualizacao)
);

-- Tabela para componentes do sistema
CREATE TABLE IF NOT EXISTS status_componentes (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    Nome VARCHAR(100) NOT NULL,
    Status ENUM('operational', 'degraded', 'outage') DEFAULT 'operational',
    Uptime DECIMAL(5,2) DEFAULT 99.9,
    Latencia INT DEFAULT 0,
    UltimaVerificacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Detalhes JSON,
    Notas TEXT,
    INDEX idx_status (Status),
    INDEX idx_ultima_verificacao (UltimaVerificacao)
);

-- Tabela para incidentes
CREATE TABLE IF NOT EXISTS incidentes (
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
);

-- ================== DADOS INICIAIS ==================

-- Inserir métricas iniciais
INSERT INTO metricas_sistema (UptimeGeral, TempoRespostaMedia, UtilizadoresAtivos, ProdutosMonitorizados, NotificacoesEnviadas) 
VALUES (99.9, 45, 0, 0, 0);

-- Inserir componentes do sistema
INSERT INTO status_componentes (Nome, Status, Uptime, Latencia, Detalhes) VALUES
('API Principal', 'operational', 99.9, 45, '{"descricao": "API principal do PromoPing", "versao": "1.0.0"}'),
('Monitoramento de Preços', 'operational', 99.7, 120, '{"descricao": "Sistema de monitoramento de preços", "frequencia": "6h"}'),
('Sistema de Notificações', 'operational', 99.8, 30, '{"descricao": "Sistema de envio de notificações", "canais": ["email", "whatsapp", "discord"]}'),
('Banco de Dados', 'operational', 99.95, 5, '{"descricao": "Base de dados MySQL", "tipo": "MySQL 8.0"}'),
('Autenticação', 'operational', 99.8, 12, '{"descricao": "Sistema de autenticação JWT", "provedores": ["google", "email"]}'),
('Sistema de Pagamentos', 'operational', 99.1, 200, '{"descricao": "Integração com Stripe", "moedas": ["EUR", "USD"]}');

-- Inserir incidentes de exemplo
INSERT INTO incidentes (Titulo, Descricao, DataInicio, DataFim, Duracao, Impacto, Status, ComponenteAfetado) VALUES
('Manutenção Programada - API', 'Atualização de segurança e otimizações de performance', '2024-01-12 14:00:00', '2024-01-12 14:15:00', '15 minutos', 'Interrupção temporária da API', 'resolved', 'API Principal'),
('Problema de Latência - Notificações', 'Aumento na latência do sistema de notificações por email', '2024-01-08 09:30:00', '2024-01-08 11:30:00', '2 horas', 'Atraso nas notificações por email', 'resolved', 'Sistema de Notificações'),
('Atualização de Segurança', 'Aplicação de patches de segurança críticos', '2024-01-03 16:00:00', '2024-01-03 16:30:00', '30 minutos', 'Reinicialização dos serviços', 'resolved', 'Sistema Geral');

-- ================== VIEWS ÚTEIS ==================

-- View para status geral do sistema
CREATE OR REPLACE VIEW v_status_geral AS
SELECT 
    ms.UptimeGeral,
    ms.TempoRespostaMedia,
    ms.UtilizadoresAtivos,
    ms.ProdutosMonitorizados,
    ms.NotificacoesEnviadas,
    ms.DataAtualizacao,
    COUNT(sc.Id) as TotalComponentes,
    COUNT(CASE WHEN sc.Status = 'operational' THEN 1 END) as ComponentesOperacionais,
    COUNT(CASE WHEN sc.Status = 'degraded' THEN 1 END) as ComponentesDegradados,
    COUNT(CASE WHEN sc.Status = 'outage' THEN 1 END) as ComponentesFora
FROM metricas_sistema ms
CROSS JOIN status_componentes sc
WHERE ms.Id = (SELECT MAX(Id) FROM metricas_sistema)
GROUP BY ms.Id;

-- View para incidentes ativos
CREATE OR REPLACE VIEW v_incidentes_ativos AS
SELECT 
    Id,
    Titulo,
    Descricao,
    DataInicio,
    DataFim,
    Duracao,
    Impacto,
    Status,
    ComponenteAfetado,
    TIMESTAMPDIFF(MINUTE, DataInicio, COALESCE(DataFim, NOW())) as DuracaoMinutos
FROM incidentes
WHERE Status IN ('investigating', 'identified', 'monitoring')
ORDER BY DataInicio DESC;

-- ================== PROCEDURES ÚTEIS ==================

DELIMITER //

-- Procedure para atualizar métricas do sistema
CREATE PROCEDURE sp_atualizar_metricas(
    IN p_uptime DECIMAL(5,2),
    IN p_resposta INT,
    IN p_ativos INT,
    IN p_produtos INT,
    IN p_notificacoes INT
)
BEGIN
    INSERT INTO metricas_sistema (UptimeGeral, TempoRespostaMedia, UtilizadoresAtivos, ProdutosMonitorizados, NotificacoesEnviadas)
    VALUES (p_uptime, p_resposta, p_ativos, p_produtos, p_notificacoes);
    
    SELECT 'Métricas atualizadas com sucesso' as Resultado;
END //

-- Procedure para criar novo incidente
CREATE PROCEDURE sp_criar_incidente(
    IN p_titulo VARCHAR(200),
    IN p_descricao TEXT,
    IN p_impacto TEXT,
    IN p_componente VARCHAR(100)
)
BEGIN
    INSERT INTO incidentes (Titulo, Descricao, DataInicio, Impacto, Status, ComponenteAfetado)
    VALUES (p_titulo, p_descricao, NOW(), p_impacto, 'investigating', p_componente);
    
    SELECT LAST_INSERT_ID() as IncidenteId, 'Incidente criado com sucesso' as Resultado;
END //

-- Procedure para resolver incidente
CREATE PROCEDURE sp_resolver_incidente(
    IN p_incidente_id INT,
    IN p_duracao VARCHAR(50)
)
BEGIN
    UPDATE incidentes 
    SET Status = 'resolved', 
        DataFim = NOW(), 
        Duracao = p_duracao,
        DataAtualizacao = NOW()
    WHERE Id = p_incidente_id;
    
    SELECT 'Incidente resolvido com sucesso' as Resultado;
END //

DELIMITER ;

-- ================== TRIGGERS ==================

-- Trigger para atualizar timestamp de componentes
DELIMITER //
CREATE TRIGGER tr_componentes_verificacao
BEFORE UPDATE ON status_componentes
FOR EACH ROW
BEGIN
    SET NEW.UltimaVerificacao = NOW();
END //
DELIMITER ;

-- ================== ÍNDICES ADICIONAIS ==================

-- Índices para performance
CREATE INDEX idx_metricas_data ON metricas_sistema(DataAtualizacao);
CREATE INDEX idx_componentes_nome ON status_componentes(Nome);
CREATE INDEX idx_incidentes_componente_status ON incidentes(ComponenteAfetado, Status);
CREATE INDEX idx_incidentes_data_status ON incidentes(DataInicio, Status);

-- ================== COMENTÁRIOS ==================

-- Comentários nas tabelas
ALTER TABLE metricas_sistema COMMENT = 'Métricas gerais do sistema PromoPing';
ALTER TABLE status_componentes COMMENT = 'Status dos componentes do sistema';
ALTER TABLE incidentes COMMENT = 'Registro de incidentes e manutenções';

-- Comentários nas colunas principais
ALTER TABLE metricas_sistema MODIFY COLUMN UptimeGeral DECIMAL(5,2) COMMENT 'Uptime geral do sistema em %';
ALTER TABLE metricas_sistema MODIFY COLUMN TempoRespostaMedia INT COMMENT 'Tempo médio de resposta em ms';
ALTER TABLE status_componentes MODIFY COLUMN Status ENUM('operational', 'degraded', 'outage') COMMENT 'Status atual do componente';
ALTER TABLE incidentes MODIFY COLUMN Status ENUM('investigating', 'identified', 'monitoring', 'resolved') COMMENT 'Status atual do incidente';
