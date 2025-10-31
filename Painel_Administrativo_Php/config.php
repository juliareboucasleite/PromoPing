<?php
/**
 * Configuração OAuth para PromoPing
 * Requer PHP 8.0+
 */

// Iniciar sessão se ainda não estiver iniciada
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Carregar variáveis de ambiente
if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    require_once __DIR__ . '/vendor/autoload.php';
}

/**
 * Carregar arquivo .env usando Dotenv se disponível
 * @param string $path Caminho do diretório onde está o .env
 * @return void
 */
function loadDotEnv(string $path): void {
    if (class_exists('\Dotenv\Dotenv')) {
        // Usar call_user_func para evitar erro de tipo estático do Intelephense
        $dotenv = call_user_func(['\Dotenv\Dotenv', 'createImmutable'], $path);
        $dotenv->load();
    } else {
        // Fallback: carregar .env manualmente se Dotenv não estiver disponível
        $envFile = $path . '/.env';
        if (is_readable($envFile)) {
            $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                if (strpos(trim($line), '#') === 0) {
                    continue; // Ignorar comentários
                }
                if (strpos($line, '=') !== false) {
                    list($key, $value) = explode('=', $line, 2);
                    $key = trim($key);
                    $value = trim($value);
                    // Remover aspas se presentes
                    if ((substr($value, 0, 1) === '"' && substr($value, -1) === '"') ||
                        (substr($value, 0, 1) === "'" && substr($value, -1) === "'")) {
                        $value = substr($value, 1, -1);
                    }
                    if (!array_key_exists($key, $_ENV)) {
                        $_ENV[$key] = $value;
                        putenv("$key=$value");
                    }
                }
            }
        }
    }
}

// Carregar .env se existir
if (file_exists(__DIR__ . '/.env')) {
    loadDotEnv(__DIR__);
}

// Configurações de sessão
define('SESSION_NAME', $_ENV['SESSION_NAME'] ?? 'promoping_session');
define('SESSION_LIFETIME', (int)($_ENV['SESSION_LIFETIME'] ?? 86400));

// URLs base
define('BASE_URL', $_ENV['BASE_URL'] ?? 'http://localhost/PromoPing/Painel_Administrativo_Php');
define('DASHBOARD_URL', $_ENV['DASHBOARD_URL'] ?? BASE_URL . '/pages/dashboard.html');

// URLs de callback OAuth
define('GOOGLE_CALLBACK_URL', BASE_URL . '/auth/google_callback.php');
define('GITHUB_CALLBACK_URL', BASE_URL . '/auth/github_callback.php');

// Credenciais OAuth
define('GOOGLE_CLIENT_ID', $_ENV['GOOGLE_CLIENT_ID'] ?? '');
define('GOOGLE_CLIENT_SECRET', $_ENV['GOOGLE_CLIENT_SECRET'] ?? '');

define('GITHUB_CLIENT_ID', $_ENV['GITHUB_CLIENT_ID'] ?? '');
define('GITHUB_CLIENT_SECRET', $_ENV['GITHUB_CLIENT_SECRET'] ?? '');

/**
 * Verificar se o usuário está autenticado
 */
function isAuthenticated(): bool {
    return isset($_SESSION['user']) && !empty($_SESSION['user']);
}

/**
 * Obter dados do usuário logado
 */
function getLoggedUser(): ?array {
    return $_SESSION['user'] ?? null;
}

/**
 * Fazer logout
 */
function logout(): void {
    $_SESSION = [];
    if (isset($_COOKIE[session_name()])) {
        setcookie(session_name(), '', time() - 3600, '/');
    }
    session_destroy();
}

/**
 * Redirecionar para login se não estiver autenticado
 */
function requireAuth(): void {
    if (!isAuthenticated()) {
        header('Location: ' . BASE_URL . '/login.php');
        exit;
    }
}

/**
 * Salvar dados do usuário na sessão
 */
function saveUserSession(array $userData): void {
    $_SESSION['user'] = [
        'id' => $userData['id'] ?? null,
        'name' => $userData['name'] ?? '',
        'email' => $userData['email'] ?? '',
        'picture' => $userData['picture'] ?? '',
        'provider' => $userData['provider'] ?? '', // 'google' ou 'github'
        'login_time' => time()
    ];
}

