<?php
/**
 * Iniciar autenticação OAuth com GitHub
 */

require_once __DIR__ . '/../config.php';

// Verificar se as credenciais estão configuradas
if (empty(GITHUB_CLIENT_ID) || empty(GITHUB_CLIENT_SECRET)) {
    header('Location: ' . BASE_URL . '/login.php?error=config_missing');
    exit;
}

require_once __DIR__ . '/../vendor/autoload.php';

use League\OAuth2\Client\Provider\Github;

// Criar provider GitHub
$provider = new Github([
    'clientId'     => GITHUB_CLIENT_ID,
    'clientSecret' => GITHUB_CLIENT_SECRET,
    'redirectUri'  => GITHUB_CALLBACK_URL,
]);

// Obter URL de autorização
$authUrl = $provider->getAuthorizationUrl([
    'scope' => ['user:email']
]);

// Armazenar state na sessão para verificação
$_SESSION['oauth2state'] = $provider->getState();

// Redirecionar para GitHub
header('Location: ' . $authUrl);
exit;

