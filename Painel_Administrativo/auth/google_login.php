<?php
/**
 * Iniciar autenticação OAuth com Google
 */

require_once __DIR__ . '/../config.php';

// Verificar se as credenciais estão configuradas
if (empty(GOOGLE_CLIENT_ID) || empty(GOOGLE_CLIENT_SECRET)) {
    header('Location: ' . BASE_URL . '/login.php?error=config_missing');
    exit;
}

require_once __DIR__ . '/../vendor/autoload.php';

use League\OAuth2\Client\Provider\Google;

// Criar provider Google
$provider = new Google([
    'clientId'     => GOOGLE_CLIENT_ID,
    'clientSecret' => GOOGLE_CLIENT_SECRET,
    'redirectUri'  => GOOGLE_CALLBACK_URL,
    'scopes'       => ['openid', 'email', 'profile'],
]);

// Obter URL de autorização
$authUrl = $provider->getAuthorizationUrl();

// Armazenar state na sessão para verificação
$_SESSION['oauth2state'] = $provider->getState();

// Redirecionar para Google
header('Location: ' . $authUrl);
exit;

