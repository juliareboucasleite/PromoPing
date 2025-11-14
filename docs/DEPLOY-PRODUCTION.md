# Guia de Deploy em Produção - PromoPing

Este guia descreve como configurar o PromoPing para rodar em produção usando NGINX como proxy reverso.

## Arquitetura de Produção

```
┌─────────────────┐
│   Cliente       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   NGINX (80)    │
│  promoping.pt   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────────┐
│Frontend│ │  Backend     │
│Estático│ │  Node.js:3000│
└────────┘ └──────────────┘
```

- **http://promoping.pt/** → NGINX serve frontend estático
- **http://promoping.pt/api/** → NGINX encaminha para backend Node.js (porta 3000)

## Pré-requisitos

- Servidor Linux (Ubuntu/Debian recomendado)
- Node.js 18+ instalado
- NGINX instalado
- MySQL/MariaDB instalado e configurado
- Domínio `promoping.pt` apontando para o servidor

## Passo 1: Preparar o Frontend

Execute o script de preparação do frontend:

```bash
npm run prepare:frontend
```

Este script:
- Remove/ajusta os `base href` nos arquivos HTML
- Corrige caminhos da API em arquivos JavaScript
- Cria arquivo de configuração de produção

## Passo 2: Copiar Arquivos para o Servidor

### Frontend

```bash
# Criar diretório no servidor
sudo mkdir -p /var/www/promoping

# Copiar frontend (do seu ambiente de desenvolvimento)
sudo cp -r frontend/* /var/www/promoping/frontend/

# Ajustar permissões
sudo chown -R www-data:www-data /var/www/promoping
sudo chmod -R 755 /var/www/promoping
```

### Backend

```bash
# Criar diretório para o backend
sudo mkdir -p /opt/promoping

# Copiar todo o projeto (ou apenas backend + arquivos necessários)
sudo cp -r . /opt/promoping/

# Instalar dependências
cd /opt/promoping
sudo npm install --production
```

## Passo 3: Configurar Variáveis de Ambiente

Crie/edite o arquivo `.env` em `/opt/promoping/.env`:

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=3000

# Base de dados
DB_HOST=localhost
DB_PORT=3306
DB_USER=promoping_user
DB_PASS=sua_senha_segura
DB_NAME=promoping

# JWT
JWT_SECRET=sua_chave_secreta_muito_forte_aqui

# URLs
FRONTEND_URL=https://promoping.pt
ALLOWED_ORIGINS=https://promoping.pt,https://www.promoping.pt

# Outras configurações necessárias
# (Stripe, Discord, Email, etc.)
```

**Importante:** Em produção, o backend NÃO serve o frontend estático. O NGINX faz isso.

## Passo 4: Configurar NGINX

### 4.1. Copiar Configuração

```bash
sudo cp config-files/nginx-promoping.pt.conf /etc/nginx/sites-available/promoping.pt
sudo ln -s /etc/nginx/sites-available/promoping.pt /etc/nginx/sites-enabled/
```

### 4.2. Ajustar Caminhos

Edite `/etc/nginx/sites-available/promoping.pt` e ajuste se necessário:

```nginx
root /var/www/promoping/frontend;  # Verificar se está correto
```

### 4.3. Testar Configuração

```bash
sudo nginx -t
```

### 4.4. Reiniciar NGINX

```bash
sudo systemctl restart nginx
```

## Passo 5: Configurar Backend como Serviço

Crie um arquivo de serviço systemd em `/etc/systemd/system/promoping.service`:

```ini
[Unit]
Description=PromoPing Backend API
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/promoping
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node backend/server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=promoping

[Install]
WantedBy=multi-user.target
```

Ativar e iniciar o serviço:

```bash
sudo systemctl daemon-reload
sudo systemctl enable promoping
sudo systemctl start promoping
```

Verificar status:

```bash
sudo systemctl status promoping
```

## Passo 6: Configurar SSL/HTTPS (Opcional mas Recomendado)

### Usando Certbot (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d promoping.pt -d www.promoping.pt
```

Após obter o certificado, descomente a seção HTTPS no arquivo de configuração do NGINX.

## Passo 7: Verificar Funcionamento

### Testar Frontend

```bash
curl http://promoping.pt/
```

### Testar API

```bash
curl http://promoping.pt/api/health
```

### Verificar Logs

**NGINX:**
```bash
sudo tail -f /var/log/nginx/promoping-access.log
sudo tail -f /var/log/nginx/promoping-error.log
```

**Backend:**
```bash
sudo journalctl -u promoping -f
```

## Estrutura de Diretórios em Produção

```
/var/www/promoping/
└── frontend/          # Arquivos estáticos do frontend
    ├── pages/
    ├── assets/
    └── ...

/opt/promoping/
├── backend/           # Código do backend
├── .env               # Variáveis de ambiente
├── package.json
└── ...
```

## Troubleshooting

### Backend não inicia

1. Verificar logs: `sudo journalctl -u promoping -n 50`
2. Verificar variáveis de ambiente no `.env`
3. Verificar se a porta 3000 está livre: `sudo netstat -tlnp | grep 3000`
4. Verificar conexão com banco de dados

### NGINX retorna 502 Bad Gateway

1. Verificar se o backend está rodando: `sudo systemctl status promoping`
2. Verificar se o backend está escutando na porta 3000: `curl http://127.0.0.1:3000/api/health`
3. Verificar logs do NGINX: `sudo tail -f /var/log/nginx/promoping-error.log`

### Frontend não carrega

1. Verificar permissões: `sudo ls -la /var/www/promoping/frontend`
2. Verificar se o caminho no NGINX está correto
3. Verificar logs do NGINX

### API retorna CORS errors

1. Verificar `ALLOWED_ORIGINS` no `.env`
2. Verificar headers do NGINX (X-Forwarded-*)

## Atualizações

Para atualizar o sistema em produção:

```bash
# 1. Parar o serviço
sudo systemctl stop promoping

# 2. Fazer backup
sudo cp -r /opt/promoping /opt/promoping.backup.$(date +%Y%m%d)

# 3. Atualizar código (git pull, etc.)
cd /opt/promoping
git pull  # ou copiar novos arquivos

# 4. Instalar dependências
npm install --production

# 5. Executar migrações (se houver)
npm run migrate

# 6. Preparar frontend (se houver mudanças)
npm run prepare:frontend
sudo cp -r frontend/* /var/www/promoping/frontend/

# 7. Reiniciar serviço
sudo systemctl start promoping

# 8. Verificar logs
sudo journalctl -u promoping -f
```

## Segurança

- ✅ Use HTTPS em produção
- ✅ Mantenha o Node.js e dependências atualizados
- ✅ Use senhas fortes para banco de dados
- ✅ Configure firewall (UFW) para permitir apenas portas necessárias
- ✅ Monitore logs regularmente
- ✅ Faça backups regulares do banco de dados

## Monitoramento

Considere usar ferramentas como:
- PM2 para gerenciamento de processos (alternativa ao systemd)
- Logrotate para gerenciar logs
- Monitoramento de uptime (UptimeRobot, etc.)

## Suporte

Para problemas ou dúvidas, consulte:
- Logs do sistema
- Documentação do NGINX
- Documentação do Node.js/Express

