# 🚀 Guia de Deploy - PromoPing

## 📋 Pré-requisitos

### Para Desenvolvimento Local
- Node.js 18+ 
- MySQL 8.0+
- PHP 8.1+ (para APIs PHP)

### Para Produção
- Servidor Linux (Ubuntu 20.04+ recomendado)
- Node.js 18+
- MySQL 8.0+
- PHP 8.1+ com extensões:
  - php-mysqli
  - php-json
  - php-curl
  - php-mbstring
  - php-openssl
- Nginx (opcional, para proxy reverso)
- PM2 (para gerenciamento de processos)

## 🛠️ Instalação

### 1. Clonar o Repositório
```bash
git clone https://github.com/juliareboucasleite/Pap.git
cd Pap
```

### 2. Instalar Dependências
```bash
npm install
```

### 3. Configurar Variáveis de Ambiente
```bash
cp config/env.example .env
# Editar .env com suas configurações
```

### 4. Configurar Banco de Dados
```bash
# Criar banco de dados
mysql -u root -p < sql/promoping.sql

# Ou importar manualmente
mysql -u root -p
CREATE DATABASE promoping;
USE promoping;
SOURCE sql/promoping.sql;
```

## 🐳 Deploy com Docker

### Usando Docker Compose (Recomendado)
```bash
# Construir e iniciar todos os serviços
docker-compose up -d

# Verificar logs
docker-compose logs -f

# Parar serviços
docker-compose down
```

### Usando Dockerfile
```bash
# Construir imagem
docker build -t promoping .

# Executar container
docker run -p 80:80 -p 3000:3000 promoping
```

## 🚀 Deploy Manual

### 1. Preparar Servidor
```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar MySQL
sudo apt install mysql-server -y

# Instalar PHP
sudo apt install php8.1 php8.1-fpm php8.1-mysql php8.1-curl php8.1-json php8.1-mbstring -y

# Instalar PM2
sudo npm install -g pm2
```

### 2. Configurar Aplicação
```bash
# Clonar repositório
git clone https://github.com/juliareboucasleite/Pap.git
cd Pap

# Instalar dependências
npm install

# Configurar .env
cp config/env.example .env
nano .env
```

### 3. Configurar Banco de Dados
```bash
# Criar usuário e banco
sudo mysql
CREATE DATABASE promoping;
CREATE USER 'promoping'@'localhost' IDENTIFIED BY 'sua_senha_segura';
GRANT ALL PRIVILEGES ON promoping.* TO 'promoping'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Importar schema
mysql -u promoping -p promoping < sql/promoping.sql
```

### 4. Configurar Nginx (Opcional)
```bash
# Instalar Nginx
sudo apt install nginx -y

# Copiar configuração
sudo cp docker/nginx.conf /etc/nginx/sites-available/promoping
sudo ln -s /etc/nginx/sites-available/promoping /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. Iniciar Aplicação
```bash
# Usando PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# Ou usando script de deploy
chmod +x deploy.sh
./deploy.sh
```

## 🔧 Configurações de Produção

### Variáveis de Ambiente (.env)
```env
# Aplicação
APP_ENV=production
APP_URL=https://seu-dominio.com
JWT_SECRET=sua_chave_jwt_super_secreta

# Base de Dados
DB_HOST=localhost
DB_USER=promoping
DB_PASS=sua_senha_segura
DB_NAME=promoping

# Bots (opcional)
DISCORD_TOKEN=seu_token_discord
TELEGRAM_TOKEN=seu_token_telegram
TWILIO_ACCOUNT_SID=seu_twilio_sid
TWILIO_AUTH_TOKEN=seu_twilio_token
```

### Configurações de Segurança
- Use HTTPS em produção
- Configure firewall (portas 80, 443, 22)
- Use senhas fortes para banco de dados
- Configure rate limiting
- Monitore logs regularmente

## 📊 Monitoramento

### PM2
```bash
# Ver status
pm2 status

# Ver logs
pm2 logs

# Monitorar recursos
pm2 monit

# Reiniciar aplicação
pm2 restart promoping-api
```

### Logs
```bash
# Logs da aplicação
tail -f logs/combined.log

# Logs do Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Logs do MySQL
sudo tail -f /var/log/mysql/error.log
```

## 🔄 Atualizações

### Deploy de Atualizações
```bash
# Fazer backup
mysqldump -u promoping -p promoping > backup_$(date +%Y%m%d).sql

# Atualizar código
git pull origin main

# Instalar novas dependências
npm install

# Executar migrações (se houver)
mysql -u promoping -p promoping < sql/migrations.sql

# Reiniciar aplicação
pm2 restart promoping-api
```

## 🆘 Troubleshooting

### Problemas Comuns

1. **Erro de conexão com banco**
   - Verificar credenciais no .env
   - Verificar se MySQL está rodando
   - Verificar firewall

2. **Erro 500 no PHP**
   - Verificar logs do PHP-FPM
   - Verificar permissões de arquivos
   - Verificar extensões PHP instaladas

3. **Bot Discord não conecta**
   - Verificar token no .env
   - Verificar permissões do bot
   - Verificar logs da aplicação

4. **Frontend não carrega**
   - Verificar se arquivos estão na pasta frontend/
   - Verificar configuração do Nginx
   - Verificar logs do servidor

### Comandos Úteis
```bash
# Verificar status dos serviços
sudo systemctl status nginx
sudo systemctl status mysql
sudo systemctl status php8.1-fpm

# Reiniciar serviços
sudo systemctl restart nginx
sudo systemctl restart mysql
sudo systemctl restart php8.1-fpm

# Verificar portas em uso
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :3000
```

## 📞 Suporte

Para suporte técnico:
- GitHub Issues: [Criar issue](https://github.com/juliareboucasleite/Pap/issues)
- Email: suporte@promoping.com
- Discord: [Servidor PromoPing](https://discord.gg/promoping)
