-- ================== CRIAÇÃO DA TABELA DE HISTÓRICO DE PREÇOS ==================

-- Tabela para armazenar histórico de preços dos produtos
CREATE TABLE IF NOT EXISTS historico_precos (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    ProdutoId INT NOT NULL,
    Preco DECIMAL(10, 2) NOT NULL,
    Data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Loja VARCHAR(255),
    Status ENUM('Ativo', 'Inativo', 'Pausado') DEFAULT 'Ativo',
    Observacoes TEXT,
    INDEX idx_produto_data (ProdutoId, Data),
    INDEX idx_data (Data),
    INDEX idx_loja (Loja),
    FOREIGN KEY (ProdutoId) REFERENCES produtos(Id) ON DELETE CASCADE
);

-- Inserir dados de exemplo para teste
INSERT INTO historico_precos (ProdutoId, Preco, Data, Loja, Status, Observacoes) VALUES
-- Produto 1 - iPhone 15 Pro
(1, 1199.99, '2024-01-15 10:00:00', 'Apple Store', 'Ativo', 'Preço inicial'),
(1, 1149.99, '2024-01-20 14:30:00', 'Apple Store', 'Ativo', 'Promoção de lançamento'),
(1, 1099.99, '2024-02-01 09:15:00', 'Apple Store', 'Ativo', 'Desconto de fevereiro'),
(1, 1199.99, '2024-02-15 16:45:00', 'Apple Store', 'Ativo', 'Preço normal restaurado'),
(1, 1049.99, '2024-03-01 11:20:00', 'Apple Store', 'Ativo', 'Promoção de março'),

-- Produto 2 - MacBook Air M3
(2, 1299.99, '2024-01-10 08:00:00', 'Apple Store', 'Ativo', 'Preço inicial'),
(2, 1249.99, '2024-01-25 13:45:00', 'Apple Store', 'Ativo', 'Desconto estudante'),
(2, 1199.99, '2024-02-10 10:30:00', 'Apple Store', 'Ativo', 'Promoção de fevereiro'),
(2, 1149.99, '2024-02-28 15:20:00', 'Apple Store', 'Ativo', 'Fim de mês'),
(2, 1299.99, '2024-03-05 12:10:00', 'Apple Store', 'Ativo', 'Preço normal'),

-- Produto 3 - AirPods Pro
(3, 279.99, '2024-01-05 09:30:00', 'Apple Store', 'Ativo', 'Preço inicial'),
(3, 249.99, '2024-01-18 14:15:00', 'Apple Store', 'Ativo', 'Promoção'),
(3, 229.99, '2024-02-05 11:45:00', 'Apple Store', 'Ativo', 'Desconto de fevereiro'),
(3, 259.99, '2024-02-20 16:30:00', 'Apple Store', 'Ativo', 'Preço intermediário'),
(3, 279.99, '2024-03-01 08:20:00', 'Apple Store', 'Ativo', 'Preço normal'),

-- Produto 4 - iPad Air
(4, 599.99, '2024-01-12 10:45:00', 'Apple Store', 'Ativo', 'Preço inicial'),
(4, 549.99, '2024-01-28 15:30:00', 'Apple Store', 'Ativo', 'Desconto'),
(4, 519.99, '2024-02-12 12:15:00', 'Apple Store', 'Ativo', 'Promoção de fevereiro'),
(4, 579.99, '2024-02-25 14:40:00', 'Apple Store', 'Ativo', 'Preço intermediário'),
(4, 599.99, '2024-03-03 09:50:00', 'Apple Store', 'Ativo', 'Preço normal'),

-- Produto 5 - Apple Watch Series 9
(5, 429.99, '2024-01-08 11:20:00', 'Apple Store', 'Ativo', 'Preço inicial'),
(5, 399.99, '2024-01-22 13:35:00', 'Apple Store', 'Ativo', 'Promoção'),
(5, 379.99, '2024-02-08 10:50:00', 'Apple Store', 'Ativo', 'Desconto de fevereiro'),
(5, 409.99, '2024-02-22 15:25:00', 'Apple Store', 'Ativo', 'Preço intermediário'),
(5, 429.99, '2024-03-02 12:40:00', 'Apple Store', 'Ativo', 'Preço normal');

-- Criar view para facilitar consultas de histórico
CREATE OR REPLACE VIEW vw_historico_precos_detalhado AS
SELECT 
    hp.Id,
    hp.ProdutoId,
    p.Nome AS ProdutoNome,
    hp.Preco,
    hp.Data,
    hp.Loja,
    hp.Status,
    hp.Observacoes,
    DATEDIFF(NOW(), hp.Data) AS DiasAtras,
    CASE 
        WHEN DATEDIFF(NOW(), hp.Data) = 0 THEN 'Hoje'
        WHEN DATEDIFF(NOW(), hp.Data) = 1 THEN 'Ontem'
        WHEN DATEDIFF(NOW(), hp.Data) <= 7 THEN CONCAT(DATEDIFF(NOW(), hp.Data), ' dias atrás')
        WHEN DATEDIFF(NOW(), hp.Data) <= 30 THEN CONCAT(FLOOR(DATEDIFF(NOW(), hp.Data) / 7), ' semanas atrás')
        ELSE CONCAT(FLOOR(DATEDIFF(NOW(), hp.Data) / 30), ' meses atrás')
    END AS TempoRelativo
