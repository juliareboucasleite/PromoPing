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

// URLs base - Configurado para PromoPing
define('BASE_URL', $_ENV['BASE_URL'] ?? 'http://localhost/PromoPing/Painel_Administrativo/Painel_Administrativo');
define('DASHBOARD_URL', $_ENV['DASHBOARD_URL'] ?? BASE_URL . '/pages/dashboard.html');

// URL do backend Node.js PromoPing
define('BACKEND_API_URL', $_ENV['BACKEND_API_URL'] ?? 'http://127.0.0.1:3000/api');

// URLs de callback OAuth
define('GOOGLE_CALLBACK_URL', BASE_URL . '/auth/google_callback.php');
define('GITHUB_CALLBACK_URL', BASE_URL . '/auth/github_callback.php');

// Credenciais OAuth
define('GOOGLE_CLIENT_ID', $_ENV['GOOGLE_CLIENT_ID'] ?? '');
define('GOOGLE_CLIENT_SECRET', $_ENV['GOOGLE_CLIENT_SECRET'] ?? '');

define('GITHUB_CLIENT_ID', $_ENV['GITHUB_CLIENT_ID'] ?? '');
define('GITHUB_CLIENT_SECRET', $_ENV['GITHUB_CLIENT_SECRET'] ?? '');

// Configurações de Base de Dados MySQL
define('DB_HOST', $_ENV['DB_HOST'] ?? 'localhost');
define('DB_USER', $_ENV['DB_USER'] ?? 'root');
define('DB_PASSWORD', $_ENV['DB_PASSWORD'] ?? '');
define('DB_NAME', $_ENV['DB_NAME'] ?? 'pap');
define('DB_CHARSET', $_ENV['DB_CHARSET'] ?? 'utf8mb4');

/**
 * Conectar à base de dados MySQL
 * @return mysqli|null Retorna conexão MySQL ou null em caso de erro
 */
function getDBConnection(): ?mysqli {
    static $conn = null;
    
    if ($conn === null) {
        try {
            $conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
            
            if ($conn->connect_error) {
                error_log("Erro de conexão MySQL: " . $conn->connect_error);
                return null;
            }
            
            $conn->set_charset(DB_CHARSET);
        } catch (Exception $e) {
            error_log("Erro ao conectar MySQL: " . $e->getMessage());
            return null;
        }
    }
    
    return $conn;
}

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
 * Verificar se o usuário é admin (id=1 na base de dados)
 */
function isAdmin(): bool {
    $user = getLoggedUser();
    if (!$user || !isset($user['id'])) {
        return false;
    }
    
    $conn = getDBConnection();
    if (!$conn) {
        return false;
    }
    
    // Verificar se o usuário existe na base de dados e tem PerfilId=1 (Admin)
    $stmt = $conn->prepare("SELECT Id, PerfilId FROM utilizadores WHERE Id = ? AND PerfilId = 1");
    $userId = is_numeric($user['id']) ? (int)$user['id'] : null;
    
    if (!$userId) {
        // Se o ID da sessão não é numérico, tentar buscar por email
        $email = $user['email'] ?? '';
        if ($email) {
            $stmt = $conn->prepare("SELECT Id, PerfilId FROM utilizadores WHERE Email = ? AND PerfilId = 1");
            $stmt->bind_param("s", $email);
        } else {
            return false;
        }
    } else {
        $stmt->bind_param("i", $userId);
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    $admin = $result->fetch_assoc();
    
    return $admin !== null && isset($admin['PerfilId']) && $admin['PerfilId'] == 1;
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
 * Redirecionar para login se não for admin (id=1)
 */
function requireAdmin(): void {
    if (!isAuthenticated()) {
        header('Location: ' . BASE_URL . '/login.php?error=not_authenticated');
        exit;
    }
    
    if (!isAdmin()) {
        logout();
        header('Location: ' . BASE_URL . '/login.php?error=access_denied');
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

/**
 * Fazer requisição ao backend Node.js PromoPing
 * @param string $endpoint Endpoint da API (ex: '/user/me')
 * @param array $options Opções da requisição (method, headers, body)
 * @return array|false Resposta da API ou false em caso de erro
 */
function callBackendAPI(string $endpoint, array $options = []): array|false {
    $url = rtrim(BACKEND_API_URL, '/') . '/' . ltrim($endpoint, '/');
    
    $method = $options['method'] ?? 'GET';
    $headers = $options['headers'] ?? [];
    $body = $options['body'] ?? null;
    
    // Adicionar token JWT se disponível na sessão
    if (isset($_SESSION['jwt_token'])) {
        $headers['Authorization'] = 'Bearer ' . $_SESSION['jwt_token'];
    }
    
    // Configurar headers padrão
    $defaultHeaders = [
        'Content-Type' => 'application/json',
        'Accept' => 'application/json'
    ];
    $headers = array_merge($defaultHeaders, $headers);
    
    // Preparar contexto para file_get_contents ou usar cURL
    $contextOptions = [
        'http' => [
            'method' => $method,
            'header' => array_map(function($key, $value) {
                return "$key: $value";
            }, array_keys($headers), $headers),
            'content' => $body ? json_encode($body) : null,
            'ignore_errors' => true,
            'timeout' => 30
        ]
    ];
    
    // Usar cURL se disponível (mais confiável)
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array_map(function($key, $value) {
            return "$key: $value";
        }, array_keys($headers), $headers));
        
        if ($body) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        }
        
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            error_log("Erro cURL ao chamar backend: $error");
            return false;
        }
        
        if ($httpCode >= 400) {
            error_log("Erro HTTP $httpCode ao chamar backend: $response");
            return false;
        }
        
        $decoded = json_decode($response, true);
        return $decoded !== null ? $decoded : false;
    } else {
        // Fallback para file_get_contents
        $context = stream_context_create($contextOptions);
        $response = @file_get_contents($url, false, $context);
        
        if ($response === false) {
            error_log("Erro ao chamar backend API: $url");
            return false;
        }
        
        $decoded = json_decode($response, true);
        return $decoded !== null ? $decoded : false;
    }
}

/**
 * Obter configuração JavaScript para integração com backend
 * @return string Código JavaScript com configurações
 */
function getBackendJSConfig(): string {
    return sprintf(
        'window.PROMOPING_CONFIG = { backendAPI: "%s", baseURL: "%s" };',
        BACKEND_API_URL,
        BASE_URL
    );
}

