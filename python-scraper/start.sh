#!/bin/bash

# Script de inicialização do PromoPing Python Scraper
# Este script pode ser executado independentemente do sistema Node.js

echo "🚀 Iniciando PromoPing Python Scraper..."

# Verificar se Python está instalado
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 não está instalado. Por favor, instale Python 3.8 ou superior."
    exit 1
fi

# Verificar se pip está instalado
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 não está instalado. Por favor, instale pip3."
    exit 1
fi

# Verificar se o arquivo de configuração existe
if [ ! -f ".env" ]; then
    echo "⚠️  Arquivo .env não encontrado. Copiando de env.example..."
    cp env.example .env
    echo "📝 Por favor, edite o arquivo .env com suas configurações de banco de dados."
    echo "   Especialmente: DB_PASSWORD, DB_USER, DB_HOST"
    exit 1
fi

# Instalar dependências se necessário
if [ ! -d "venv" ]; then
    echo "📦 Criando ambiente virtual..."
    python3 -m venv venv
fi

echo "🔧 Ativando ambiente virtual..."
source venv/bin/activate

echo "📦 Instalando dependências..."
pip install -r requirements.txt

# Verificar conexão com banco de dados
echo "🔍 Verificando conexão com banco de dados..."
python3 -c "
import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

try:
    conn = mysql.connector.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', 3306)),
        user=os.getenv('DB_USER', 'root'),
        password=os.getenv('DB_PASSWORD', ''),
        database=os.getenv('DB_NAME', 'promoping')
    )
    print('✅ Conexão com banco de dados estabelecida com sucesso!')
    conn.close()
except Exception as e:
    print(f'❌ Erro ao conectar com banco de dados: {e}')
    print('   Verifique suas configurações no arquivo .env')
    exit(1)
"

if [ $? -ne 0 ]; then
    exit 1
fi

# Executar o scraper
echo "🔄 Iniciando scraping..."
python3 scheduler.py --mode schedule

echo "✅ PromoPing Python Scraper finalizado."
