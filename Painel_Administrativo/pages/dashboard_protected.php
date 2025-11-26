<?php
/**
 * Dashboard protegido com verificação de autenticação
 * Use este arquivo como exemplo para proteger suas páginas
 */

require_once __DIR__ . '/../config.php';

// Verificar se o usuário está autenticado
requireAuth();

// Obter dados do usuário
$user = getLoggedUser();
?>
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  <title>Dashboard - PromoPing</title>

  <link id="pagestyle" href="../assets/css/soft-ui-dashboard.css?v=1.1.0" rel="stylesheet" />
</head>
<body class="g-sidenav-show bg-gray-100">
  <!-- Navbar com informações do usuário -->
  <nav class="navbar navbar-main navbar-expand-lg bg-transparent shadow-none position-absolute px-4 w-100 z-index-2">
    <div class="container-fluid py-1">
      <div class="collapse navbar-collapse me-md-0 me-sm-4 mt-sm-0 mt-2" id="navbar">
        <div class="ms-md-auto pe-md-3 d-flex align-items-center">
          <div class="d-flex align-items-center me-3">
            <?php if (!empty($user['picture'])): ?>
              <img src="<?php echo htmlspecialchars($user['picture']); ?>" 
                   alt="Avatar" 
                   class="avatar avatar-sm me-2 rounded-circle">
            <?php endif; ?>
            <span class="text-sm text-white">
              <?php echo htmlspecialchars($user['name'] ?? 'Usuário'); ?>
            </span>
          </div>
          <a href="../auth/logout.php" class="btn btn-sm btn-outline-white">
            <i class="fas fa-sign-out-alt me-1"></i>
            Sair
          </a>
        </div>
      </div>
    </div>
  </nav>
  
  <!-- Conteúdo do dashboard -->
  <div class="main-content position-relative max-height-vh-100 h-100">
    <div class="container-fluid py-4">
      <div class="row">
        <div class="col-12">
          <div class="card">
            <div class="card-header pb-0">
              <h6>Bem-vindo, <?php echo htmlspecialchars($user['name'] ?? 'Usuário'); ?>!</h6>
            </div>
            <div class="card-body">
              <p>Você está logado com <strong><?php echo htmlspecialchars($user['provider'] ?? 'desconhecido'); ?></strong></p>
              <p><strong>Email:</strong> <?php echo htmlspecialchars($user['email'] ?? 'N/A'); ?></p>
              <?php if (!empty($user['picture'])): ?>
                <p><strong>Foto:</strong> <img src="<?php echo htmlspecialchars($user['picture']); ?>" alt="Foto" class="rounded-circle" style="width: 50px; height: 50px;"></p>
              <?php endif; ?>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Scripts -->
  <script src="../assets/js/core/popper.min.js"></script>
  <script src="../assets/js/core/bootstrap.min.js"></script>
</body>
</html>

