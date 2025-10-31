<?php
/**
 * Callback OAuth GitHub
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../vendor/autoload.php';

use League\OAuth2\Client\Provider\Github;
use League\OAuth2\Client\Provider\Exception\IdentityProviderException;

try {
    // Verificar se as credenciais estão configuradas
    if (empty(GITHUB_CLIENT_ID) || empty(GITHUB_CLIENT_SECRET)) {
        throw new Exception('Configuração OAuth não encontrada');
    }
    
    // Verificar se há erro retornado pelo GitHub
    if (isset($_GET['error'])) {
        throw new Exception('Erro na autenticação: ' . $_GET['error']);
    }
    
    // Verificar state para prevenir CSRF
    if (empty($_GET['state']) || !isset($_SESSION['oauth2state']) || 
        $_GET['state'] !== $_SESSION['oauth2state']) {
        if (isset($_SESSION['oauth2state'])) {
            unset($_SESSION['oauth2state']);
        }
        throw new Exception('State inválido. Tente novamente.');
    }
    
    // Criar provider
    $provider = new Github([
        'clientId'     => GITHUB_CLIENT_ID,
        'clientSecret' => GITHUB_CLIENT_SECRET,
        'redirectUri'  => GITHUB_CALLBACK_URL,
    ]);
    
    // Obter token de acesso
    $token = $provider->getAccessToken('authorization_code', [
        'code' => $_GET['code']
    ]);
    
    // Obter dados do usuário
    $user = $provider->getResourceOwner($token);
    $userData = $user->toArray();
    
    // GitHub pode não retornar email diretamente, precisamos buscar via API
    $email = $userData['email'] ?? null;
    if (!$email) {
        // Tentar buscar email via API do GitHub
        try {
            $request = $provider->getAuthenticatedRequest(
                'GET',
                'https://api.github.com/user/emails',
                $token
            );
            $response = $provider->getParsedResponse($request);
            
            if (is_array($response) && !empty($response)) {
                // Encontrar email primário ou o primeiro disponível
                foreach ($response as $emailData) {
                    if (isset($emailData['primary']) && $emailData['primary']) {
                        $email = $emailData['email'];
                        break;
                    }
                    if (!$email && isset($emailData['email'])) {
                        $email = $emailData['email'];
                    }
                }
            }
        } catch (Exception $e) {
            error_log('Erro ao buscar email do GitHub: ' . $e->getMessage());
            // Usar username como fallback
            $email = ($userData['login'] ?? 'user') . '@github.local';
        }
    }
    
    // Construir URL da foto de perfil
    $picture = $userData['avatar_url'] ?? '';
    
    // Salvar dados do usuário na sessão
    saveUserSession([
        'id' => $userData['id'] ?? uniqid('github_'),
        'name' => $userData['name'] ?? $userData['login'] ?? 'Usuário GitHub',
        'email' => $email,
        'picture' => $picture,
        'provider' => 'github'
    ]);
    
    // Limpar state da sessão
    unset($_SESSION['oauth2state']);
    
    // Redirecionar para dashboard
    header('Location: ' . DASHBOARD_URL);
    exit;
    
} catch (IdentityProviderException $e) {
    // Erro do provider OAuth
    error_log('Erro OAuth GitHub: ' . $e->getMessage());
    header('Location: ' . BASE_URL . '/login.php?error=auth_failed');
    exit;
    
} catch (Exception $e) {
    // Outros erros
    error_log('Erro callback GitHub: ' . $e->getMessage());
    header('Location: ' . BASE_URL . '/login.php?error=auth_failed');
    exit;
}

