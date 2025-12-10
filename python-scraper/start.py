import sys
import os
import argparse
from scraper import monitor_loop, fetch_products, connect_db, scrape_single_product

def test_system():
    """Testa sistema antes de iniciar"""
    print("Testando sistema...")
    
    try:
        # Teste conexão
        conn = connect_db()
        conn.close()
        print("Conexão com banco OK")
        
        # Teste produtos
        produtos = fetch_products()
        print(f"✓ {len(produtos)} produtos encontrados")
        
        return True
    except Exception as e:
        print(f"✗ Erro: {e}")
        return False

def main():
    """Função principal"""
    parser = argparse.ArgumentParser(description='PromoPing Python Scraper')
    parser.add_argument('--single', help='Executa scraping imediato de um produto (URL)', type=str)
    parser.add_argument('--test', action='store_true', help='Testa sistema antes de iniciar')
    
    args = parser.parse_args()
    
    # Modo teste
    if args.test:
        if test_system():
            print("Sistema OK - pronto para uso")
        else:
            print("Sistema com problemas")
        return
    
    # Modo single product (verificação inicial)
    if args.single:
        print(f"[SCRAPER] Verificação inicial para: {args.single}")
        try:
            scrape_single_product(args.single, is_initial=True)
            print("[SCRAPER] Verificação inicial concluída")
        except Exception as e:
            print(f"[SCRAPER] Erro na verificação inicial: {e}")
            import traceback
            traceback.print_exc()
        return
    
    # Modo normal (loop contínuo)
    # Teste rápido antes de iniciar
    if not test_system():
        print("Sistema com problemas - não é possível iniciar")
        return
    
    print("Iniciando PromoPing Monitor...")
    monitor_loop()

if __name__ == "__main__":
    main()