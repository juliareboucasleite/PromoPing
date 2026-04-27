import os
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', ''),
    'dbname': os.getenv('DB_NAME', 'papv5'),
    'port': int(os.getenv('DB_PORT', 5432))
}

# Configurações do scraper
SCRAPER_CONFIG = {
    'cycle_interval': int(os.getenv('CYCLE_INTERVAL', 60)),
    'max_wait': int(os.getenv('MAX_WAIT', 10)),
    # True por padrão para rodar em segundo plano sem abrir janela do Chrome.
    'headless': os.getenv('HEADLESS', 'True').lower() in ('1', 'true', 'yes'),
    'user_agent': os.getenv('USER_AGENT', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
}

# Configurações de notificações
NOTIFICATION_CONFIG = {
    'enabled': os.getenv('NOTIFICATION_ENABLED', 'false').lower() in ('1', 'true', 'yes'),
    'webhook_url': os.getenv('NOTIFICATION_WEBHOOK_URL', ''),
    'email_enabled': os.getenv('EMAIL_ENABLED', 'false').lower() in ('1', 'true', 'yes'),
    'email_smtp': os.getenv('EMAIL_SMTP', ''),
    'email_user': os.getenv('EMAIL_USER', ''),
    'email_password': os.getenv('EMAIL_PASSWORD', '')
}

# Configurações de logging
LOGGING_CONFIG = {
    'level': os.getenv('LOG_LEVEL', 'DEBUG'),
    'file': os.getenv('LOG_FILE', 'scraper.log'),
    'max_size': int(os.getenv('LOG_MAX_SIZE', 10485760)),  # 10MB
    'backup_count': int(os.getenv('LOG_BACKUP_COUNT', 5))
}