FROM historico_precos hp
JOIN produtos p ON hp.ProdutoId = p.Id
ORDER BY hp.ProdutoId, hp.Data DESC;

-- Criar view para estatísticas de preços por produto
CREATE OR REPLACE VIEW vw_estatisticas_precos AS
SELECT 
    p.Id AS ProdutoId,
    p.Nome AS ProdutoNome,
    COUNT(hp.Id) AS TotalRegistros,
    MIN(hp.Preco) AS PrecoMinimo,
    MAX(hp.Preco) AS PrecoMaximo,
    AVG(hp.Preco) AS PrecoMedio,
    p.PrecoAtual AS PrecoAtual,
    p.PrecoAlvo AS PrecoAlvo,
    CASE 
        WHEN p.PrecoAtual <= p.PrecoAlvo THEN 'Alvo Atingido'
        WHEN p.PrecoAtual <= p.PrecoAlvo * 1.1 THEN 'Próximo do Alvo'
        ELSE 'Acima do Alvo'
    END AS StatusAlvo,
    DATEDIFF(NOW(), MIN(hp.Data)) AS DiasMonitoramento
FROM produtos p
LEFT JOIN historico_precos hp ON p.Id = hp.ProdutoId
GROUP BY p.Id, p.Nome, p.PrecoAtual, p.PrecoAlvo
ORDER BY p.Nome;

-- Criar trigger para atualizar automaticamente o preço atual quando um novo registro é inserido
DELIMITER //
CREATE TRIGGER tr_atualizar_preco_atual
AFTER INSERT ON historico_precos
FOR EACH ROW
BEGIN
    UPDATE produtos 
    SET PrecoAtual = NEW.Preco,
        DataAtualizacao = NOW()
    WHERE Id = NEW.ProdutoId;
END//
DELIMITER ;

-- Criar procedure para inserir histórico de preços
DELIMITER //
CREATE PROCEDURE sp_inserir_historico_preco(
    IN p_produto_id INT,
    IN p_preco DECIMAL(10, 2),
    IN p_loja VARCHAR(255),
    IN p_observacoes TEXT
)
BEGIN
    INSERT INTO historico_precos (ProdutoId, Preco, Loja, Observacoes)
    VALUES (p_produto_id, p_preco, p_loja, p_observacoes);
    
    SELECT 'Histórico inserido com sucesso' AS Resultado;
END//
DELIMITER ;

-- Criar procedure para obter histórico de preços por produto
DELIMITER //
CREATE PROCEDURE sp_obter_historico_produto(
    IN p_produto_id INT,
    IN p_dias INT DEFAULT NULL
)
BEGIN
    IF p_dias IS NULL THEN
        SELECT * FROM vw_historico_precos_detalhado 
        WHERE ProdutoId = p_produto_id
        ORDER BY Data DESC;
    ELSE
        SELECT * FROM vw_historico_precos_detalhado 
        WHERE ProdutoId = p_produto_id 
        AND Data >= DATE_SUB(NOW(), INTERVAL p_dias DAY)
        ORDER BY Data DESC;
    END IF;
END//
DELIMITER ;

-- Criar procedure para obter estatísticas de preços
DELIMITER //
CREATE PROCEDURE sp_obter_estatisticas_precos(
    IN p_usuario_id INT DEFAULT NULL
)
BEGIN
    IF p_usuario_id IS NULL THEN
        SELECT * FROM vw_estatisticas_precos;
    ELSE
        SELECT * FROM vw_estatisticas_precos 
        WHERE ProdutoId IN (
            SELECT Id FROM produtos WHERE UserId = p_usuario_id
        );
    END IF;
END//
DELIMITER ;

-- Comentários sobre a estrutura
-- A tabela historico_precos armazena:
-- - Id: Identificador único
-- - ProdutoId: Referência ao produto
-- - Preco: Preço registrado
-- - Data: Timestamp da coleta
-- - Loja: Loja onde foi coletado o preço
-- - Status: Status do registro
-- - Observacoes: Notas adicionais

-- Índices criados para otimizar consultas:
-- - idx_produto_data: Para consultas por produto e data
-- - idx_data: Para consultas por período
-- - idx_loja: Para consultas por loja

-- Views criadas:
-- - vw_historico_precos_detalhado: Histórico com informações do produto
-- - vw_estatisticas_precos: Estatísticas de preços por produto

-- Triggers:
-- - tr_atualizar_preco_atual: Atualiza preço atual automaticamente

-- Procedures:
-- - sp_inserir_historico_preco: Insere novo registro de histórico
-- - sp_obter_historico_produto: Obtém histórico de um produto
-- - sp_obter_estatisticas_precos: Obtém estatísticas de preços
