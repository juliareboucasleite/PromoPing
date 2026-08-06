import os
import sys
import time
import logging
from datetime import datetime

# Adicionar o diretório atual ao path para importar o scraper
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from scraper import PriceScraper, fetch_products, should_update_product, extract_price, update_price_and_history, check_target_reached, create_driver, safe_quit
from datetime import datetime
from time import sleep

# Garantir que o diretório do arquivo de log existe
log_file = 'scraper_scheduler.log'
log_dir = os.path.dirname(log_file)
if log_dir and not os.path.exists(log_dir):
    os.makedirs(log_dir, exist_ok=True)

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def pode_executar(produto):
    """Verifica se produto pode ser executado baseado no plano e última verificação"""
    plano_intervalo = produto.get("VerificacaoIntervalo", 24)  # Default 24h (Free)
    produto_id = produto["Id"]
    
    # Usa a função existente que já verifica baseado em UpdatedAt
    return should_update_product(produto_id, plano_intervalo)

class ScraperScheduler:
    """Agendador para execução automática do scraper"""
    
    def __init__(self):
        self.scraper = PriceScraper()
        self.running = False
    
    def run_scraping_job(self):
        """Executar job de scraping respeitando intervalos do plano"""
        logger.info(" Iniciando job de scraping agendado...")
        driver = None
        try:
            driver = create_driver()
            produtos = fetch_products()
            logger.info(f"[{len(produtos)} produtos] {datetime.now().strftime('%H:%M:%S')}")
            
            atualizados = 0
            aguardando = 0
            metas = 0
            
            for p in produtos:
                pid = p["Id"]
                nome = p["Nome"]
                link = p["Link"]
                plano_intervalo = p.get("VerificacaoIntervalo", 24)
                preco_alvo = p.get("PrecoAlvo")
                
                # Verifica se pode executar baseado no plano
                if not pode_executar(p):
                    aguardando += 1
                    continue
                
                atualizados += 1
                try:
                    loja, preco, flag = extract_price(driver, link)
                    
                    if preco is not None:
                        preco = round(float(preco), 2)
                        logger.info(f"[OK] {nome} ({loja}): €{preco}")
                        update_price_and_history(pid, preco)
                        
                        if preco_alvo and check_target_reached(pid, preco, preco_alvo):
                            metas += 1
                    else:
                        logger.warning(f"[ERRO] {nome}: preço não encontrado")
                        
                except Exception as e:
                    logger.error(f"[ERRO] {nome}: {e}")
                    # Reinicia driver se necessário
                    try:
                        safe_quit(driver)
                        driver = create_driver()
                    except:
                        pass
                
                sleep(1.0)  # Pausa entre produtos
            
            logger.info(f"Resumo: {atualizados} atualizados, {aguardando} aguardando, {metas} metas")
            
        except Exception as e:
            logger.error(f" Erro no job de scraping: {e}")
            import traceback
            traceback.print_exc()
        finally:
            if driver:
                safe_quit(driver)
    
    def start_scheduler(self):
        """Iniciar o agendador"""
        logger.info(" Iniciando agendador do PromoPing Scraper...")
        
        # Calcular intervalo mínimo baseado nos planos
        # Premium: 1h, Standard: 2h, Basic: 4h, Free: 24h
        # Verifica a cada 1 minuto (para Premium) mas só executa produtos que podem ser atualizados
        interval_check = 60  # Verificar a cada 1 minuto
        
        # Executar uma vez imediatamente
        logger.info(" Executando scraping inicial...")
        self.run_scraping_job()
        
        self.running = True
        
        # Loop principal - verifica a cada minuto e executa produtos que podem ser atualizados
        while self.running:
            try:
                # Executar scraping respeitando intervalos do plano
                self.run_scraping_job()
                
                # Aguardar antes da próxima verificação
                time.sleep(interval_check)
                
            except KeyboardInterrupt:
                logger.info(" Parando agendador...")
                self.running = False
            except Exception as e:
                logger.error(f" Erro no agendador: {e}")
                time.sleep(60)
    
    def stop_scheduler(self):
        """Parar o agendador"""
        self.running = False

def main():
    """Função principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='PromoPing Python Scraper Scheduler')
    parser.add_argument('--mode', choices=['once', 'schedule'], default='schedule',
                       help='Modo de execução: once (uma vez) ou schedule (agendado)')
    parser.add_argument('--interval', type=int, default=30,
                       help='Intervalo em minutos para execução agendada (padrão: 30)')
    
    args = parser.parse_args()
    
    scheduler = ScraperScheduler()
    
    if args.mode == 'once':
        logger.info(" Executando scraping uma única vez...")
        scheduler.run_scraping_job()
    else:
        logger.info(f" Iniciando modo agendado (intervalo: {args.interval} minutos)...")
        scheduler.start_scheduler()

if __name__ == "__main__":
    main()
