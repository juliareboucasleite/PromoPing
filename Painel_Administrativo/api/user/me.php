<?php
/**
 * API Endpoint: Dados do usuário logado
 * Retorna informações do usuário autenticado
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
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
    
    // Buscar dados do usuário na base de dados
    if ($userId) {
        $stmt = $conn->prepare("SELECT Id, Nome, Email, Telefone, Localizacao, Descricao, FotoPerfil, PerfilId FROM utilizadores WHERE Id = ?");
        $stmt->bind_param("i", $userId);
    } else if ($email) {
        $stmt = $conn->prepare("SELECT Id, Nome, Email, Telefone, Localizacao, Descricao, FotoPerfil, PerfilId FROM utilizadores WHERE Email = ?");
        $stmt->bind_param("s", $email);
    } else {
        http_response_code(400);
        echo json_encode([
            'status' => 'error',
            'message' => 'ID ou email do usuário não encontrado'
        ]);
        exit;
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    $dbUser = $result->fetch_assoc();
    
    if (!$dbUser) {
        http_response_code(404);
        echo json_encode([
            'status' => 'error',
            'message' => 'Usuário não encontrado na base de dados'
        ]);
        exit;
    }
    
    // Retornar dados do usuário
    echo json_encode([
        'status' => 'ok',
        'user' => [
            'id' => (int)$dbUser['Id'],
            'nome' => $dbUser['Nome'] ?? '',
            'name' => $dbUser['Nome'] ?? '',
            'email' => $dbUser['Email'] ?? '',
            'telefone' => $dbUser['Telefone'] ?? '',
            'phone' => $dbUser['Telefone'] ?? '',
            'localizacao' => $dbUser['Localizacao'] ?? '',
            'location' => $dbUser['Localizacao'] ?? '',
            'descricao' => $dbUser['Descricao'] ?? '',
            'description' => $dbUser['Descricao'] ?? '',
            'fotoPerfil' => $dbUser['FotoPerfil'] ?? '',
            'avatar' => $dbUser['FotoPerfil'] ?? '',
            'perfilId' => (int)($dbUser['PerfilId'] ?? 1),
            'perfil' => (int)($dbUser['PerfilId'] ?? 1) === 1 ? 'Admin' : 'User',
            'role' => (int)($dbUser['PerfilId'] ?? 1) === 1 ? 'Admin' : 'User'
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Erro ao buscar dados do usuário: ' . $e->getMessage()
    ]);
}

$conn->close();

