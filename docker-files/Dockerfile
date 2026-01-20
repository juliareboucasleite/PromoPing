# Dockerfile para PromoPing
FROM node:18-alpine

# Instalar dependências
RUN apk add --no-cache \
    nginx \
    supervisor

# Definir diretório de trabalho
WORKDIR /app

# Copiar package.json e instalar dependências Node.js
COPY package*.json ./
RUN npm ci --only=production

# Copiar código fonte
COPY . .

# Configurar Nginx
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Configurar Supervisor
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Criar diretórios necessários
RUN mkdir -p /var/log/supervisor

# Expor portas
EXPOSE 80 3000

# Comando de inicialização
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
