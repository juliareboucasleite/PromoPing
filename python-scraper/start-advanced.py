#!/usr/bin/env python3
"""
PromoPing Python Scraper - Inicialização Avançada
Sistema completo com monitoramento e notificações
"""

import sys
import os
import argparse
import time
from datetime import datetime
from scraper_optimized import monitor_loop, fetch_products, connect_db, health_check
from notifications import NotificationManager

def test_system():
    """Testa sistema completo antes de iniciar"""
    print(" Testando sistema completo...")
    
    tests = []
    
    # Teste 1: Conexão com banco
    try:
        conn = connect_db()
        conn.close()
        tests.append(("Conexão com banco", True))
        print(" Conexão com banco OK")
    except Exception as e:
        tests.append(("Conexão com banco", False))
        print(f" Erro na conexão: {e}")
    
    # Teste 2: Busca de produtos
    try:
        produtos = fetch_products()
        tests.append(("Busca de produtos", True))
        print(f" {len(produtos)} produtos encontrados")
    except Exception as e:
        tests.append(("Busca de produtos", False))
        print(f" Erro ao buscar produtos: {e}")
    
    # Teste 3: Health check
    try:
        health_ok = health_check()
        tests.append(("Health check", health_ok))
        if health_ok:
            print(" Health check OK")
        else:
            print(" Health check falhou")
    except Exception as e:
        tests.append(("Health check", False))
        print(f" Erro no health check: {e}")
    
    # Resumo dos testes
    passed = sum(1 for _, result in tests if result)
    total = len(tests)
    
    print(f"\n Resultado: {passed}/{total} testes passaram")
    
    return passed == total

def send_startup_notification():
    """Envia notificação de inicialização"""
    try:
        from config import NOTIFICATION_CONFIG
        notifier = NotificationManager(NOTIFICATION_CONFIG)
        notifier.notify_system_status("INICIADO", "PromoPing Monitor foi iniciado com sucesso!")
    except Exception as e:
        print(f" Erro ao enviar notificação: {e}")

def send_shutdown_notification():
    """Envia notificação de parada"""
    try:
        from config import NOTIFICATION_CONFIG
        notifier = NotificationManager(NOTIFICATION_CONFIG)
        notifier.notify_system_status("PARADO", "PromoPing Monitor foi parado.")
    except Exception as e:
        print(f" Erro ao enviar notificação: {e}")

def run_with_monitoring():
    """Executa com monitoramento avançado"""
    print(" Iniciando PromoPing Monitor com monitoramento avançado...")
    
    # Envia notificação de inicialização
    send_startup_notification()
    
    try:
        monitor_loop()
    except KeyboardInterrupt:
        print("\n Interrompido pelo utilizador")
    except Exception as e:
        print(f" Erro inesperado: {e}")
        # Envia notificação de erro
        try:
            from config import NOTIFICATION_CONFIG
            notifier = NotificationManager(NOTIFICATION_CONFIG)
            notifier.notify_error(str(e))
        except:
            pass
    finally:
        # Envia notificação de parada
        send_shutdown_notification()

def run_continuous_test():
    """Executa teste contínuo por tempo limitado"""
    print(" Executando teste contínuo...")
    
    start_time = time.time()
    test_duration = 300  # 5 minutos
    
    try:
        while time.time() - start_time < test_duration:
            produtos = fetch_products()
            print(f"[{len(produtos)} produtos] {datetime.now().strftime('%H:%M:%S')}")
            
            # Simula um ciclo de monitorização
            for produto in produtos[:2]:  # Apenas os primeiros 2
                print(f"   {produto['Nome']} - {produto['PlanoNome']}")
            
            print("   Aguardando 30s...")
            time.sleep(30)
        
        print(" Teste contínuo concluído")
        
    except KeyboardInterrupt:
        print("\n Teste interrompido")

def show_stats():
    """Mostra estatísticas do sistema"""
    print(" Estatísticas do Sistema PromoPing")
    print("=" * 50)
    
    try:
        produtos = fetch_products()
        print(f" Total de produtos: {len(produtos)}")
        
        # Agrupa por plano
        planos = {}
        for p in produtos:
            plano = p['PlanoNome']
            if plano not in planos:
                planos[plano] = 0
            planos[plano] += 1
        
        print("\n Produtos por plano:")
        for plano, count in planos.items():
            print(f"  • {plano}: {count} produtos")
        
        # Verifica saúde
        health_ok = health_check()
        print(f"\n Status do sistema: {' OK' if health_ok else ' Problemas'}")
        
    except Exception as e:
        print(f" Erro ao obter estatísticas: {e}")

def main():
    """Função principal"""
    parser = argparse.ArgumentParser(description='PromoPing Python Scraper')
    parser.add_argument('--mode', choices=['test', 'run', 'continuous', 'stats'], 
                       default='run', help='Modo de execução')
    parser.add_argument('--notify', action='store_true', 
                       help='Enviar notificações')
    
    args = parser.parse_args()
    
    print(" PromoPing Python Scraper - Sistema Avançado")
    print("=" * 50)
    
    if args.mode == 'test':
        if test_system():
            print("\n Sistema OK - pronto para uso")
            if args.notify:
                send_startup_notification()
        else:
            print("\n Sistema com problemas - verifique as configurações")
            sys.exit(1)
    
    elif args.mode == 'stats':
        show_stats()
    
    elif args.mode == 'continuous':
        if not test_system():
            print(" Sistema com problemas - não é possível iniciar teste contínuo")
            return
        run_continuous_test()
    
    elif args.mode == 'run':
        if not test_system():
            print(" Sistema com problemas - não é possível iniciar")
            return
        
        print("\n Iniciando monitorização contínua...")
        print(" Pressione Ctrl+C para parar")
        run_with_monitoring()

if __name__ == "__main__":
    main()
