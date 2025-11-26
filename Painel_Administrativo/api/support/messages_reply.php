<?php
/**
 * API Endpoint: Responder a uma mensagem de suporte
 * Cria uma resposta para uma mensagem existente
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
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
    // Extrair ID da mensagem da URL (formato: /api/support/messages/{id}/reply)
    $requestUri = $_SERVER['REQUEST_URI'];
    $pathParts = explode('/', trim(parse_url($requestUri, PHP_URL_PATH), '/'));
    
    // Procurar o índice de 'messages' e pegar o próximo elemento
    $messageId = null;
    $messagesIndex = array_search('messages', $pathParts);
    if ($messagesIndex !== false && isset($pathParts[$messagesIndex + 1])) {
        $messageId = (int)$pathParts[$messagesIndex + 1];
    }
    
    // Se não encontrou na URL, tentar do GET
    if (!$messageId && isset($_GET['id'])) {
        $messageId = (int)$_GET['id'];
    }
    
    if (!$messageId) {
        http_response_code(400);
        echo json_encode([
            'status' => 'error',
            'message' => 'ID da mensagem não fornecido'
        ]);
        exit;
    }
    
    $data = json_decode(file_get_contents('php://input'), true);
    $message = $data['message'] ?? '';
    $senderType = $data['senderType'] ?? 'support'; // 'support' para admin, 'user' para usuários
    
    // IMPORTANTE: Aceitar userId de QUALQUER valor fornecido no body
    // Não validar se é admin ou user - permitir qualquer userId
    $userId = null;
    
    // Se senderType = 'user', SEMPRE tentar obter userId do body primeiro
    if ($senderType === 'user') {
        // Prioridade 1: userId do body (enviado pelo widget)
        if (isset($data['userId']) && $data['userId'] !== null && $data['userId'] !== '' && is_numeric($data['userId'])) {
            $userId = (int)$data['userId'];
        } else {
            // Prioridade 2: Buscar userId da mensagem original da thread
            $stmt = $conn->prepare("SELECT UserId FROM supportmessages WHERE Id = ? OR ThreadId = ? ORDER BY Id ASC LIMIT 1");
            $stmt->bind_param("ii", $messageId, $messageId);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($row = $result->fetch_assoc() && $row['UserId']) {
                $userId = (int)$row['UserId'];
            }
        }
    } elseif ($senderType === 'support') {
        // Admin não precisa de userId
        $userId = null;
    } elseif (isset($_SESSION['user']['id'])) {
        // Fallback: usar da sessão se disponível
        $userId = (int)$_SESSION['user']['id'];
    }
    
    // Log para debug - mostrar tudo
    error_log("Reply mensagem - senderType: $senderType, userId: " . ($userId ?? 'null') . ", messageId: $messageId, message: " . substr($message, 0, 30));
    
    if (empty($message)) {
        http_response_code(400);
        echo json_encode([
            'status' => 'error',
            'message' => 'Mensagem não pode estar vazia'
        ]);
        exit;
    }
    
    // Buscar a mensagem original para obter o ThreadId
    $stmt = $conn->prepare("SELECT Id, ThreadId FROM supportmessages WHERE Id = ?");
    $stmt->bind_param("i", $messageId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode([
            'status' => 'error',
            'message' => 'Mensagem não encontrada'
        ]);
        exit;
    }
    
    $originalMessage = $result->fetch_assoc();
    // Se a mensagem tem ThreadId > 0, usar esse. Se não, a mensagem é a original (ThreadId = Id da mensagem)
    $threadId = ($originalMessage['ThreadId'] > 0) ? $originalMessage['ThreadId'] : $messageId;
    
    // Verificar estrutura da tabela
    $stmt = $conn->prepare("SHOW COLUMNS FROM supportmessages LIKE 'Mensagem'");
    $stmt->execute();
    $result = $stmt->get_result();
    $hasMensagem = $result->num_rows > 0;
    
    // Garantir que threadId seja um valor válido (sempre > 0 para respostas)
    $threadIdValue = ($threadId > 0) ? $threadId : $messageId;
    
    // Inserir resposta (sempre tem ThreadId)
    if ($hasMensagem) {
        if ($userId) {
            $stmt = $conn->prepare("
                INSERT INTO supportmessages (UserId, ThreadId, Mensagem, SenderType, DataEnvio)
                VALUES (?, ?, ?, ?, NOW())
            ");
            $stmt->bind_param("iiss", $userId, $threadIdValue, $message, $senderType);
        } else {
            $stmt = $conn->prepare("
                INSERT INTO supportmessages (ThreadId, Mensagem, SenderType, DataEnvio)
                VALUES (?, ?, ?, NOW())
            ");
            $stmt->bind_param("iss", $threadIdValue, $message, $senderType);
        }
    } else {
        if ($userId) {
            $stmt = $conn->prepare("
                INSERT INTO supportmessages (UserId, ThreadId, Message, SenderType, CreatedAt)
                VALUES (?, ?, ?, ?, NOW())
            ");
            $stmt->bind_param("iiss", $userId, $threadIdValue, $message, $senderType);
        } else {
            $stmt = $conn->prepare("
                INSERT INTO supportmessages (ThreadId, Message, SenderType, CreatedAt)
                VALUES (?, ?, ?, NOW())
            ");
            $stmt->bind_param("iss", $threadIdValue, $message, $senderType);
        }
    }
    $stmt->execute();
    
    $newId = $conn->insert_id;
    
    // Buscar mensagem criada
    $stmt = $conn->prepare("
        SELECT 
            m.*,
            u.Nome as NomeUsuario,
            u.Email as EmailUsuario
        FROM supportmessages m
        LEFT JOIN utilizadores u ON m.UserId = u.Id
        WHERE m.Id = ?
    ");
    $stmt->bind_param("i", $newId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    
    echo json_encode([
        'id' => (int)$newId,
        'threadId' => (int)$threadId,
        'message' => $message,
        'senderType' => $senderType,
        'userId' => $userId,
        'userName' => $row['NomeUsuario'] ?? ($userId ? 'Usuário' : 'Suporte'),
        'userEmail' => $row['EmailUsuario'] ?? '',
        'createdAt' => $row['DataEnvio'] ?? $row['CreatedAt'] ?? date('Y-m-d H:i:s')
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Erro ao criar resposta: ' . $e->getMessage()
    ]);
}

$conn->close();

