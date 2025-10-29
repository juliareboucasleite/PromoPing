#!/usr/bin/env python3
"""
PromoPing Python Scraper
Sistema de monitorização de preços para e-commerce
"""

import os
import re
import traceback
from datetime import datetime
from time import sleep, time
import requests
import mysql.connector
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import logging

# Importar configurações
from config import DB_CONFIG, SCRAPER_CONFIG, NOTIFICATION_CONFIG, LOGGING_CONFIG

# Configurar logging simples
logging.basicConfig(
    level=getattr(logging, LOGGING_CONFIG['level']),
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOGGING_CONFIG['file']),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ==================== FUNÇÕES PRINCIPAIS ====================

def connect_db():
    """Conectar ao banco de dados"""
    return mysql.connector.connect(**DB_CONFIG)

def fetch_products():
    """Buscar produtos para monitorização"""
    conn = connect_db()
    cur = conn.cursor(dictionary=True)
    
    try:
        # Tenta buscar com JOIN completo
        cur.execute("""
            SELECT p.Id, p.Nome, p.Link, p.PrecoAlvo, p.PrecoAtual, p.UserId, 
                   u.PerfilId as PlanoId, pl.Nome as PlanoNome, pl.VerificacaoIntervalo
            FROM produtos p
            JOIN utilizadores u ON p.UserId = u.Id
            JOIN planos pl ON u.PerfilId = pl.Id
            WHERE p.Link IS NOT NULL AND p.Link <> '' AND p.DeletedAt IS NULL
        """)
        rows = cur.fetchall()
        logger.info(f"[DB] {len(rows)} produtos encontrados")
    except Exception as e:
        logger.warning(f"[DB] Fallback para estrutura simples: {e}")
        # Fallback para estrutura simples
        try:
            cur.execute("""
                SELECT Id, Nome, Link, PrecoAlvo, PrecoAtual
                FROM produtos
                WHERE Link IS NOT NULL AND Link <> '' AND DeletedAt IS NULL
            """)
            rows = cur.fetchall()
            # Adiciona informações de plano padrão
            for row in rows:
                row['UserId'] = 1
                row['PlanoNome'] = 'Free'
                row['VerificacaoIntervalo'] = 24
            logger.info(f"[DB] {len(rows)} produtos com plano Free")
        except Exception as e2:
            logger.error(f"[DB] Erro no fallback: {e2}")
            rows = []
    
    cur.close()
    conn.close()
    return rows

def should_update_product(product_id, plan_interval_hours):
    """Verifica se produto deve ser atualizado"""
    conn = connect_db()
    cur = conn.cursor(dictionary=True)
    
    try:
        cur.execute("SELECT UpdatedAt FROM produtos WHERE Id = %s", (product_id,))
        result = cur.fetchone()
        
        if not result or not result['UpdatedAt']:
            return True
        
        last_update = result['UpdatedAt']
        time_since_update = datetime.now() - last_update
        hours_since_update = time_since_update.total_seconds() / 3600
        
        return hours_since_update >= plan_interval_hours
    except Exception:
        return True
    finally:
        cur.close()
        conn.close()

def update_price_and_history(product_id, price):
    """Atualiza preço e salva histórico"""
    conn = connect_db()
    cursor = conn.cursor()
    
    try:
        # Atualiza preço atual
        cursor.execute("""
            UPDATE produtos SET PrecoAtual=%s, UpdatedAt=NOW() WHERE Id=%s
        """, (price, product_id))
        conn.commit()
        logger.info(f"[UPDATE] Produto {product_id}: €{price}")
        
        # Salva histórico
        cursor.execute("""
            SELECT Preco FROM historicoprecos WHERE ProdutoId = %s ORDER BY Id DESC LIMIT 1
        """, (product_id,))
        ultimo = cursor.fetchone()
        ultimo_preco = float(ultimo[0]) if ultimo and ultimo[0] is not None else None

        if ultimo_preco is None or float(ultimo_preco) != float(price):
            cursor.execute("""
                INSERT INTO historicoprecos (ProdutoId, Preco, DataRegisto) VALUES (%s, %s, %s)
            """, (product_id, price, datetime.now()))
            conn.commit()
            logger.info(f"[HIST] Novo preço: €{price}")
            
    except Exception as e:
        logger.error(f"[ERRO] Falha ao atualizar produto {product_id}: {e}")
    finally:
        cursor.close()
        conn.close()

