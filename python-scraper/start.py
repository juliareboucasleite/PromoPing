#!/usr/bin/env python3
"""
PromoPing Python Scraper - Inicialização
"""

import sys
import os
from scraper import monitor_loop, fetch_products, connect_db

def test_system():
    """Testa sistema antes de iniciar"""
    print("Testando sistema...")
    
    try:
        # Teste conexão
        conn = connect_db()
        conn.close()
        print("✓ Conexão com banco OK")
        
        # Teste produtos
        produtos = fetch_products()
        print(f"✓ {len(produtos)} produtos encontrados")
        
        return True
    except Exception as e:
        print(f"✗ Erro: {e}")
        return False

def main():
    """Função principal"""
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        if test_system():
            print("Sistema OK - pronto para uso")
        else:
            print("Sistema com problemas")
        return
    
    # Teste rápido antes de iniciar
    if not test_system():
        print("Sistema com problemas - não é possível iniciar")
        return
    
    print("Iniciando PromoPing Monitor...")
    monitor_loop()

if __name__ == "__main__":
    main()