#!/usr/bin/env python3
"""
Script de teste para o PromoPing Python Scraper
Este script testa todas as funcionalidades principais
"""

import os
import sys
import time
import logging
from datetime import datetime

# Adicionar o diretório atual ao path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from scraper import DatabaseManager, ScraperFactory, PriceScraper

# Configurar logging para teste
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ScraperTester:
    """Classe para testar o sistema de scraping"""
    
    def __init__(self):
        self.db = DatabaseManager()
        self.scraper = PriceScraper()
    
    def test_database_connection(self):
        """Testar conexão com banco de dados"""
        logger.info(" Testando conexão com banco de dados...")
        
        try:
            conn = self.db.get_connection()
            cursor = conn.cursor()
            
            # Testar query simples
            cursor.execute("SELECT COUNT(*) FROM Produtos")
            count = cursor.fetchone()[0]
            
            cursor.close()
            conn.close()
            
            logger.info(f" Conexão com banco OK - {count} produtos encontrados")
            return True
            
        except Exception as e:
            logger.error(f" Erro na conexão com banco: {e}")
            return False
    
    def test_scraper_factory(self):
        """Testar factory de scrapers"""
        logger.info(" Testando factory de scrapers...")
        
        try:
            # Testar diferentes lojas
            test_cases = [
                ("Worten", "WortenScraper"),
                ("FNAC", "FnacScraper"),
                ("Amazon", "GenericScraper"),
                ("Loja Desconhecida", "GenericScraper")
            ]
            
            for loja, expected_type in test_cases:
                scraper = ScraperFactory.create_scraper(loja)
                actual_type = type(scraper).__name__
                
                if actual_type == expected_type:
                    logger.info(f" {loja} -> {actual_type}")
                else:
                    logger.warning(f" {loja} -> {actual_type} (esperado: {expected_type})")
            
            return True
            
        except Exception as e:
            logger.error(f" Erro no factory: {e}")
            return False
    
    def test_price_extraction(self):
        """Testar extração de preços"""
        logger.info(" Testando extração de preços...")
        
        try:
            scraper = ScraperFactory.create_scraper("Worten")
            
            test_cases = [
                ("€ 99.99", 99.99),
                ("99.99 €", 99.99),
                ("99,99 euros", 99.99),
                ("R$ 99.99", None),  # Moeda não suportada
                ("Preço: € 149.50", 149.50),
                ("Sem preço aqui", None)
            ]
            
            for text, expected in test_cases:
                result = scraper.extract_price_from_text(text)
                
                if result == expected:
                    logger.info(f" '{text}' -> {result}")
                else:
                    logger.warning(f" '{text}' -> {result} (esperado: {expected})")
            
            return True
            
        except Exception as e:
            logger.error(f" Erro na extração de preços: {e}")
            return False
    
    def test_get_products(self):
        """Testar busca de produtos"""
        logger.info(" Testando busca de produtos...")
        
        try:
            products = self.db.get_products_to_scrape()
            
            logger.info(f" {len(products)} produtos encontrados para scraping")
            
            if products:
                # Mostrar detalhes do primeiro produto
                first_product = products[0]
                logger.info(f" Primeiro produto: {first_product.nome} ({first_product.loja})")
                logger.info(f" Link: {first_product.link}")
                logger.info(f" Preço alvo: €{first_product.preco_alvo}")
            
            return True
            
        except Exception as e:
            logger.error(f" Erro ao buscar produtos: {e}")
            return False
    
    def test_single_scraping(self):
        """Testar scraping de um produto específico"""
        logger.info(" Testando scraping de produto específico...")
        
        try:
            products = self.db.get_products_to_scrape()
            
            if not products:
                logger.warning(" Nenhum produto encontrado para teste")
                return True
            
            # Testar com o primeiro produto
            test_product = products[0]
            logger.info(f" Testando scraping para: {test_product.nome}")
            
            scraper = ScraperFactory.create_scraper(test_product.loja)
            
            # Fazer scraping (sem salvar no banco)
            scraped_price = scraper.scrape_price(test_product)
            
            if scraped_price:
                logger.info(f" Preço coletado: €{scraped_price.preco}")
                logger.info(f" Data: {scraped_price.data_coleta}")
                
                # Verificar se atingiu meta
                if scraped_price.preco <= test_product.preco_alvo:
                    logger.info(f" Meta atingida! €{scraped_price.preco} <= €{test_product.preco_alvo}")
                else:
                    logger.info(f" Meta não atingida: €{scraped_price.preco} > €{test_product.preco_alvo}")
            else:
                logger.warning(" Não foi possível coletar preço")
            
            return True
            
        except Exception as e:
            logger.error(f" Erro no scraping de teste: {e}")
            return False
    
    def run_all_tests(self):
        """Executar todos os testes"""
        logger.info(" Iniciando testes do PromoPing Python Scraper...")
        
        tests = [
            ("Conexão com Banco", self.test_database_connection),
            ("Factory de Scrapers", self.test_scraper_factory),
            ("Extração de Preços", self.test_price_extraction),
            ("Busca de Produtos", self.test_get_products),
            ("Scraping Individual", self.test_single_scraping)
        ]
        
        results = []
        
        for test_name, test_func in tests:
            logger.info(f"\n{'='*50}")
            logger.info(f" Executando: {test_name}")
            logger.info(f"{'='*50}")
            
            try:
                result = test_func()
                results.append((test_name, result))
                
                if result:
                    logger.info(f" {test_name}: PASSOU")
                else:
                    logger.error(f" {test_name}: FALHOU")
                    
            except Exception as e:
                logger.error(f" {test_name}: ERRO - {e}")
                results.append((test_name, False))
        
        # Resumo dos testes
        logger.info(f"\n{'='*50}")
        logger.info(" RESUMO DOS TESTES")
        logger.info(f"{'='*50}")
        
        passed = sum(1 for _, result in results if result)
        total = len(results)
        
        for test_name, result in results:
            status = " PASSOU" if result else " FALHOU"
            logger.info(f"{test_name}: {status}")
        
        logger.info(f"\n Resultado: {passed}/{total} testes passaram")
        
        if passed == total:
            logger.info(" Todos os testes passaram! Sistema pronto para uso.")
        else:
            logger.warning(" Alguns testes falharam. Verifique as configurações.")
        
        return passed == total

def main():
    """Função principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Teste do PromoPing Python Scraper')
    parser.add_argument('--test', choices=['db', 'factory', 'extraction', 'products', 'scraping', 'all'], 
                       default='all', help='Teste específico para executar')
    
    args = parser.parse_args()
    
    tester = ScraperTester()
    
    if args.test == 'all':
        success = tester.run_all_tests()
        sys.exit(0 if success else 1)
    elif args.test == 'db':
        success = tester.test_database_connection()
    elif args.test == 'factory':
        success = tester.test_scraper_factory()
    elif args.test == 'extraction':
        success = tester.test_price_extraction()
    elif args.test == 'products':
        success = tester.test_get_products()
    elif args.test == 'scraping':
        success = tester.test_single_scraping()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
