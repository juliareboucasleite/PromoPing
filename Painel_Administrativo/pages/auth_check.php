<?php
/**
 * Arquivo de verificação de autenticação para páginas HTML
 * Inclua este arquivo no início de páginas HTML que precisam de proteção admin
 */

require_once __DIR__ . '/../config.php';

// Verificar se é admin
requireAdmin();

// Se chegou aqui, é admin - continuar com o carregamento da página HTML
// A página HTML deve incluir este arquivo no início antes de qualquer output

