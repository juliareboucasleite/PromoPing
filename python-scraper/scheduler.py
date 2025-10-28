#!/usr/bin/env python3
"""
Script de inicialização do PromoPing Python Scraper
Este script pode ser executado de forma independente ou integrado com o sistema Node.js
"""

import os
import sys
import time
import schedule
import logging
from datetime import datetime

# Adicionar o diretório atual ao path para importar o scraper
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from scraper import PriceScraper

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scraper_scheduler.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ScraperScheduler:
    """Agendador para execução automática do scraper"""
    
    def __init__(self):
        self.scraper = PriceScraper()
        self.running = False
    
    def run_scraping_job(self):
        """Executar job de scraping"""
        logger.info(" Iniciando job de scraping agendado...")
        try:
            self.scraper.scrape_all_products()
            logger.info(" Job de scraping concluído com sucesso")
        except Exception as e:
            logger.error(f" Erro no job de scraping: {e}")
    
    def start_scheduler(self):
        """Iniciar o agendador"""
        logger.info(" Iniciando agendador do PromoPing Scraper...")
        
        # Agendar execução a cada 30 minutos
        schedule.every(30).minutes.do(self.run_scraping_job)
        
        # Agendar execução a cada 2 horas (backup)
        schedule.every(2).hours.do(self.run_scraping_job)
        
        # Executar uma vez imediatamente
        logger.info(" Executando scraping inicial...")
        self.run_scraping_job()
        
        self.running = True
        
        # Loop principal
        while self.running:
            try:
                schedule.run_pending()
                time.sleep(60)  # Verificar a cada minuto
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
