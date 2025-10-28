# PromoPing Python Scraper - Setup Automático

echo " Configurando PromoPing Python Scraper..."

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo " Python 3 não encontrado. Instalando..."
    
    # Detectar sistema operacional
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v apt &> /dev/null; then
            sudo apt update
            sudo apt install -y python3 python3-pip python3-venv
        elif command -v yum &> /dev/null; then
            sudo yum install -y python3 python3-pip
        elif command -v dnf &> /dev/null; then
            sudo dnf install -y python3 python3-pip
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install python3
        else
            echo " Homebrew não encontrado. Instale Python 3 manualmente."
            exit 1
        fi
    else
        echo " Sistema operacional não suportado. Instale Python 3 manualmente."
        exit 1
    fi
fi

echo " Python 3 instalado"

# Verificar pip
if ! command -v pip3 &> /dev/null; then
    echo " pip3 não encontrado. Instalando..."
    python3 -m ensurepip --upgrade
fi

echo " pip3 instalado"

# Criar ambiente virtual
if [ ! -d "venv" ]; then
    echo " Criando ambiente virtual..."
    python3 -m venv venv
fi

echo " Ambiente virtual criado"

# Ativar ambiente virtual
echo " Ativando ambiente virtual..."
source venv/bin/activate

# Instalar dependências
echo " Instalando dependências..."
pip install --upgrade pip
pip install -r requirements.txt

echo " Dependências instaladas"

# Configurar arquivo .env
if [ ! -f ".env" ]; then
    echo " Configurando arquivo .env..."
    cp env.example .env
    
    echo " Por favor, edite o arquivo .env com suas configurações:"
    echo "   - DB_PASSWORD: Senha do banco de dados"
    echo "   - DB_USER: Usuário do banco de dados"
    echo "   - DB_HOST: Host do banco de dados"
    echo ""
    echo "   Exemplo:"
    echo "   DB_PASSWORD=minhasenha123"
    echo "   DB_USER=root"
    echo "   DB_HOST=localhost"
    echo ""
    echo "   Depois execute: ./start.sh"
else
    echo " Arquivo .env já existe"
fi

# Tornar scripts executáveis
chmod +x start.sh
chmod +x test_scraper.py

echo " Scripts tornados executáveis"

# Executar teste básico
echo " Executando teste básico..."
python test_scraper.py --test db

if [ $? -eq 0 ]; then
    echo ""
    echo " Setup concluído com sucesso!"
    echo ""
    echo " Próximos passos:"
    echo "1. Edite o arquivo .env com suas configurações de banco"
    echo "2. Execute: ./start.sh (para modo agendado)"
    echo "3. Ou execute: python scraper.py --all (para uma execução)"
    echo "4. Execute: python test_scraper.py (para testes completos)"
    echo ""
    echo " Consulte o README.md para mais informações"
else
    echo ""
    echo " Setup concluído, mas teste de banco falhou."
    echo "   Verifique suas configurações no arquivo .env"
    echo "   Execute: python test_scraper.py --test db"
fi
