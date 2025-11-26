<?php
/**
 * API Endpoint: Incidentes
 * Gerencia incidentes do sistema
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
    $incidentId = null;
    
    // Opção 1: PATH_INFO (se configurado)
    if (isset($_SERVER['PATH_INFO']) && preg_match('/\/(\d+)$/', $_SERVER['PATH_INFO'], $matches)) {
        $incidentId = (int)$matches[1];
    }
    // Opção 2: Query string
    elseif (isset($_GET['id'])) {
        $incidentId = (int)$_GET['id'];
    }
    // Opção 3: URL completa parseada
    else {
        $requestUri = $_SERVER['REQUEST_URI'] ?? '';
        if (preg_match('/incidentes\/(\d+)/', $requestUri, $matches)) {
            $incidentId = (int)$matches[1];
        }
    }
    
    if ($method === 'GET') {
        if ($incidentId) {
            // Buscar um incidente específico
            $stmt = $conn->prepare("SELECT * FROM incidentes WHERE Id = ?");
            $stmt->bind_param("i", $incidentId);
            $stmt->execute();
            $result = $stmt->get_result();
            $incidente = $result->fetch_assoc();
            
            if (!$incidente) {
                http_response_code(404);
                echo json_encode([
                    'status' => 'error',
                    'message' => 'Incidente não encontrado'
                ]);
                exit;
            }
            
            echo json_encode([
                'status' => 'ok',
                'incidente' => $incidente
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        } else {
            // Verificar se a tabela existe, criar se não existir
            $checkTable = $conn->query("SHOW TABLES LIKE 'incidentes'");
            if ($checkTable->num_rows == 0) {
                // Criar tabela incidentes
                $conn->query("
                    CREATE TABLE IF NOT EXISTS incidentes (
                        Id INT AUTO_INCREMENT PRIMARY KEY,
                        Titulo VARCHAR(200) NOT NULL,
                        Descricao TEXT,
                        Estado ENUM('Ativo', 'Resolvido', 'Planeado') DEFAULT 'Resolvido',
                        Impacto VARCHAR(255) DEFAULT NULL,
                        DataInicio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        DataFim DATETIME DEFAULT NULL,
                        ComponenteId INT DEFAULT NULL,
                        INDEX idx_data_inicio (DataInicio),
                        INDEX idx_estado (Estado)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
            }
            
            // Listar todos os incidentes
            $stmt = $conn->prepare("SELECT * FROM incidentes ORDER BY DataInicio DESC");
            $stmt->execute();
            $result = $stmt->get_result();
            
            $incidentes = [];
            while ($row = $result->fetch_assoc()) {
                // Normalizar nomes de colunas
                $incidente = [
                    'Id' => $row['Id'] ?? null,
                    'Titulo' => $row['Titulo'] ?? '',
                    'Descricao' => $row['Descricao'] ?? '',
                    'Estado' => $row['Estado'] ?? $row['Status'] ?? 'Resolvido',
                    'Status' => $row['Estado'] ?? $row['Status'] ?? 'Resolvido',
                    'Impacto' => $row['Impacto'] ?? null,
                    'DataInicio' => $row['DataInicio'] ?? null,
                    'DataFim' => $row['DataFim'] ?? null,
                    'ComponenteId' => $row['ComponenteId'] ?? null
                ];
                $incidentes[] = $incidente;
            }
            
            echo json_encode([
                'status' => 'ok',
                'incidentes' => $incidentes
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }
    } elseif ($method === 'POST') {
        // Criar novo incidente
        $data = json_decode(file_get_contents('php://input'), true);
        
        $titulo = $data['titulo'] ?? $data['Titulo'] ?? '';
        $descricao = $data['descricao'] ?? $data['Descricao'] ?? '';
        $estado = $data['estado'] ?? $data['Estado'] ?? 'Ativo';
        $impacto = $data['impacto'] ?? $data['Impacto'] ?? null;
        $dataInicio = $data['dataInicio'] ?? $data['DataInicio'] ?? date('Y-m-d H:i:s');
        $dataFim = $data['dataFim'] ?? $data['DataFim'] ?? null;
        
        if (empty($titulo) || empty($descricao)) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'Título e descrição são obrigatórios'
            ]);
            exit;
        }
        
        $stmt = $conn->prepare("INSERT INTO incidentes (Titulo, Descricao, Estado, Impacto, DataInicio, DataFim) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("ssssss", $titulo, $descricao, $estado, $impacto, $dataInicio, $dataFim);
        
        if ($stmt->execute()) {
            $newId = $conn->insert_id;
            echo json_encode([
                'status' => 'ok',
                'message' => 'Incidente criado com sucesso',
                'id' => $newId
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        } else {
            throw new Exception('Erro ao criar incidente');
        }
    } elseif ($method === 'PUT' && $incidentId) {
        // Atualizar incidente
        $data = json_decode(file_get_contents('php://input'), true);
        
        $titulo = $data['Titulo'] ?? $data['titulo'] ?? null;
        $descricao = $data['Descricao'] ?? $data['descricao'] ?? null;
        $estado = $data['Estado'] ?? $data['estado'] ?? null;
        $impacto = $data['Impacto'] ?? $data['impacto'] ?? null;
        $dataInicio = $data['DataInicio'] ?? $data['dataInicio'] ?? null;
        $dataFim = $data['DataFim'] ?? $data['dataFim'] ?? null;
        
        $updates = [];
        $params = [];
        $types = '';
        
        if ($titulo !== null) { $updates[] = "Titulo = ?"; $params[] = $titulo; $types .= 's'; }
        if ($descricao !== null) { $updates[] = "Descricao = ?"; $params[] = $descricao; $types .= 's'; }
        if ($estado !== null) { $updates[] = "Estado = ?"; $params[] = $estado; $types .= 's'; }
        if ($impacto !== null) { $updates[] = "Impacto = ?"; $params[] = $impacto; $types .= 's'; }
        if ($dataInicio !== null) { $updates[] = "DataInicio = ?"; $params[] = $dataInicio; $types .= 's'; }
        if ($dataFim !== null) { $updates[] = "DataFim = ?"; $params[] = $dataFim; $types .= 's'; }
        
        if (empty($updates)) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'Nenhum campo para atualizar'
            ]);
            exit;
        }
        
        $params[] = $incidentId;
        $types .= 'i';
        
        $sql = "UPDATE incidentes SET " . implode(', ', $updates) . " WHERE Id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);
        
        if ($stmt->execute()) {
            echo json_encode([
                'status' => 'ok',
                'message' => 'Incidente atualizado com sucesso'
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        } else {
            throw new Exception('Erro ao atualizar incidente');
        }
    } elseif ($method === 'DELETE' && $incidentId) {
        // Deletar incidente
        $stmt = $conn->prepare("DELETE FROM incidentes WHERE Id = ?");
        $stmt->bind_param("i", $incidentId);
        
        if ($stmt->execute()) {
            echo json_encode([
                'status' => 'ok',
                'message' => 'Incidente deletado com sucesso'
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        } else {
            throw new Exception('Erro ao deletar incidente');
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

