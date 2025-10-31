<?php
/**
 * Callback OAuth Google
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../vendor/autoload.php';

use League\OAuth2\Client\Provider\Google;
use League\OAuth2\Client\Provider\Exception\IdentityProviderException;

try {
    // Verificar se as credenciais estão configuradas
    if (empty(GOOGLE_CLIENT_ID) || empty(GOOGLE_CLIENT_SECRET)) {
        throw new Exception('Configuração OAuth não encontrada');
    }
    
    // Verificar se há erro retornado pelo Google
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
    $provider = new Google([
        'clientId'     => GOOGLE_CLIENT_ID,
        'clientSecret' => GOOGLE_CLIENT_SECRET,
        'redirectUri'  => GOOGLE_CALLBACK_URL,
    ]);
    
    // Obter token de acesso
    $token = $provider->getAccessToken('authorization_code', [
        'code' => $_GET['code']
    ]);
    
    // Obter dados do usuário
    $user = $provider->getResourceOwner($token);
    $userData = $user->toArray();
    
    // Salvar dados do usuário na sessão
    saveUserSession([
        'id' => $userData['sub'] ?? $userData['id'] ?? uniqid('google_'),
        'name' => $userData['name'] ?? '',
        'email' => $userData['email'] ?? '',
        'picture' => $userData['picture'] ?? '',
        'provider' => 'google'
    ]);
    
    // Limpar state da sessão
    unset($_SESSION['oauth2state']);
    
    // Redirecionar para dashboard
    header('Location: ' . DASHBOARD_URL);
    exit;
    
} catch (IdentityProviderException $e) {
    // Erro do provider OAuth
    error_log('Erro OAuth Google: ' . $e->getMessage());
    header('Location: ' . BASE_URL . '/login.php?error=auth_failed');
    exit;
    
} catch (Exception $e) {
    // Outros erros
    error_log('Erro callback Google: ' . $e->getMessage());
    header('Location: ' . BASE_URL . '/login.php?error=auth_failed');
    exit;
}

