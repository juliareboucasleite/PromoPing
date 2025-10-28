#!/usr/bin/env python3
"""
Script de teste para o single-scraper.py
Testa o scraping com URLs reais de diferentes lojas
"""

import subprocess
import json
import sys
import os

def test_scraper():
    """Testa o scraper com URLs de exemplo"""
    
    # URLs de teste para diferentes lojas
    test_urls = [
        "https://www.amazon.es/dp/B08N5WRWNW",  # Amazon
        "https://www.fnac.pt/",  # FNAC (página principal)
        "https://www.worten.pt/",  # Worten (página principal)
    ]
    
    script_path = os.path.join(os.path.dirname(__file__), 'single-scraper.py')
    
    print("=== TESTE DO SINGLE SCRAPER ===\n")
    
    for i, url in enumerate(test_urls, 1):
        print(f"Teste {i}: {url}")
        print("-" * 50)
        
        try:
            # Executar o script Python
            result = subprocess.run(
                ['python', script_path, url],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    data = json.loads(result.stdout)
                    if data['success']:
                        print(f"✅ Sucesso!")
                        print(f"   Preço: €{data['price']}")
                        print(f"   Loja: {data.get('store', 'Desconhecida')}")
                    else:
                        print(f"❌ Falhou: {data['error']}")
                except json.JSONDecodeError:
                    print(f"❌ Erro no JSON: {result.stdout}")
            else:
                print(f"❌ Erro de execução (código {result.returncode})")
                print(f"   Stderr: {result.stderr}")
                
        except subprocess.TimeoutExpired:
            print("❌ Timeout (30s)")
        except Exception as e:
            print(f"❌ Erro: {e}")
        
        print()
    
    print("=== FIM DOS TESTES ===")

if __name__ == "__main__":
    test_scraper()
