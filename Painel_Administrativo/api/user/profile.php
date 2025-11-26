<?php
/**
 * API Endpoint: Perfil do usuário
 * Permite atualizar dados do perfil do usuário autenticado
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../config.php';

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
    
    // Verificar se há usuário na sessão
    $user = getLoggedUser();
    
    if (!$user || !isset($user['id'])) {
        http_response_code(401);
        echo json_encode([
            'status' => 'error',
            'message' => 'Usuário não autenticado'
        ]);
        exit;
    }
    
    $userId = is_numeric($user['id']) ? (int)$user['id'] : null;
    $email = $user['email'] ?? '';
    
    // Buscar ID do usuário na base de dados se necessário
    if (!$userId && $email) {
        $stmt = $conn->prepare("SELECT Id FROM utilizadores WHERE Email = ?");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $result = $stmt->get_result();
        $dbUser = $result->fetch_assoc();
        if ($dbUser) {
            $userId = (int)$dbUser['Id'];
        }
    }
    
    if (!$userId) {
        http_response_code(404);
        echo json_encode([
            'status' => 'error',
            'message' => 'Usuário não encontrado na base de dados'
        ]);
        exit;
    }
    
    if ($method === 'GET') {
        // Buscar dados do perfil
        $stmt = $conn->prepare("SELECT Id, Nome, Email, Telefone, Localizacao, Descricao, FotoPerfil, PerfilId FROM utilizadores WHERE Id = ?");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $result = $stmt->get_result();
        $dbUser = $result->fetch_assoc();
        
        if (!$dbUser) {
            http_response_code(404);
            echo json_encode([
                'status' => 'error',
                'message' => 'Usuário não encontrado'
            ]);
            exit;
        }
        
        echo json_encode([
            'status' => 'ok',
            'profile' => [
                'id' => (int)$dbUser['Id'],
                'nome' => $dbUser['Nome'] ?? '',
                'email' => $dbUser['Email'] ?? '',
                'telefone' => $dbUser['Telefone'] ?? '',
                'localizacao' => $dbUser['Localizacao'] ?? '',
                'descricao' => $dbUser['Descricao'] ?? '',
                'fotoPerfil' => $dbUser['FotoPerfil'] ?? '',
                'perfilId' => (int)($dbUser['PerfilId'] ?? 1)
            ]
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        
    } elseif ($method === 'PUT') {
        // Atualizar dados do perfil
        $data = json_decode(file_get_contents('php://input'), true);
        
        $nome = $data['nome'] ?? null;
        $email = $data['email'] ?? null;
        $telefone = $data['telefone'] ?? null;
        $localizacao = $data['localizacao'] ?? null;
        $descricao = $data['descricao'] ?? null;
        
        $updates = [];
        $params = [];
        $types = '';
        
        if ($nome !== null) { 
            $updates[] = "Nome = ?"; 
            $params[] = $nome; 
            $types .= 's'; 
        }
        if ($email !== null) { 
            $updates[] = "Email = ?"; 
            $params[] = $email; 
            $types .= 's'; 
        }
        if ($telefone !== null) { 
            $updates[] = "Telefone = ?"; 
            $params[] = $telefone; 
            $types .= 's'; 
        }
        if ($localizacao !== null) { 
            $updates[] = "Localizacao = ?"; 
            $params[] = $localizacao; 
            $types .= 's'; 
        }
        if ($descricao !== null) { 
            $updates[] = "Descricao = ?"; 
            $params[] = $descricao; 
            $types .= 's'; 
        }
        
        if (empty($updates)) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'Nenhum campo para atualizar'
            ]);
            exit;
        }
        
        $params[] = $userId;
        $types .= 'i';
        
        $sql = "UPDATE utilizadores SET " . implode(', ', $updates) . " WHERE Id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);
        
        if ($stmt->execute()) {
            // Atualizar sessão se nome ou email foram alterados
            if ($nome !== null || $email !== null) {
                $user = getLoggedUser();
                if ($nome !== null) $user['name'] = $nome;
                if ($email !== null) $user['email'] = $email;
                saveUserSession($user);
            }
            
            echo json_encode([
                'status' => 'ok',
                'message' => 'Perfil atualizado com sucesso'
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        } else {
            throw new Exception('Erro ao atualizar perfil');
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