def check_target_reached(product_id, current_price, target_price):
    """Verifica se meta foi atingida"""
    if current_price and target_price and current_price <= target_price:
        logger.info(f"[META] Produto {product_id}: €{current_price} <= €{target_price}")
        return True
    return False

# ==================== SCRAPING ====================

def clean_price_text(text):
    """Limpa e normaliza texto de preço"""
    if not text:
        return None
    txt = text.strip().split("/")[0].strip()
    txt = txt.replace("€", "").replace("\xa0", " ").replace("\n", " ")
    txt = re.sub(r"[^\d\,\.]", "", txt)
    
    # Normalizar vírgula decimal
    if txt.count(",") == 1 and txt.rfind(",") > txt.rfind("."):
        txt = txt.replace(".", "").replace(",", ".")
    else:
        txt = txt.replace(",", "")
    
    try:
        return round(float(txt), 2)
    except Exception:
        return None

def create_driver():
    """Cria driver Chrome otimizado"""
    opts = uc.ChromeOptions()
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_argument("--start-maximized")
    opts.add_argument("--disable-popup-blocking")
    opts.add_argument("--disable-notifications")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--incognito")
    opts.add_argument("--lang=pt-PT")
    opts.add_argument("--window-size=1280,900")
    opts.add_argument(f"user-agent={SCRAPER_CONFIG['user_agent']}")
    
    if SCRAPER_CONFIG['headless']:
        opts.add_argument("--headless=new")
    
    driver = uc.Chrome(options=opts, use_subprocess=True)
    try:
        driver.delete_all_cookies()
    except Exception:
        pass
    return driver

def safe_quit(driver):
    """Fecha driver de forma segura"""
    if not driver:
        return
    try:
        driver.quit()
    except Exception:
        try: 
            driver.close()
        except: 
            pass

def aceitar_cookies(driver):
    """Aceita cookies automaticamente"""
    try:
        # Amazon
        if "amazon" in driver.current_url.lower():
            try:
                WebDriverWait(driver, 2).until(
                    EC.element_to_be_clickable((By.ID, "sp-cc-accept"))
                ).click()
                sleep(0.3)
                return
            except:
                pass
        
        # FNAC
        if "fnac" in driver.current_url.lower():
            try:
                fnac_button = WebDriverWait(driver, 2).until(
                    EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'ACEITAR TODOS OS COOKIES')]"))
                )
                fnac_button.click()
                sleep(1)
                return
            except:
                pass
        
        # Worten
        if "worten" in driver.current_url.lower():
            try:
                worten_button = WebDriverWait(driver, 2).until(
                    EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Aceitar')]"))
                )
                worten_button.click()
                sleep(0.5)
                return
            except:
                pass
        
        # Fallback genérico
        botoes = driver.find_elements(By.TAG_NAME, "button")
        for b in botoes:
            try:
                txt = b.text.strip().lower()
                if any(x in txt for x in ["aceitar", "accept", "permitir", "ok"]):
                    b.click()
                    sleep(0.5)
                    break
            except:
                pass
                
    except Exception:
        pass

