<?php
/**
 * Logout do usuário
 */

require_once __DIR__ . '/../config.php';

// Fazer logout
logout();

// Redirecionar para login
header('Location: ' . BASE_URL . '/login.php');
exit;

