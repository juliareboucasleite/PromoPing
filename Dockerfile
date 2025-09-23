# Dockerfile para PromoPing
FROM node:18-alpine

# Instalar PHP e dependências
RUN apk add --no-cache \
    php81 \
    php81-fpm \
    php81-mysqli \
    php81-json \
    php81-curl \
    php81-mbstring \
    php81-openssl \
    nginx \
    supervisor

# Definir diretório de trabalho
WORKDIR /app

# Copiar package.json e instalar dependências Node.js
COPY package*.json ./
RUN npm ci --only=production

# Copiar código fonte
COPY . .

# Configurar PHP-FPM
RUN sed -i 's/;daemonize = yes/daemonize = no/' /etc/php81/php-fpm.conf
RUN sed -i 's/listen = 127.0.0.1:9000/listen = \/var\/run\/php-fpm.sock/' /etc/php81/php-fpm.d/www.conf

# Configurar Nginx
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Configurar Supervisor
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Criar diretórios necessários
RUN mkdir -p /var/log/supervisor /var/run/php-fpm

# Expor portas
EXPOSE 80 3000

# Comando de inicialização
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
