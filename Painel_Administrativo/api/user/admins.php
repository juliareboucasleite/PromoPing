<?php
/**
 * API Endpoint: Listar Administradores (PerfilId = 1)
 * Retorna lista de todos os administradores do sistema
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
    // Buscar todos os administradores (PerfilId = 1)
    $stmt = $conn->prepare("
        SELECT 
            u.Id,
            u.Nome,
            u.Email,
            u.Telefone,
            u.Localizacao,
            u.Descricao,
            u.FotoPerfil,
            u.PerfilId,
            u.DataRegisto,
            u.Ativo,
            p.Nome as PerfilNome
        FROM utilizadores u
        LEFT JOIN perfis p ON u.PerfilId = p.Id
        WHERE u.PerfilId = 1 AND (u.Ativo = 1 OR u.Ativo IS NULL)
        ORDER BY u.DataRegisto DESC
    ");
    
    $stmt->execute();
    $result = $stmt->get_result();
    
    $admins = [];
    while ($row = $result->fetch_assoc()) {
        $admins[] = [
            'Id' => (int)$row['Id'],
            'Nome' => $row['Nome'] ?? '',
            'Email' => $row['Email'] ?? '',
            'Telefone' => $row['Telefone'] ?? null,
            'Localizacao' => $row['Localizacao'] ?? null,
            'Descricao' => $row['Descricao'] ?? null,
            'FotoPerfil' => $row['FotoPerfil'] ?? null,
            'PerfilId' => (int)($row['PerfilId'] ?? 1),
            'Perfil' => $row['PerfilNome'] ?? 'Admin',
            'DataRegisto' => $row['DataRegisto'] ?? null,
            'Ativo' => (int)($row['Ativo'] ?? 1)
        ];
    }
    
    echo json_encode([
        'status' => 'ok',
        'admins' => $admins,
        'total' => count($admins)
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Erro ao buscar administradores: ' . $e->getMessage()
    ]);
}

$conn->close();

