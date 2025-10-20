-- ================== CRIAÇÃO DA TABELA STRIPE_SUBSCRIPTIONS ==================
-- Esta tabela armazena as informações das assinaturas do Stripe

CREATE TABLE IF NOT EXISTS stripe_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    customer_id VARCHAR(255) NOT NULL,
    subscription_id VARCHAR(255) NOT NULL,
    subscription_status VARCHAR(50) NOT NULL DEFAULT 'active',
    price_id VARCHAR(255),
    plan_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status ENUM('active', 'canceled', 'past_due', 'unpaid') DEFAULT 'active',
    grace_period_end TIMESTAMP NULL,
    cancellation_reason VARCHAR(255) NULL,
    
    -- Índices para melhor performance
    INDEX idx_user_id (user_id),
    INDEX idx_customer_id (customer_id),
    INDEX idx_subscription_id (subscription_id),
    INDEX idx_status (status),
    
    -- Chave estrangeira (opcional, se a tabela de usuários existir)
    -- FOREIGN KEY (user_id) REFERENCES utilizadores(Id) ON DELETE CASCADE
    
    -- Garantir que cada usuário tenha apenas uma assinatura ativa
    UNIQUE KEY unique_active_user (user_id, status)
);

-- ================== COMENTÁRIOS SOBRE OS CAMPOS ==================
-- user_id: ID do usuário no sistema
-- customer_id: ID do cliente no Stripe (cus_xxxxx)
-- subscription_id: ID da assinatura no Stripe (sub_xxxxx)
-- subscription_status: Status da assinatura (active, canceled, etc.)
-- price_id: ID do preço no Stripe (price_xxxxx)
-- plan_name: Nome do plano (Basic, Standard, Premium)
-- status: Status interno da assinatura
-- created_at: Quando foi criada
-- updated_at: Última atualização
