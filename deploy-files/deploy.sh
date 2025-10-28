#!/bin/bash

# Script de Deploy para PromoPing
echo " Iniciando deploy do PromoPing..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para log
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    error "Execute este script no diretório raiz do projeto"
fi

# Verificar se .env existe
if [ ! -f ".env" ]; then
    warning ".env não encontrado, copiando de config/env.example"
    cp config/env.example .env
fi

# Instalar dependências
log "Instalando dependências..."
npm ci --only=production

# Verificar se MySQL está rodando
log "Verificando conexão com MySQL..."
if ! mysqladmin ping -h"${DB_HOST:-localhost}" -u"${DB_USER:-root}" -p"${DB_PASS:-}" --silent; then
    error "MySQL não está acessível. Verifique as configurações de banco de dados."
fi

# Executar migrações (se houver)
if [ -f "sql/migrations.sql" ]; then
    log "Executando migrações..."
    mysql -h"${DB_HOST:-localhost}" -u"${DB_USER:-root}" -p"${DB_PASS:-}" "${DB_NAME:-promoping}" < sql/migrations.sql
fi

# Criar diretórios necessários
log "Criando diretórios..."
mkdir -p logs uploads

# Parar processos existentes
log "Parando processos existentes..."
pm2 stop promoping-api 2>/dev/null || true

# Iniciar aplicação
log "Iniciando aplicação..."
pm2 start ecosystem.config.js --env production

# Verificar status
log "Verificando status da aplicação..."
pm2 status

# Testar endpoints
log "Testando endpoints..."
sleep 5

if curl -f http://localhost:3000 > /dev/null 2>&1; then
    log " Frontend funcionando"
else
    error " Frontend não está respondendo"
fi

if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    log " API funcionando"
else
    warning " API não está respondendo (pode ser normal se não implementado)"
fi

log " Deploy concluído com sucesso!"
log " Frontend: http://localhost:3000"
log " API: http://localhost:3000/api/"
log " Monitor: pm2 monit"
