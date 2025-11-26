<?php
/**
 * API Endpoint: Visão geral mensal para gráficos
 * Retorna dados dos últimos N meses
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

$months = isset($_GET['months']) ? (int)$_GET['months'] : 9;
$months = max(1, min(24, $months)); // Limitar entre 1 e 24 meses

try {
    // Gerar labels dos últimos N meses
    $labels = [];
    $utilizadoresNovos = [];
    $produtosCriados = [];
    
    $mesesPt = [
        1 => 'Jan', 2 => 'Fev', 3 => 'Mar', 4 => 'Abr',
        5 => 'Mai', 6 => 'Jun', 7 => 'Jul', 8 => 'Ago',
        9 => 'Set', 10 => 'Out', 11 => 'Nov', 12 => 'Dez'
    ];
    
    for ($i = $months - 1; $i >= 0; $i--) {
        $date = date('Y-m-01', strtotime("-$i months"));
        $month = (int)date('m', strtotime($date));
        $year = date('Y', strtotime($date));
        
        $labels[] = $mesesPt[$month] ?? date('M', strtotime($date));
        
        // Contar utilizadores novos do mês
        $startDate = date('Y-m-01', strtotime($date));
        $endDate = date('Y-m-t', strtotime($date));
        
        $stmt = $conn->prepare("SELECT COUNT(*) as total FROM utilizadores WHERE DATE(Data_Registo) BETWEEN ? AND ? AND Ativo = 1");
        $stmt->bind_param("ss", $startDate, $endDate);
        $stmt->execute();
        $result = $stmt->get_result();
        $utilizadoresNovos[] = (int)($result->fetch_assoc()['total'] ?? 0);
        
        // Contar produtos criados do mês
        $stmt = $conn->prepare("SELECT COUNT(*) as total FROM produtos WHERE DATE(DataCriacao) BETWEEN ? AND ? AND DeletedAt IS NULL");
        $stmt->bind_param("ss", $startDate, $endDate);
        $stmt->execute();
        $result = $stmt->get_result();
        $produtosCriados[] = (int)($result->fetch_assoc()['total'] ?? 0);
    }
    
    echo json_encode([
        'labels' => $labels,
        'series' => [
            'utilizadoresNovos' => $utilizadoresNovos,
            'produtosCriados' => $produtosCriados
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

