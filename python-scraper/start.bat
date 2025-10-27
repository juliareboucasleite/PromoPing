@echo off
REM Script de inicialização do PromoPing Python Scraper para Windows
REM Este script pode ser executado independentemente do sistema Node.js

echo 🚀 Iniciando PromoPing Python Scraper...

REM Verificar se Python está instalado
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python não está instalado. Por favor, instale Python 3.8 ou superior.
    pause
    exit /b 1
)

REM Verificar se pip está instalado
pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ pip não está instalado. Por favor, instale pip.
    pause
    exit /b 1
)

REM Verificar se o arquivo de configuração existe
if not exist ".env" (
    echo ⚠️  Arquivo .env não encontrado. Copiando de env.example...
    copy env.example .env
    echo 📝 Por favor, edite o arquivo .env com suas configurações de banco de dados.
    echo    Especialmente: DB_PASSWORD, DB_USER, DB_HOST
    pause
    exit /b 1
)

REM Instalar dependências se necessário
if not exist "venv" (
    echo 📦 Criando ambiente virtual...
    python -m venv venv
)

echo 🔧 Ativando ambiente virtual...
call venv\Scripts\activate.bat

echo 📦 Instalando dependências...
pip install -r requirements.txt

REM Verificar conexão com banco de dados
echo 🔍 Verificando conexão com banco de dados...
python -c "import os; import mysql.connector; from dotenv import load_dotenv; load_dotenv(); conn = mysql.connector.connect(host=os.getenv('DB_HOST', 'localhost'), port=int(os.getenv('DB_PORT', 3306)), user=os.getenv('DB_USER', 'root'), password=os.getenv('DB_PASSWORD', ''), database=os.getenv('DB_NAME', 'promoping')); print('✅ Conexão com banco de dados estabelecida com sucesso!'); conn.close()"

if %errorlevel% neq 0 (
    echo ❌ Erro ao conectar com banco de dados.
    echo    Verifique suas configurações no arquivo .env
    pause
    exit /b 1
)

REM Executar o scraper
echo 🔄 Iniciando scraping...
python scheduler.py --mode schedule

echo ✅ PromoPing Python Scraper finalizado.
pause