def extract_price(driver, url):
    """Extrai preço de qualquer loja"""
    u = url.lower()
    
    try:
        driver.get(url)
        aceitar_cookies(driver)
        
        # Amazon
        if "amazon." in u:
            try:
                WebDriverWait(driver, SCRAPER_CONFIG['max_wait']).until(
                    EC.visibility_of_element_located((By.CSS_SELECTOR, "span.a-price-whole"))
                )
                inteiro = driver.find_element(By.CSS_SELECTOR, "span.a-price-whole").text.strip()
                decimal = ""
                try:
                    decimal = driver.find_element(By.CSS_SELECTOR, "span.a-price-fraction").text.strip()
                except:
                    pass
                preco = clean_price_text(f"{inteiro},{decimal}" if decimal else inteiro)
                return "Amazon", preco, None
            except:
                return "Amazon", None, None
        
        # FNAC
        elif "fnac" in u:
            try:
                sleep(3)  # Aguarda carregamento
                aceitar_cookies(driver)
                sleep(2)
                
                selectors = [
                    "span.f-faPriceBox__price",
                    "span.price",
                    ".f-priceBox-price",
                    ".price-current"
                ]
                
                for selector in selectors:
                    try:
                        WebDriverWait(driver, 3).until(
                            EC.visibility_of_element_located((By.CSS_SELECTOR, selector))
                        )
                        el = driver.find_element(By.CSS_SELECTOR, selector)
                        preco = clean_price_text(el.text)
                        if preco:
                            return "FNAC", preco, None
                    except:
                        continue
                
                # Fallback regex
                page_text = driver.page_source
                price_match = re.search(r'(\d+[,\.]\d{2})\s*€', page_text)
                if price_match:
                    preco = clean_price_text(price_match.group(1))
                    if preco:
                        return "FNAC", preco, None
                        
            except Exception as e:
                logger.error(f"Erro FNAC: {e}")
            return "FNAC", None, None
        
        # Worten
        elif "worten" in u:
            try:
                WebDriverWait(driver, SCRAPER_CONFIG['max_wait']).until(
                    EC.visibility_of_element_located((By.CSS_SELECTOR, "span.value, .price"))
                )
                el = driver.find_element(By.CSS_SELECTOR, "span.value, .price")
                preco = clean_price_text(el.text)
                return "Worten", preco, None
            except:
                return "Worten", None, None
        
        # Fallback genérico
        else:
            try:
                page_text = driver.page_source
                price_match = re.search(r'(\d+[,\.]\d{2})\s*€', page_text)
                if price_match:
                    preco = clean_price_text(price_match.group(1))
                    if preco:
                        return "Genérico", preco, None
            except:
                pass
            
    except Exception as e:
        logger.error(f"Erro ao extrair preço: {e}")
    
    return "Desconhecida", None, None

# ==================== LOOP PRINCIPAL ====================

def monitor_loop():
    """Loop principal de monitorização"""
    driver = None
    try:
        driver = create_driver()
        logger.info("PromoPing Monitor iniciado")
    except Exception as e:
        logger.error(f"Erro ao iniciar driver: {e}")
        return

    try:
        while True:
            produtos = fetch_products()
            logger.info(f"[{len(produtos)} produtos] {datetime.now().strftime('%H:%M:%S')}")
            
            atualizados = 0
            aguardando = 0
            metas = 0
            
            for p in produtos:
                pid = p["Id"]
                nome = p["Nome"]
                link = p["Link"]
                plano_intervalo = p["VerificacaoIntervalo"]
                plano_nome = p["PlanoNome"]
                preco_alvo = p["PrecoAlvo"]
                
                # Verifica se deve atualizar
                if not should_update_product(pid, plano_intervalo):
                    aguardando += 1
                    continue
                
                atualizados += 1
                started = time()
                
                try:
                    loja, preco, flag = extract_price(driver, link)
                    
                    if preco is not None:
                        preco = round(float(preco), 2)
                        logger.info(f"[OK] {nome} ({loja}): €{preco} [{round(time()-started,2)}s]")
                        update_price_and_history(pid, preco)
                        
                        if check_target_reached(pid, preco, preco_alvo):
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
            
            # Calcula próximo intervalo
            intervalos = set()
            for p in produtos:
                if abs(p["VerificacaoIntervalo"] - 5/60) < 0.001:  # Premium
                    intervalos.add(300)  # 5 min
                elif p["VerificacaoIntervalo"] == 0.5:  # Standard
                    intervalos.add(1800)  # 30 min
                elif p["VerificacaoIntervalo"] == 4:  # Basic
                    intervalos.add(14400)  # 4h
                else:  # Free
                    intervalos.add(86400)  # 24h
            
            min_interval = min(intervalos) if intervalos else SCRAPER_CONFIG['cycle_interval']
            
            if min_interval >= 3600:
                logger.info(f"Aguardando {min_interval//3600}h...\n")
            elif min_interval >= 60:
                logger.info(f"Aguardando {min_interval//60}min...\n")
            else:
                logger.info(f"Aguardando {min_interval}s...\n")
            
            sleep(min_interval)
            
    except KeyboardInterrupt:
        logger.info("Interrompido pelo utilizador")
    except Exception as e:
        logger.error(f"Erro inesperado: {e}")
        traceback.print_exc()
    finally:
        safe_quit(driver)
        logger.info("Driver fechado")

if __name__ == "__main__":
    monitor_loop()