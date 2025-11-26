<?php
/**
 * API Endpoint: Dados diários para gráficos
 * Retorna dados dos últimos N dias
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

$days = isset($_GET['days']) ? (int)$_GET['days'] : 7;
$days = max(1, min(30, $days)); // Limitar entre 1 e 30 dias

try {
    // Gerar labels dos últimos N dias
    $labels = [];
    $notificacoes = [];
    $usuarios = [];
    
    for ($i = $days - 1; $i >= 0; $i--) {
        $date = date('Y-m-d', strtotime("-$i days"));
        $dayName = date('D', strtotime($date));
        
        // Converter para português
        $dayNamesPt = [
            'Mon' => 'Seg',
            'Tue' => 'Ter',
            'Wed' => 'Qua',
            'Thu' => 'Qui',
            'Fri' => 'Sex',
            'Sat' => 'Sáb',
            'Sun' => 'Dom'
        ];
        
        $labels[] = $dayNamesPt[$dayName] ?? $dayName;
        
        // Contar notificações do dia
        $stmt = $conn->prepare("SELECT COUNT(*) as total FROM notificacoes WHERE DATE(DataEnvio) = ?");
        $stmt->bind_param("s", $date);
        $stmt->execute();
        $result = $stmt->get_result();
        $notificacoes[] = (int)($result->fetch_assoc()['total'] ?? 0);
        
        // Contar utilizadores ativos do dia (que fizeram login ou se registaram)
        $stmt = $conn->prepare("SELECT COUNT(DISTINCT Id) as total FROM utilizadores WHERE (DATE(ultimo_login) = ? OR DATE(Data_Registo) = ?) AND Ativo = 1");
        $stmt->bind_param("ss", $date, $date);
        $stmt->execute();
        $result = $stmt->get_result();
        $usuarios[] = (int)($result->fetch_assoc()['total'] ?? 0);
    }
    
    echo json_encode([
        'labels' => $labels,
        'series' => [
            'notificacoes' => $notificacoes,
            'usuarios' => $usuarios
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Erro ao buscar dados: ' . $e->getMessage()
    ]);
}

$conn->close();

