<?php
/**
 * API Endpoint: Atualizações
 * Gerencia atualizações do sistema
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config.php';

$conn = getDBConnection();

if (!$conn) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Erro de conexão com a base de dados'
    ]);
    exit;
}

try {
    $method = $_SERVER['REQUEST_METHOD'];
    
    // Extrair ID da URL se existir
    // Tentar várias formas de obter o ID
    $updateId = null;
    
    // Opção 1: PATH_INFO (se configurado)
    if (isset($_SERVER['PATH_INFO']) && preg_match('/\/(\d+)$/', $_SERVER['PATH_INFO'], $matches)) {
        $updateId = (int)$matches[1];
    }
    // Opção 2: Query string
    elseif (isset($_GET['id'])) {
        $updateId = (int)$_GET['id'];
    }
    // Opção 3: URL completa parseada
    else {
        $requestUri = $_SERVER['REQUEST_URI'] ?? '';
        if (preg_match('/atualizacoes\/(\d+)/', $requestUri, $matches)) {
            $updateId = (int)$matches[1];
        }
    }
    
    if ($method === 'GET') {
        if ($updateId) {
            // Buscar uma atualização específica
            $stmt = $conn->prepare("SELECT * FROM atualizacoes WHERE Id = ?");
            $stmt->bind_param("i", $updateId);
            $stmt->execute();
            $result = $stmt->get_result();
            $atualizacao = $result->fetch_assoc();
            
            if (!$atualizacao) {
                http_response_code(404);
                echo json_encode([
                    'status' => 'error',
                    'message' => 'Atualização não encontrada'
                ]);
                exit;
            }
            
            echo json_encode([
                'status' => 'ok',
                'atualizacao' => $atualizacao
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        } else {
            // Verificar se a tabela existe, criar se não existir
            $checkTable = $conn->query("SHOW TABLES LIKE 'atualizacoes'");
            if ($checkTable->num_rows == 0) {
                // Criar tabela atualizacoes
                $conn->query("
                    CREATE TABLE IF NOT EXISTS atualizacoes (
                        Id INT AUTO_INCREMENT PRIMARY KEY,
                        Titulo VARCHAR(200) NOT NULL,
                        Descricao TEXT NOT NULL,
                        Tipo ENUM('Melhoria', 'Correção', 'Nova Funcionalidade', 'Manutenção') DEFAULT 'Melhoria',
                        DataPublicacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        Status ENUM('Implementado', 'Em Desenvolvimento', 'Planeado') DEFAULT 'Implementado',
                        DataCriacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        DataAtualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        INDEX idx_data_publicacao (DataPublicacao),
                        INDEX idx_tipo (Tipo),
                        INDEX idx_status (Status)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
            }
            
            // Listar todas as atualizações
            $stmt = $conn->prepare("SELECT * FROM atualizacoes ORDER BY DataPublicacao DESC");
            $stmt->execute();
            $result = $stmt->get_result();
            
            $atualizacoes = [];
            while ($row = $result->fetch_assoc()) {
                // Normalizar nomes de colunas
                $atualizacao = [
                    'Id' => $row['Id'] ?? null,
                    'Titulo' => $row['Titulo'] ?? '',
                    'Descricao' => $row['Descricao'] ?? '',
                    'Tipo' => $row['Tipo'] ?? 'Melhoria',
                    'DataPublicacao' => $row['DataPublicacao'] ?? null,
                    'Status' => $row['Status'] ?? 'Implementado'
                ];
                $atualizacoes[] = $atualizacao;
            }
            
            echo json_encode([
                'status' => 'ok',
                'atualizacoes' => $atualizacoes
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }
    } elseif ($method === 'POST') {
        // Criar nova atualização
        $data = json_decode(file_get_contents('php://input'), true);
        
        $titulo = $data['titulo'] ?? $data['Titulo'] ?? '';
        $descricao = $data['descricao'] ?? $data['Descricao'] ?? '';
        $tipo = $data['tipo'] ?? $data['Tipo'] ?? 'Melhoria';
        $dataPublicacao = $data['dataPublicacao'] ?? $data['DataPublicacao'] ?? date('Y-m-d H:i:s');
        
        if (empty($titulo) || empty($descricao)) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'Título e descrição são obrigatórios'
            ]);
            exit;
        }
        
        $stmt = $conn->prepare("INSERT INTO atualizacoes (Titulo, Descricao, Tipo, DataPublicacao) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("ssss", $titulo, $descricao, $tipo, $dataPublicacao);
        
        if ($stmt->execute()) {
            $newId = $conn->insert_id;
            echo json_encode([
                'status' => 'ok',
                'message' => 'Atualização criada com sucesso',
                'id' => $newId
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        } else {
            throw new Exception('Erro ao criar atualização');
        }
    } elseif ($method === 'PUT' && $updateId) {
        // Atualizar atualização
        $data = json_decode(file_get_contents('php://input'), true);
        
        $titulo = $data['Titulo'] ?? $data['titulo'] ?? null;
        $descricao = $data['Descricao'] ?? $data['descricao'] ?? null;
        $tipo = $data['Tipo'] ?? $data['tipo'] ?? null;
        $dataPublicacao = $data['DataPublicacao'] ?? $data['dataPublicacao'] ?? null;
        
        $updates = [];
        $params = [];
        $types = '';
        
        if ($titulo !== null) { $updates[] = "Titulo = ?"; $params[] = $titulo; $types .= 's'; }
        if ($descricao !== null) { $updates[] = "Descricao = ?"; $params[] = $descricao; $types .= 's'; }
        if ($tipo !== null) { $updates[] = "Tipo = ?"; $params[] = $tipo; $types .= 's'; }
        if ($dataPublicacao !== null) { $updates[] = "DataPublicacao = ?"; $params[] = $dataPublicacao; $types .= 's'; }
        
        if (empty($updates)) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'Nenhum campo para atualizar'
            ]);
            exit;
        }
        
        $params[] = $updateId;
        $types .= 'i';
        
        $sql = "UPDATE atualizacoes SET " . implode(', ', $updates) . " WHERE Id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);
        
        if ($stmt->execute()) {
            echo json_encode([
                'status' => 'ok',
                'message' => 'Atualização atualizada com sucesso'
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        } else {
            throw new Exception('Erro ao atualizar atualização');
        }
    } elseif ($method === 'DELETE' && $updateId) {
        // Deletar atualização
        $stmt = $conn->prepare("DELETE FROM atualizacoes WHERE Id = ?");
        $stmt->bind_param("i", $updateId);
        
        if ($stmt->execute()) {
            echo json_encode([
                'status' => 'ok',
                'message' => 'Atualização deletada com sucesso'
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        } else {
            throw new Exception('Erro ao deletar atualização');
        }
    } else {
        http_response_code(405);
        echo json_encode([
            'status' => 'error',
            'message' => 'Método não permitido'
        ]);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Erro: ' . $e->getMessage()
    ]);
}

$conn->close();

