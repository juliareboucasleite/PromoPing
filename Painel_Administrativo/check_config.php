<?php
/**
 * Script para verificar configuração OAuth
 * Acesse: http://localhost/PromoPing/Painel_Administrativo_Php/check_config.php
 */

require_once __DIR__ . '/config.php';

echo "<h1>Verificação de Configuração OAuth</h1>";
echo "<pre>";

echo "=== Verificação de Dependências ===\n";
echo "PHP Version: " . PHP_VERSION . "\n";
echo "Composer autoload: " . (file_exists(__DIR__ . '/vendor/autoload.php') ? '✓ Instalado' : '✗ Não encontrado') . "\n";
echo "\n";

if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    require_once __DIR__ . '/vendor/autoload.php';
    echo "=== Verificação de Bibliotecas ===\n";
    echo "league/oauth2-google: " . (class_exists('League\OAuth2\Client\Provider\Google') ? '✓ Instalado' : '✗ Não instalado') . "\n";
    echo "league/oauth2-github: " . (class_exists('League\OAuth2\Client\Provider\Github') ? '✓ Instalado' : '✗ Não instalado') . "\n";
    echo "vlucas/phpdotenv: " . (class_exists('Dotenv\Dotenv') ? '✓ Instalado' : '✗ Não instalado') . "\n";
    echo "\n";
}

echo "=== Verificação de Configuração ===\n";
echo "Arquivo .env: " . (file_exists(__DIR__ . '/.env') ? '✓ Existe' : '✗ Não encontrado') . "\n";
echo "BASE_URL: " . BASE_URL . "\n";
echo "DASHBOARD_URL: " . DASHBOARD_URL . "\n";
echo "GOOGLE_CALLBACK_URL: " . GOOGLE_CALLBACK_URL . "\n";
echo "GITHUB_CALLBACK_URL: " . GITHUB_CALLBACK_URL . "\n";
echo "\n";

echo "=== Credenciais OAuth ===\n";
echo "GOOGLE_CLIENT_ID: " . (empty(GOOGLE_CLIENT_ID) ? '✗ Não configurado' : '✓ Configurado (' . substr(GOOGLE_CLIENT_ID, 0, 10) . '...)') . "\n";
echo "GOOGLE_CLIENT_SECRET: " . (empty(GOOGLE_CLIENT_SECRET) ? '✗ Não configurado' : '✓ Configurado (' . substr(GOOGLE_CLIENT_SECRET, 0, 10) . '...)') . "\n";
echo "GITHUB_CLIENT_ID: " . (empty(GITHUB_CLIENT_ID) ? '✗ Não configurado' : '✓ Configurado (' . substr(GITHUB_CLIENT_ID, 0, 10) . '...)') . "\n";
echo "GITHUB_CLIENT_SECRET: " . (empty(GITHUB_CLIENT_SECRET) ? '✗ Não configurado' : '✓ Configurado (' . substr(GITHUB_CLIENT_SECRET, 0, 10) . '...)') . "\n";
echo "\n";

echo "=== Sessão ===\n";
echo "Status da sessão: " . (session_status() === PHP_SESSION_ACTIVE ? '✓ Ativa' : '✗ Não iniciada') . "\n";
if (session_status() === PHP_SESSION_ACTIVE) {
    echo "Usuário logado: " . (isAuthenticated() ? '✓ Sim' : '✗ Não') . "\n";
    if (isAuthenticated()) {
        $user = getLoggedUser();
        echo "Nome: " . ($user['name'] ?? 'N/A') . "\n";
        echo "Email: " . ($user['email'] ?? 'N/A') . "\n";
        echo "Provider: " . ($user['provider'] ?? 'N/A') . "\n";
    }
}
echo "\n";

echo "=== URLs de Teste ===\n";
echo "<a href='" . BASE_URL . "/login.php'>Página de Login</a>\n";
echo "<a href='" . BASE_URL . "/check_config.php'>Este script</a>\n";

echo "</pre>";

