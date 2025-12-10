ALTER TABLE Utilizadores 
ADD COLUMN google_id VARCHAR(50) NULL 
AFTER discord_id;

-- Adicionar índice para melhorar performance nas buscas
CREATE INDEX idx_google_id ON Utilizadores(google_id);

