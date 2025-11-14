# Rotas do Frontend - PromoPing

Este documento lista todas as rotas do frontend configuradas no backend.

## Rotas de Autenticação

- `GET /login` → Página de login
- `GET /register` → Página de registro
- `GET /forgot-password` → Página de recuperação de senha
- `GET /inc/Login.html` → Compatibilidade (redireciona para login)
- `GET /inc/register.html` → Compatibilidade (redireciona para register)
- `GET /inc/forgot-password.html` → Compatibilidade (redireciona para forgot-password)
- `GET /business/create/login` → Rota alternativa para login
- `GET /business/create/registar` → Rota alternativa para registro

## Rotas do Dashboard

- `GET /dashboard` → Painel principal do dashboard
- `GET /dashboard/painel` → Painel principal (alternativa)
- `GET /dashboard/perfil` → Página de perfil do usuário
- `GET /dashboard/planos` → Página de planos/subscrições
- `GET /dashboard/produtos` → Página de produtos monitorizados
- `GET /dashboard/Painel.html` → Compatibilidade (com .html)
- `GET /dashboard/perfil.html` → Compatibilidade (com .html)
- `GET /dashboard/planos.html` → Compatibilidade (com .html)
- `GET /dashboard/produtos.html` → Compatibilidade (com .html)

## Rotas de Páginas Principais

- `GET /` → Página inicial (index.html)
- `GET /monitoramento` → Página sobre monitoramento
- `GET /alertas` → Página sobre alertas
- `GET /relatorios` → Página sobre relatórios
- `GET /casos-uso` → Página de casos de uso
- `GET /blog` → Página do blog

## Rotas About

- `GET /about` → Página sobre o PromoPing
- `GET /about/alertas` → Sobre alertas
- `GET /about/blog` → Sobre o blog
- `GET /about/casos-uso` → Sobre casos de uso
- `GET /about/monitoramento` → Sobre monitoramento
- `GET /about/relatorios` → Sobre relatórios
- `GET /about/privacy-cookies` → Política de privacidade e cookies

## Rotas de Documentação

- `GET /docs` → Página principal de documentação
- `GET /docs/support` → Suporte
- `GET /docs/service-status` → Status do serviço
- `GET /docs/terms` → Termos de serviço
- `GET /docs/usage-guide` → Guia de uso
- `GET /docs/api-reference` → Referência da API
- `GET /docs/FirstLaunch` → Primeiro lançamento
- `GET /docs/faq` → Perguntas frequentes
- `GET /docs/changelog` → Changelog
- `GET /docs/privacy` → Privacidade
- `GET /docs/installation` → Instalação
- `GET /docs/incident-history` → Histórico de incidentes
- `GET /docs/security-headers` → Cabeçalhos de segurança

## Rotas de Includes (Assets)

- `GET /inc/header.html` → Header HTML
- `GET /inc/header-login.html` → Header para login
- `GET /inc/header-register.html` → Header para registro
- `GET /inc/footer.html` → Footer HTML
- `GET /inc/load-includes.js` → Script de carregamento de includes
- `GET /inc/load-includes-index.js` → Script para index
- `GET /inc/load-includes-login.js` → Script para login
- `GET /inc/load-includes-register.js` → Script para registro

## Rotas de OAuth

- `GET /auth/discord` → Redireciona para `/api/auth/discord`
- `GET /auth/discord/callback` → Callback do Discord OAuth

## Rotas de API

Todas as rotas de API começam com `/api/`:

- `POST /api/auth/register` → Registro de usuário
- `POST /api/auth/login` → Login de usuário
- `GET /api/auth/me` → Dados do usuário atual
- `GET /api/health` → Health check
- E muitas outras (ver `backend/routes/`)

## Configuração CORS

O CORS está configurado para permitir requisições de:

### Desenvolvimento:
- `http://localhost:*` (qualquer porta)
- `http://127.0.0.1:*` (qualquer porta)
- IPs locais (192.168.x.x, 10.x.x.x, 172.16-31.x.x)

### Produção:
- `http://promoping.pt`
- `https://promoping.pt`
- `http://www.promoping.pt`
- `https://www.promoping.pt`
- Domínios configurados em `.env` (FRONTEND_URL, ALLOWED_ORIGINS)

## Estrutura de Arquivos

As rotas servem arquivos da pasta `frontend/pages/build/` quando disponível, ou fazem fallback para `frontend/pages/` se a pasta build não existir.

## Notas

- Todas as rotas HTML fazem fallback para `index.html` se o arquivo não for encontrado (SPA behavior)
- Arquivos estáticos (CSS, JS, imagens) são servidos diretamente sem fallback
- Em produção, o NGINX serve o frontend estático e o backend apenas responde a `/api/*`

