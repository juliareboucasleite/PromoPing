<?php
/**
 * API Endpoint: Status e Métricas do Sistema
 * Retorna estatísticas gerais do PromoPing
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config.php';

// Verificar autenticação (opcional, pode remover se não precisar)
// requireAuth();

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
    // Contar utilizadores ativos
    $stmt = $conn->prepare("SELECT COUNT(*) as total FROM utilizadores WHERE Ativo = 1");
    $stmt->execute();
    $result = $stmt->get_result();
    $utilizadoresAtivos = $result->fetch_assoc()['total'] ?? 0;
    
    // Contar produtos monitorizados (não deletados)
    $stmt = $conn->prepare("SELECT COUNT(*) as total FROM produtos WHERE DeletedAt IS NULL");
    $stmt->execute();
    $result = $stmt->get_result();
    $produtosMonitorizados = $result->fetch_assoc()['total'] ?? 0;
    
    // Contar notificações enviadas hoje
    $stmt = $conn->prepare("SELECT COUNT(*) as total FROM notificacoes WHERE DATE(DataEnvio) = CURDATE()");
    $stmt->execute();
    $result = $stmt->get_result();
    $notificacoesHoje = $result->fetch_assoc()['total'] ?? 0;
    
    // Buscar métricas do sistema se a tabela existir
    $uptime = 99.9;
    $tempoResposta = 45;
    
    try {
        $stmt = $conn->prepare("SELECT UptimeGeral, TempoRespostaMedia FROM metricas_sistema ORDER BY Id DESC LIMIT 1");
        if ($stmt) {
            $stmt->execute();
            $result = $stmt->get_result();
            if ($row = $result->fetch_assoc()) {
                $uptime = floatval($row['UptimeGeral'] ?? 99.9);
                $tempoResposta = floatval($row['TempoRespostaMedia'] ?? 45);
            }
        }
    } catch (Exception $e) {
        // Tabela pode não existir, usar valores padrão
    }
    
    // Calcular crescimento (comparar com semana passada)
    $stmt = $conn->prepare("SELECT COUNT(*) as total FROM utilizadores WHERE Ativo = 1 AND Data_Registo >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)");
    $stmt->execute();
    $result = $stmt->get_result();
    $utilizadoresSemana = $result->fetch_assoc()['total'] ?? 0;
    
    $stmt = $conn->prepare("SELECT COUNT(*) as total FROM utilizadores WHERE Ativo = 1 AND Data_Registo >= DATE_SUB(CURDATE(), INTERVAL 14 DAY) AND Data_Registo < DATE_SUB(CURDATE(), INTERVAL 7 DAY)");
    $stmt->execute();
    $result = $stmt->get_result();
    $utilizadoresSemanaAnterior = $result->fetch_assoc()['total'] ?? 0;
    
    $crescimentoSemanal = $utilizadoresSemanaAnterior > 0 
        ? round((($utilizadoresSemana - $utilizadoresSemanaAnterior) / $utilizadoresSemanaAnterior) * 100, 1)
        : ($utilizadoresSemana > 0 ? 100 : 0);
    
    // Calcular crescimento mensal
    $stmt = $conn->prepare("SELECT COUNT(*) as total FROM utilizadores WHERE Ativo = 1 AND Data_Registo >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)");
    $stmt->execute();
    $result = $stmt->get_result();
    $utilizadoresMes = $result->fetch_assoc()['total'] ?? 0;
    
    $stmt = $conn->prepare("SELECT COUNT(*) as total FROM utilizadores WHERE Ativo = 1 AND Data_Registo >= DATE_SUB(CURDATE(), INTERVAL 60 DAY) AND Data_Registo < DATE_SUB(CURDATE(), INTERVAL 30 DAY)");
    $stmt->execute();
    $result = $stmt->get_result();
    $utilizadoresMesAnterior = $result->fetch_assoc()['total'] ?? 0;
    
    $crescimentoMensal = $utilizadoresMesAnterior > 0 
        ? round((($utilizadoresMes - $utilizadoresMesAnterior) / $utilizadoresMesAnterior) * 100, 1)
        : ($utilizadoresMes > 0 ? 100 : 0);
    
    echo json_encode([
        'status' => 'ok',
        'metricas' => [
            'UtilizadoresAtivos' => (int)$utilizadoresAtivos,
            'TotalUsuarios' => (int)$utilizadoresAtivos,
            'ProdutosMonitorizados' => (int)$produtosMonitorizados,
            'TotalProdutos' => (int)$produtosMonitorizados,
            'NotificacoesEnviadas' => (int)$notificacoesHoje,
            'UptimeGeral' => $uptime,
            'TempoRespostaMedia' => $tempoResposta,
            'CrescimentoSemanal' => $crescimentoSemanal,
            'CrescimentoMensal' => $crescimentoMensal,
            'TaxaCrescimento' => $crescimentoMensal,
            'TaxaCrescimentoUsuarios' => $crescimentoSemanal
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Erro ao buscar métricas: ' . $e->getMessage()
    ]);
}

$conn->close();

