<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <link rel="apple-touch-icon" sizes="76x76" href="assets/img/promoping/PromoPing.png">
    <link rel="icon" type="image/png" href="assets/img/promoping/PromoPing.png">
    <title>Login - PromoPing</title>
    <!-- Fonts and icons -->
    <link href="https://fonts.googleapis.com/css?family=Inter:300,400,500,600,700,800" rel="stylesheet" />
    <!-- Font Awesome Icons -->
    <script src="https://kit.fontawesome.com/42d5adcbca.js" crossorigin="anonymous"></script>
    <!-- CSS Files -->
    <link id="pagestyle" href="assets/css/soft-ui-dashboard.css?v=1.1.0" rel="stylesheet" />
    <style>
        .oauth-btn {
            transition: all 0.3s ease;
            border: 1px solid #e0e0e0;
        }
        .oauth-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .github-btn {
            background-color: #24292e;
            color: white;
            border-color: #24292e;
        }
        .github-btn:hover {
            background-color: #181b1f;
            color: white;
        }
        .google-btn {
            background-color: white;
            color: #757575;
        }
        .google-btn:hover {
            background-color: #f5f5f5;
        }
    </style>
</head>
<body>
    <?php
    require_once __DIR__ . '/config.php';
    
    // Se já estiver logado, verificar se é admin antes de redirecionar
    if (isAuthenticated()) {
        if (!isAdmin()) {
            // Não é admin - fazer logout e mostrar erro
            logout();
            header('Location: ' . BASE_URL . '/login.php?error=access_denied');
            exit;
        }
        header('Location: ' . DASHBOARD_URL);
        exit;
    }
    
    // Verificar erros
    $error = $_GET['error'] ?? null;
    ?>
    
    <main class="main-content mt-0">
        <section class="min-vh-100 mb-8">
            <div class="page-header align-items-start min-vh-50 pt-5 pb-11 m-3 border-radius-lg" 
                 style="background-image: url('assets/img/curved-images/curved14.jpg');">
                <span class="mask bg-gradient-dark opacity-6"></span>
                <div class="container">
                    <div class="row justify-content-center">
                        <div class="col-lg-5 text-center mx-auto">
                            <h1 class="text-white mb-2 mt-5">Bem-vindo!</h1>
                            <p class="text-lead text-white">Faça login para acessar o painel administrativo</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="container">
                <div class="row mt-lg-n10 mt-md-n11 mt-n10">
                    <div class="col-xl-4 col-lg-5 col-md-7 mx-auto">
                        <div class="card z-index-0">
                            <div class="card-header text-center pt-4">
                                <h5>Entrar com</h5>
                            </div>
                            <div class="card-body">
                                <?php if ($error): ?>
                                    <div class="alert alert-danger alert-dismissible fade show" role="alert">
                                        <span class="alert-icon"><i class="ni ni-like-2"></i></span>
                                        <span class="alert-text">
                                            <?php 
                                            echo match($error) {
                                                'auth_failed' => 'Falha na autenticação. Tente novamente.',
                                                'config_missing' => 'Configuração OAuth não encontrada. Verifique as variáveis de ambiente.',
                                                'access_denied' => 'Acesso negado. Apenas administradores podem acessar o painel.',
                                                'not_authenticated' => 'Você precisa fazer login para acessar esta página.',
                                                default => 'Erro desconhecido. Tente novamente.'
                                            };
                                            ?>
                                        </span>
                                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close">
                                            <span aria-hidden="true">&times;</span>
                                        </button>
                                    </div>
                                <?php endif; ?>
                                
                                <div class="d-grid gap-2 mb-4">
                                    <!-- Botão GitHub -->
                                    <a href="<?php echo BASE_URL; ?>/auth/github_login.php" 
                                       class="btn btn-lg oauth-btn github-btn d-flex align-items-center justify-content-center">
                                        <i class="fab fa-github me-2 fs-5"></i>
                                        <span>Entrar com GitHub</span>
                                    </a>
                                    
                                    <!-- Botão Google -->
                                    <a href="<?php echo BASE_URL; ?>/auth/google_login.php" 
                                       class="btn btn-lg oauth-btn google-btn d-flex align-items-center justify-content-center">
                                        <svg width="20" height="20" viewBox="0 0 24 24" class="me-2">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                        </svg>
                                        <span>Entrar com Google</span>
                                    </a>
                                </div>
                                
                                <div class="text-center">
                                    <p class="text-sm text-secondary mb-0">
                                        Ao fazer login, você concorda com nossos 
                                        <a href="#" class="text-dark font-weight-bolder">Termos de Uso</a>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </main>
    
    <!-- Core JS Files -->
    <script src="assets/js/core/popper.min.js"></script>
    <script src="assets/js/core/bootstrap.min.js"></script>
    <script src="assets/js/plugins/perfect-scrollbar.min.js"></script>
    <script src="assets/js/plugins/smooth-scrollbar.min.js"></script>
    <script src="assets/js/soft-ui-dashboard.min.js?v=1.1.0"></script>
</body>
</html>

