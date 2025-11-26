<?php
/**
 * API Endpoint: Mensagens de Suporte
 * Gerencia mensagens e threads de suporte
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../config.php';

// IMPORTANTE: Verificar se o usuário é admin (PerfilId = 1) antes de permitir acesso
// Apenas administradores podem ver conversas de suporte
requireAdmin();

// Verificar explicitamente se é admin (PerfilId = 1)
$isAdmin = false;
$user = getLoggedUser();
if ($user && isset($user['id'])) {
    $conn = getDBConnection();
    if ($conn) {
        $stmt = $conn->prepare("SELECT PerfilId FROM utilizadores WHERE Id = ?");
        $userId = is_numeric($user['id']) ? (int)$user['id'] : null;
        $stmt->execute();
        $result = $stmt->get_result();
        $userData = $result->fetch_assoc();
        $isAdmin = ($userData && isset($userData['PerfilId']) && $userData['PerfilId'] == 1);
    }
}

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
    // Verificar se a tabela supportmessages existe, criar se não existir
    $checkTable = $conn->query("SHOW TABLES LIKE 'supportmessages'");
    if ($checkTable->num_rows == 0) {
        // Criar tabela supportmessages
        $conn->query("
            CREATE TABLE IF NOT EXISTS supportmessages (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                UserId INT DEFAULT NULL,
                ThreadId INT DEFAULT NULL,
                Mensagem TEXT NOT NULL,
                Message TEXT NOT NULL,
                SenderType ENUM('user', 'support') DEFAULT 'user',
                DataEnvio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_id (UserId),
                INDEX idx_thread_id (ThreadId),
                INDEX idx_data_envio (DataEnvio),
                INDEX idx_sender_type (SenderType)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }
    
    $method = $_SERVER['REQUEST_METHOD'];
    $threadId = isset($_GET['threadId']) ? (int)$_GET['threadId'] : null;
    // Aumentar limite padrão para 100 para mostrar mais conversas
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
    
    if ($method === 'GET') {
        if ($threadId) {
            // Buscar mensagens de uma thread específica
            // Busca a mensagem original (Id = threadId) e todas as respostas (ThreadId = threadId)
            // Primeiro, verificar se a mensagem original existe
            // IMPORTANTE: A tabela usa camelCase (id, threadId, message, createdAt)
            $stmt = $conn->prepare("SELECT id, threadId FROM supportmessages WHERE id = ?");
            $stmt->bind_param("i", $threadId);
            $stmt->execute();
            $original = $stmt->get_result()->fetch_assoc();
            
            // Determinar o ThreadId real (pode ser o próprio Id se for mensagem original)
            $realThreadId = $threadId;
            if ($original) {
                $threadIdValue = $original['threadId'] ?? $original['ThreadId'] ?? null;
                $realThreadId = ($threadIdValue && $threadIdValue > 0) ? $threadIdValue : $threadId;
            }
            
            // Buscar todas as mensagens da thread
            // Inclui: mensagem original (Id = threadId), respostas (threadId = realThreadId), e respostas com threadId = 0 mas Id relacionado
            // IMPORTANTE: A tabela usa camelCase (userId, threadId, message, createdAt)
            $stmt = $conn->prepare("
                SELECT 
                    m.*,
                    u.Nome as NomeUsuario,
                    u.Email as EmailUsuario
                FROM supportmessages m
                LEFT JOIN utilizadores u ON m.userId = u.Id
                WHERE m.id = ? 
                   OR m.threadId = ?
                   OR (m.threadId = 0 AND ? = ?)
                ORDER BY m.createdAt ASC, m.id ASC
            ");
            $stmt->bind_param("iiii", $threadId, $realThreadId, $realThreadId, $threadId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            // Se ainda não encontrou nada, fazer busca mais ampla
            // IMPORTANTE: A tabela usa camelCase (userId, threadId, message, createdAt)
            if ($result->num_rows === 0) {
                $stmt = $conn->prepare("
                    SELECT 
                        m.*,
                        u.Nome as NomeUsuario,
                        u.Email as EmailUsuario
                    FROM supportmessages m
                    LEFT JOIN utilizadores u ON m.userId = u.Id
                    WHERE m.threadId = ? OR m.id = ? OR (m.threadId IS NULL AND m.id = ?)
                    ORDER BY m.createdAt ASC, m.id ASC
                ");
                $stmt->bind_param("iii", $threadId, $threadId, $threadId);
                $stmt->execute();
                $result = $stmt->get_result();
            }
            
            $messages = [];
            while ($row = $result->fetch_assoc()) {
                // Extrair valores - a tabela usa camelCase (id, userId, threadId, message, senderType, createdAt)
                $msgId = $row['id'] ?? $row['Id'] ?? null;
                $userId = $row['userId'] ?? $row['UserId'] ?? null;
                $threadId = $row['threadId'] ?? $row['ThreadId'] ?? null;
                $senderType = $row['senderType'] ?? $row['SenderType'] ?? null;
                $message = $row['message'] ?? $row['Mensagem'] ?? $row['Message'] ?? '';
                $createdAt = $row['createdAt'] ?? $row['DataEnvio'] ?? $row['CreatedAt'] ?? date('Y-m-d H:i:s');
                
                // Determinar senderType corretamente
                if (!$senderType || $senderType === '') {
                    // Se não tem SenderType, determinar pelo userId
                    if ($userId) {
                        $senderType = 'user';
                    } else {
                        $senderType = 'support';
                    }
                }
                
                // ThreadId pode ser NULL, 0, ou um valor - usar o id da mensagem se for NULL/0
                $threadIdValue = ($threadId && $threadId > 0) ? (int)$threadId : (int)$msgId;
                
                $messages[] = [
                    'id' => (int)$msgId,
                    'threadId' => $threadIdValue,
                    'message' => $message,
                    'senderType' => $senderType,
                    'userId' => $userId ? (int)$userId : null,
                    'userName' => $row['NomeUsuario'] ?? ($userId ? 'Usuário' : 'Suporte'),
                    'userEmail' => $row['EmailUsuario'] ?? '',
                    'createdAt' => $createdAt,
                    'timestamp' => strtotime($createdAt)
                ];
            }
            
            echo json_encode($messages, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        } else {
            // --- 🧠 Listar todas as threads ---
            // IMPORTANTE: Apenas administradores (PerfilId = 1) acessam este painel
            // Sempre retornar TODAS as conversas, sem nenhum filtro de userId ou PerfilId
            
            // Garantir que $limit seja um inteiro seguro
            $limit = (int)$limit;
            if ($limit <= 0 || $limit > 500) {
                $limit = 500;
            }
            
            // Query principal - SEM NENHUM FILTRO - retornar TODAS as conversas
            // IMPORTANTE: A tabela usa camelCase (id, userId, threadId, message, createdAt, senderType)
            $query = "
                SELECT 
                    m.*,
                    m.userId AS UserId,
                    m.threadId AS ThreadId,
                    m.senderType AS SenderType,
                    m.message AS Mensagem,
                    m.createdAt AS DataEnvio,
                    u.Nome AS NomeUsuario,
                    u.Email AS EmailUsuario,
                    u.PerfilId AS UserPerfilId
                FROM supportmessages m
                LEFT JOIN utilizadores u ON m.userId = u.Id
                ORDER BY m.createdAt DESC, m.id DESC
                LIMIT $limit
            ";
            
            error_log(" [DEBUG] Query executada - Admin sempre vê TODAS as conversas (SEM FILTRO)");
            
            $resultAll = $conn->query($query);
            
            if (!$resultAll) {
                error_log(" [ERROR] Erro na query: " . $conn->error);
                throw new Exception("Erro ao buscar mensagens: " . $conn->error);
            }
            
            $allMessages = [];
            $userIdsFound = [];
            while ($row = $resultAll->fetch_assoc()) {
                $allMessages[] = $row;
                // Coletar todos os userIds encontrados para debug
                $msgUserId = $row['userId'] ?? $row['UserId'] ?? null;
                if ($msgUserId && !in_array($msgUserId, $userIdsFound)) {
                    $userIdsFound[] = $msgUserId;
                }
            }
            
            error_log(" [DEBUG] Total de mensagens retornadas do banco: " . count($allMessages));
            error_log(" [DEBUG] UserIds encontrados nas mensagens: " . implode(', ', $userIdsFound));
            
            // --- Identificar threads únicas ---
            // Uma thread é identificada pela primeira mensagem, que tem:
            // - threadId IS NULL
            // - threadId = 0
            // - threadId = id (primeira mensagem aponta para si mesma)
            // - OU é uma resposta que aponta para outra mensagem (threadId = id de outra mensagem)
            
            $threadsMap = [];
            $allThreadRoots = []; // Para rastrear todos os threadRoots encontrados
            
            // Primeiro passo: identificar todos os threadRoots únicos
            foreach ($allMessages as $row) {
                // Extrair dados - usar camelCase primeiro (estrutura real da tabela)
                $msgId = (int)($row['id'] ?? $row['Id'] ?? 0);
                $threadId = $row['threadId'] ?? $row['ThreadId'] ?? null;
                
                if ($msgId == 0) continue; // Pular mensagens sem ID válido
                
                // Determinar o threadRoot (ID da primeira mensagem da thread)
                $threadRoot = null;
                
                // Se threadId é NULL, 0, string vazia, ou igual ao próprio id, é primeira mensagem
                if ($threadId === null || $threadId === 0 || $threadId === '' || $threadId == $msgId) {
                    $threadRoot = $msgId; // Esta mensagem é a primeira da thread
                } else {
                    // Esta é uma resposta, o threadRoot é o threadId (ID da primeira mensagem)
                    $threadRoot = (int)$threadId;
                }
                
                $allThreadRoots[] = $threadRoot;
            }
            
            // Segundo passo: para cada threadRoot único, encontrar a primeira mensagem
            $uniqueThreadRoots = array_unique($allThreadRoots);
            error_log(" [DEBUG] ThreadRoots únicos encontrados: " . implode(', ', $uniqueThreadRoots));
            
            foreach ($uniqueThreadRoots as $threadRoot) {
                if (!isset($threadsMap[$threadRoot])) {
                    // Primeiro, tentar encontrar a mensagem com id = threadRoot (primeira mensagem)
                    $firstMessage = null;
                    foreach ($allMessages as $msg) {
                        $checkId = (int)($msg['id'] ?? $msg['Id'] ?? 0);
                        if ($checkId === $threadRoot) {
                            $firstMessage = $msg;
                            error_log(" [DEBUG] Primeira mensagem encontrada para thread $threadRoot: id=$checkId");
                            break;
                        }
                    }
                    
                    // Se não encontrou, buscar a mensagem mais antiga dessa thread
                    if (!$firstMessage) {
                        foreach ($allMessages as $msg) {
                            $checkThreadId = $msg['threadId'] ?? $msg['ThreadId'] ?? null;
                            $checkId = (int)($msg['id'] ?? $msg['Id'] ?? 0);
                            
                            // Se a mensagem pertence a esta thread
                            if ($checkThreadId == $threadRoot || ($checkThreadId === null && $checkId == $threadRoot)) {
                                if (!$firstMessage) {
                                    $firstMessage = $msg;
                                } else {
                                    // Usar a mensagem com menor id (mais antiga)
                                    $firstId = (int)($firstMessage['id'] ?? $firstMessage['Id'] ?? 0);
                                    if ($checkId < $firstId) {
                                        $firstMessage = $msg;
                                    }
                                }
                            }
                        }
                    }
                    
                    if ($firstMessage) {
                        $threadsMap[$threadRoot] = $firstMessage;
                        $firstMsgId = (int)($firstMessage['id'] ?? $firstMessage['Id'] ?? 0);
                        error_log(" [DEBUG] Thread $threadRoot adicionada ao mapa - primeira mensagem: id=$firstMsgId");
                    } else {
                        error_log(" [WARNING] Thread $threadRoot encontrada mas primeira mensagem não localizada");
                    }
                }
            }
            
            error_log(" [DEBUG] Total de threads únicas identificadas: " . count($threadsMap));
            error_log(" [DEBUG] Threads encontradas no mapa: " . implode(', ', array_keys($threadsMap)));
            
            // --- Converter threads em array de saída ---
            // IMPORTANTE: Incluir TODAS as threads, independente do userId ou PerfilId
            $items = [];
            $threadUserIds = [];
            foreach ($threadsMap as $threadRoot => $thread) {
                // Extrair dados usando camelCase primeiro (estrutura real da tabela), depois aliases
                $msgId = (int)($thread['id'] ?? $thread['Id'] ?? 0);
                $userId = $thread['userId'] ?? $thread['UserId'] ?? null;
                $threadId = $thread['threadId'] ?? $thread['ThreadId'] ?? null;
                $senderType = $thread['senderType'] ?? $thread['SenderType'] ?? null;
                $message = $thread['message'] ?? $thread['Mensagem'] ?? $thread['Message'] ?? '';
                $createdAt = $thread['createdAt'] ?? $thread['DataEnvio'] ?? $thread['CreatedAt'] ?? date('Y-m-d H:i:s');
                $userPerfilId = $thread['UserPerfilId'] ?? null;
                $nomeUsuario = $thread['NomeUsuario'] ?? '';
                $emailUsuario = $thread['EmailUsuario'] ?? '';
                
                if ($msgId == 0) continue; // Pular threads sem ID válido
                
                // Coletar userIds das threads para debug
                if ($userId && !in_array($userId, $threadUserIds)) {
                    $threadUserIds[] = $userId;
                }
                
                if (!$senderType || $senderType === '') {
                    $senderType = $userId ? 'user' : 'support';
                }
                
                if (empty($nomeUsuario)) {
                    $nomeUsuario = $userId ? 'Usuário #' . $userId : 'Anônimo';
                }
                
                // Contar respostas - usar camelCase (threadId, id)
                $stmtCount = $conn->prepare("
                    SELECT COUNT(*) - 1 AS cnt
                    FROM supportmessages
                    WHERE (threadId = ? OR (threadId IS NULL AND id = ?) OR (threadId = 0 AND id = ?))
                      AND id != ?
                ");
                $stmtCount->bind_param("iiii", $threadRoot, $threadRoot, $threadRoot, $msgId);
                $stmtCount->execute();
                $countResult = $stmtCount->get_result()->fetch_assoc();
                $replyCount = max(0, (int)($countResult['cnt'] ?? 0));
                
                $items[] = [
                    'id' => $msgId,
                    'threadId' => (int)($threadId ?? $msgId),
                    'message' => $message,
                    'senderType' => $senderType,
                    'userId' => $userId ? (int)$userId : null,
                    'userName' => $nomeUsuario,
                    'userEmail' => $emailUsuario,
                    'userPerfilId' => ($userPerfilId !== null && $userPerfilId !== '') ? (int)$userPerfilId : null,
                    'createdAt' => $createdAt,
                    'replyCount' => $replyCount
                ];
                
                // Log para debug
                error_log(" [DEBUG] Thread incluída - ID: $msgId, userId: " . ($userId ?? 'null') . ", userPerfilId: " . ($userPerfilId ?? 'null') . ", message: " . substr($message, 0, 30));
            }
            
            error_log(" [DEBUG] UserIds das threads incluídas: " . implode(', ', $threadUserIds));
            
            // Ordenar por data (mais recente primeiro)
            usort($items, fn($a, $b) => strtotime($b['createdAt']) - strtotime($a['createdAt']));
            $items = array_slice($items, 0, $limit);
            
            // Log final com resumo
            $finalUserIds = array_unique(array_filter(array_column($items, 'userId')));
            $finalPerfilIds = array_unique(array_filter(array_column($items, 'userPerfilId')));
            error_log(" [DEBUG] RESULTADO FINAL - Total de threads: " . count($items));
            error_log(" [DEBUG] RESULTADO FINAL - UserIds nas threads retornadas: " . implode(', ', $finalUserIds));
            error_log(" [DEBUG] RESULTADO FINAL - PerfilIds nas threads retornadas: " . implode(', ', $finalPerfilIds));
            
            echo json_encode([
                'items' => $items,
                'total' => count($items),
                'adminAccess' => true,
                'message' => 'Todas as conversas de suporte (admin vê tudo)',
                'debug' => [
                    'isAdmin' => true,
                    'totalMessages' => count($allMessages),
                    'threadsFound' => count($threadsMap),
                    'userIdsInMessages' => $userIdsFound,
                    'userIdsInThreads' => $threadUserIds,
                    'userIdsInResult' => $finalUserIds,
                    'perfilIds' => array_values($finalPerfilIds)
                ]
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }
    } elseif ($method === 'POST') {
        // Criar nova mensagem
        $data = json_decode(file_get_contents('php://input'), true);
        $message = $data['message'] ?? '';
        
        // Permitir userId do body ou usar da sessão
        // IMPORTANTE: Aceitar null se não fornecido (para permitir mensagens anônimas ou de usuários não identificados)
        $userId = null;
        if (isset($data['userId']) && $data['userId'] !== null && $data['userId'] !== '') {
            $userId = (int)$data['userId'];
        } elseif (isset($_SESSION['user']['id'])) {
            $userId = (int)$_SESSION['user']['id'];
        }
        
        // Determinar senderType: se senderType está explícito no request, usar; 
        // senão, se userId está presente, é 'user' (usuário normal ou admin como usuário);
        // se senderType é 'support' explícito, usar 'support' (admin respondendo como suporte)
        $senderType = $data['senderType'] ?? ($userId ? 'user' : 'support');
        
        if (empty($message)) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'Mensagem não pode estar vazia'
            ]);
            exit;
        }
        
        // IMPORTANTE: Se createNewThread estiver true, SEMPRE criar nova thread (ignorar parentId/threadId)
        $createNewThread = isset($data['createNewThread']) && $data['createNewThread'] === true;
        
        // Log para debug (remover em produção)
        error_log("Nova mensagem - userId: " . ($userId ?? 'null') . ", senderType: " . ($senderType ?? 'null') . ", createNewThread: " . ($createNewThread ? 'true' : 'false') . ", message: " . substr($message, 0, 50));
        
        // Verificar se é uma resposta (tem parentId ou threadId no data)
        $parentId = null;
        $threadId = null; // Para mensagem nova
        
        // Se createNewThread = true, NÃO buscar parentId (forçar nova thread)
        if (!$createNewThread) {
            $parentId = isset($data['parentId']) ? (int)$data['parentId'] : null;
        }
        
        // Se for uma resposta (e não for createNewThread), buscar o ThreadId original
        if ($parentId && !$createNewThread) {
            $stmt = $conn->prepare("SELECT Id, ThreadId FROM supportmessages WHERE Id = ?");
            $stmt->bind_param("i", $parentId);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($row = $result->fetch_assoc()) {
                // Se a mensagem pai tem ThreadId, usar esse. Se não, a mensagem pai é a original (ThreadId = Id da mensagem pai)
                $threadId = ($row['ThreadId'] > 0) ? $row['ThreadId'] : $parentId;
            } else {
                // Se não encontrou a mensagem pai, usar o parentId como threadId
                $threadId = $parentId;
            }
        }
        
        // Inserir mensagem
        $stmt = $conn->prepare("
            INSERT INTO supportmessages (UserId, ThreadId, Mensagem, SenderType, DataEnvio)
            VALUES (?, ?, ?, ?, NOW())
        ");
        
        // Verificar estrutura da tabela (pode ter Message ou Mensagem)
        $stmt = $conn->prepare("SHOW COLUMNS FROM supportmessages LIKE 'Mensagem'");
        $stmt->execute();
        $result = $stmt->get_result();
        $hasMensagem = $result->num_rows > 0;
        
        // IMPORTANTE: Para mensagens novas (sem threadId), usar 0 ou NULL
        // Isso garante que cada mensagem inicial seja uma thread separada
        // NUNCA usar threadId existente para novas mensagens
        $threadIdValue = ($threadId && $threadId > 0 && !$createNewThread) ? $threadId : 0;
        
        // Preparar bind_param baseado em se temos userId ou não
        if ($hasMensagem) {
            if ($threadIdValue > 0) {
                // Mensagem com ThreadId e opcionalmente UserId
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
                // Mensagem nova sem ThreadId - garantir que ThreadId seja NULL (não 0)
                // Isso é importante para que a query de listagem encontre todas as threads
                if ($userId) {
                    // Verificar se a coluna ThreadId aceita NULL
                    $stmt = $conn->prepare("SHOW COLUMNS FROM supportmessages WHERE Field = 'ThreadId' AND `Null` = 'YES'");
                    $stmt->execute();
                    $result = $stmt->get_result();
                    $acceptsNull = $result->num_rows > 0;
                    
                    if ($acceptsNull) {
                        $stmt = $conn->prepare("
                            INSERT INTO supportmessages (UserId, Mensagem, SenderType, DataEnvio)
                            VALUES (?, ?, ?, NOW())
                        ");
                        $stmt->bind_param("iss", $userId, $message, $senderType);
                    } else {
                        // Se não aceita NULL, usar 0 mas garantir que será tratado como thread inicial
                        $stmt = $conn->prepare("
                            INSERT INTO supportmessages (UserId, ThreadId, Mensagem, SenderType, DataEnvio)
                            VALUES (?, 0, ?, ?, NOW())
                        ");
                        $stmt->bind_param("iss", $userId, $message, $senderType);
                    }
                } else {
                    $stmt = $conn->prepare("SHOW COLUMNS FROM supportmessages WHERE Field = 'ThreadId' AND `Null` = 'YES'");
                    $stmt->execute();
                    $result = $stmt->get_result();
                    $acceptsNull = $result->num_rows > 0;
                    
                    if ($acceptsNull) {
                        $stmt = $conn->prepare("
                            INSERT INTO supportmessages (Mensagem, SenderType, DataEnvio)
                            VALUES (?, ?, NOW())
                        ");
                        $stmt->bind_param("ss", $message, $senderType);
                    } else {
                        $stmt = $conn->prepare("
                            INSERT INTO supportmessages (ThreadId, Mensagem, SenderType, DataEnvio)
                            VALUES (0, ?, ?, NOW())
                        ");
                        $stmt->bind_param("ss", $message, $senderType);
                    }
                }
            }
        } else {
            // Estrutura com Message (não Mensagem)
            if ($threadIdValue > 0) {
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
            } else {
                // Estrutura com Message (não Mensagem) - mensagem nova sem ThreadId
                // IMPORTANTE: Cada mensagem inicial cria uma nova thread, mesmo que seja do mesmo userId
                if ($userId) {
                    $stmt = $conn->prepare("SHOW COLUMNS FROM supportmessages WHERE Field = 'ThreadId' AND `Null` = 'YES'");
                    $stmt->execute();
                    $result = $stmt->get_result();
                    $acceptsNull = $result->num_rows > 0;
                    
                    if ($acceptsNull) {
                        // Usar NULL para thread inicial
                        $stmt = $conn->prepare("
                            INSERT INTO supportmessages (UserId, Message, SenderType, CreatedAt)
                            VALUES (?, ?, ?, NOW())
                        ");
                        $stmt->bind_param("iss", $userId, $message, $senderType);
                        error_log("Nova thread criada (Message) - UserId: $userId, ThreadId: NULL");
                    } else {
                        // Se não aceita NULL, usar 0
                        $stmt = $conn->prepare("
                            INSERT INTO supportmessages (UserId, ThreadId, Message, SenderType, CreatedAt)
                            VALUES (?, 0, ?, ?, NOW())
                        ");
                        $stmt->bind_param("iss", $userId, $message, $senderType);
                        error_log("Nova thread criada (Message) - UserId: $userId, ThreadId: 0");
                    }
                } else {
                    $stmt = $conn->prepare("SHOW COLUMNS FROM supportmessages WHERE Field = 'ThreadId' AND `Null` = 'YES'");
                    $stmt->execute();
                    $result = $stmt->get_result();
                    $acceptsNull = $result->num_rows > 0;
                    
                    if ($acceptsNull) {
                        $stmt = $conn->prepare("
                            INSERT INTO supportmessages (Message, SenderType, CreatedAt)
                            VALUES (?, ?, NOW())
                        ");
                        $stmt->bind_param("ss", $message, $senderType);
                    } else {
                        $stmt = $conn->prepare("
                            INSERT INTO supportmessages (ThreadId, Message, SenderType, CreatedAt)
                            VALUES (0, ?, ?, NOW())
                        ");
                        $stmt->bind_param("ss", $message, $senderType);
                    }
                }
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
        
        // IMPORTANTE: Para mensagens novas (sem threadId), usar o ID da mensagem como threadId
        // Isso garante que cada nova mensagem seja uma thread independente
        $finalThreadId = ($threadId && $threadId > 0) ? (int)$threadId : (int)$newId;
        
        error_log("Nova mensagem criada - ID: $newId, UserId: " . ($userId ?? 'null') . ", SenderType: $senderType, ThreadId original: " . ($threadId ?? 'null') . ", ThreadId final: $finalThreadId, ThreadIdValue inserido: " . ($threadIdValue ?? 'null'));
        
        echo json_encode([
            'id' => (int)$newId,
            'threadId' => $finalThreadId,
            'message' => $message,
            'senderType' => $senderType,
            'userId' => $userId,
            'userName' => $row['NomeUsuario'] ?? ($userId ? 'Usuário' : 'Suporte'),
            'userEmail' => $row['EmailUsuario'] ?? '',
            'createdAt' => $row['DataEnvio'] ?? $row['CreatedAt'] ?? date('Y-m-d H:i:s')
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    } elseif ($method === 'DELETE') {
        // Deletar mensagens de uma thread (limpar histórico)
        $threadIdToDelete = isset($_GET['threadId']) ? (int)$_GET['threadId'] : null;
        
        if (!$threadIdToDelete) {
            http_response_code(400);
            echo json_encode([
                'status' => 'error',
                'message' => 'ThreadId não fornecido'
            ]);
            exit;
        }
        
        // Deletar todas as mensagens da thread
        $stmt = $conn->prepare("DELETE FROM supportmessages WHERE Id = ? OR ThreadId = ?");
        $stmt->bind_param("ii", $threadIdToDelete, $threadIdToDelete);
        $stmt->execute();
        $deletedRows = $stmt->affected_rows;
        
        error_log("Histórico limpo - ThreadId: $threadIdToDelete, Mensagens deletadas: $deletedRows");
        
        echo json_encode([
            'status' => 'ok',
            'message' => 'Histórico limpo com sucesso',
            'deletedCount' => $deletedRows
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Erro ao processar requisição: ' . $e->getMessage()
    ]);
}

$conn->close();

