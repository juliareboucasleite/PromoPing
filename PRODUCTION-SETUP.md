# Configuração de Produção - PromoPing

## Resumo Rápido

O projeto PromoPing foi configurado para rodar em produção com NGINX servindo o frontend estático e fazendo proxy reverso para o backend Node.js.

## Estrutura

- **Frontend**: Arquivos estáticos servidos pelo NGINX em `/var/www/promoping/frontend`
- **Backend**: API Node.js rodando na porta 3000, gerenciado pelo systemd
- **NGINX**: Proxy reverso que:
  - Serve frontend estático em `http://promoping.pt/`
  - Encaminha `/api/*` para o backend na porta 3000

## Arquivos Criados/Modificados

### Novos Arquivos

1. **`config-files/nginx-promoping.pt.conf`**
   - Configuração completa do NGINX para produção
   - Proxy reverso para `/api/`
   - Servir frontend estático
   - Rate limiting e segurança

2. **`scripts/prepare-frontend-production.js`**
   - Script para preparar frontend para produção
   - Remove/ajusta `base href`
   - Corrige caminhos da API

3. **`docs/DEPLOY-PRODUCTION.md`**
   - Guia completo de deploy
   - Instruções passo a passo
   - Troubleshooting

### Arquivos Modificados

1. **`backend/server.js`**
   - Detecta ambiente de produção
   - Não serve frontend estático em produção (NGINX faz isso)
   - Mantém compatibilidade com desenvolvimento

2. **`package.json`**
   - Adicionado script `prepare:frontend`

## Como Usar

### 1. Preparar Frontend

```bash
npm run prepare:frontend
```

### 2. Configurar NGINX

```bash
sudo cp config-files/nginx-promoping.pt.conf /etc/nginx/sites-available/promoping.pt
sudo ln -s /etc/nginx/sites-available/promoping.pt /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. Configurar Backend como Serviço

Ver instruções completas em `docs/DEPLOY-PRODUCTION.md`

## Variáveis de Ambiente Importantes

No arquivo `.env` de produção:

```env
NODE_ENV=production
PORT=3000
HOST=127.0.0.1

# O backend NÃO serve frontend em produção
# SERVE_FRONTEND=true  # Use apenas se quiser forçar o backend a servir frontend
```

## Verificação

- Frontend: `curl http://promoping.pt/`
- API: `curl http://promoping.pt/api/health`
- Logs NGINX: `sudo tail -f /var/log/nginx/promoping-error.log`
- Logs Backend: `sudo journalctl -u promoping -f`

## Documentação Completa

Consulte `docs/DEPLOY-PRODUCTION.md` para instruções detalhadas.

