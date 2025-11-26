-- Tabela para tokens de reset de senha (estilo Pinterest)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    UserId INT NOT NULL,
    Token VARCHAR(255) NOT NULL UNIQUE,
    Email VARCHAR(255) NOT NULL,
    ExpiresAt TIMESTAMP NOT NULL,
    Used BOOLEAN DEFAULT FALSE,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_token (Token),
    INDEX idx_user_id (UserId),
    INDEX idx_email (Email),
    INDEX idx_expires_at (ExpiresAt),
    FOREIGN KEY (UserId) REFERENCES Utilizadores(Id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

