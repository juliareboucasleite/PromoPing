#!/usr/bin/env python3
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
from config import DB_CONFIG, SCRAPER_CONFIG, NOTIFICATION_CONFIG, LOGGING_CONFIG

# Garantir que o diretório do arquivo de log existe
log_file_path = LOGGING_CONFIG['file']
log_dir = os.path.dirname(log_file_path)
if log_dir and not os.path.exists(log_dir):
    os.makedirs(log_dir, exist_ok=True)

# Converter nível de log de string para constante numérica
log_level_str = LOGGING_CONFIG['level'].upper()
log_level_map = {
    'DEBUG': logging.DEBUG,
    'INFO': logging.INFO,
    'WARNING': logging.WARNING,
    'ERROR': logging.ERROR,
    'CRITICAL': logging.CRITICAL
}
log_level = log_level_map.get(log_level_str, logging.INFO)

# Configurar logging simples
logging.basicConfig(
    level=log_level,
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
    try:
        return mysql.connector.connect(**DB_CONFIG)
    except mysql.connector.errors.InterfaceError as e:
        if "Can't connect to MySQL server" in str(e):
            logger.error("=" * 60)
            logger.error("ERRO: MySQL não está rodando ou não está acessível!")
            logger.error("=" * 60)
            logger.error(f"Tentando conectar em: {DB_CONFIG['host']}:{DB_CONFIG['port']}")
            logger.error("")
            logger.error("SOLUÇÕES:")
            logger.error("1. Inicie o MySQL no XAMPP Control Panel")
            logger.error("2. Verifique se a porta 3306 está correta")
            logger.error("3. Verifique as credenciais no arquivo .env")
            logger.error("4. Certifique-se de que o MySQL está instalado e rodando")
            logger.error("=" * 60)
        raise

def fetch_products():
    """Buscar produtos para monitorização"""
    conn = connect_db()
    cur = conn.cursor(dictionary=True)
    
    try:
        # Tenta buscar com JOIN completo
        cur.execute("""
            SELECT p.Id, p.Nome, p.Link, p.PrecoAlvo, p.PrecoAtual, p.UserId, 
                   u.PerfilId as PlanoId, pl.Nome as PlanoNome, pl.IntervaloVerificacao as VerificacaoIntervalo
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
                row['VerificacaoIntervalo'] = 24.0  # Garantir que é float
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
        cur.execute("SELECT UpdatedAt, PrecoAtual FROM produtos WHERE Id = %s", (product_id,))
        result = cur.fetchone()
        
        if not result or not result['UpdatedAt']:
            logger.info(f"[CHECK] Produto {product_id}: Sem UpdatedAt, deve atualizar")
            return True
        
        # Se não tem preço atual, sempre atualizar
        if not result.get('PrecoAtual'):
            logger.info(f"[CHECK] Produto {product_id}: Sem PrecoAtual, deve atualizar")
            return True
        
        last_update = result['UpdatedAt']
        time_since_update = datetime.now() - last_update
        hours_since_update = time_since_update.total_seconds() / 3600
        
        should_update = hours_since_update >= plan_interval_hours
        
        if should_update:
            logger.info(f"[CHECK] Produto {product_id}: {hours_since_update:.2f}h >= {plan_interval_hours}h, deve atualizar")
        else:
            logger.debug(f"[CHECK] Produto {product_id}: {hours_since_update:.2f}h < {plan_interval_hours}h, aguardando")
        
        return should_update
    except Exception as e:
        logger.error(f"[CHECK] Erro ao verificar produto {product_id}: {e}")
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

def scrape_single_product(product_url, is_initial=False):
    """Executa scraping de um único produto por URL"""
    driver = None
    try:
        logger.info(f"[INITIAL] Verificação inicial para: {product_url}")
        
        # Buscar produto pelo link ANTES de criar o driver
        conn = connect_db()
        cur = conn.cursor(dictionary=True)
        
        try:
            # Tenta buscar com JOIN completo
            try:
                cur.execute("""
                    SELECT p.Id, p.Nome, p.Link, p.PrecoAlvo, p.PrecoAtual, p.UserId,
                           u.PerfilId as PlanoId, pl.Nome as PlanoNome, pl.IntervaloVerificacao as VerificacaoIntervalo
                    FROM produtos p
                    JOIN utilizadores u ON p.UserId = u.Id
                    JOIN planos pl ON u.PerfilId = pl.Id
                    WHERE p.Link = %s AND p.DeletedAt IS NULL
                    LIMIT 1
                """, (product_url,))
                produto = cur.fetchone()
            except Exception as e:
                logger.warning(f"[INITIAL] Erro no JOIN, tentando fallback: {e}")
                # Fallback: busca simples sem JOIN
                cur.execute("""
                    SELECT Id, Nome, Link, PrecoAlvo, PrecoAtual, UserId
                    FROM produtos
                    WHERE Link = %s AND DeletedAt IS NULL
                    LIMIT 1
                """, (product_url,))
                produto = cur.fetchone()
                if produto:
                    produto['PlanoNome'] = 'Free'
                    produto['VerificacaoIntervalo'] = 24.0  # Garantir que é float
            
            if not produto:
                logger.warning(f"[INITIAL] Produto não encontrado para URL: {product_url}")
                return
            
            pid = produto["Id"]
            nome = produto["Nome"]
            link = produto["Link"]
            preco_alvo = produto.get("PrecoAlvo")
            
        finally:
            cur.close()
            conn.close()
        
        # Criar driver APÓS buscar dados do produto
        driver = create_driver()
        logger.info(f"[INITIAL] Driver criado, extraindo preço para: {nome}")
        
        # Extrair preço
        loja, preco, flag = extract_price(driver, link)
        
        if preco is not None:
            preco = round(float(preco), 2)
            logger.info(f"[INITIAL] {nome} ({loja}): €{preco}")
            update_price_and_history(pid, preco)
            
            if preco_alvo and check_target_reached(pid, preco, preco_alvo):
                logger.info(f"[INITIAL] Meta atingida para {nome}!")
        else:
            logger.warning(f"[INITIAL] {nome}: preço não encontrado")
            
    except Exception as e:
        logger.error(f"[INITIAL] Erro ao verificar produto: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if driver:
            safe_quit(driver)
            logger.info(f"[INITIAL] Driver fechado")

# ==================== SCRAPING ====================

def clean_price_text(text):
    """Limpa e normaliza texto de preço"""
    if not text:
        return None
    txt = text.strip().split("/")[0].strip()
    txt = txt.replace("€", "").replace("\xa0", " ").replace("\n", " ")
    
    # Extrair apenas o primeiro padrão de preço válido (número com até 2 decimais)
    # Padrão: número opcionalmente seguido de vírgula/ponto e 2 dígitos decimais
    price_pattern = re.search(r'(\d{1,6}(?:[,\.]\d{1,2})?)', txt)
    if not price_pattern:
        return None
    
    txt = price_pattern.group(1)
    
    # Normalizar vírgula decimal
    if txt.count(",") == 1 and txt.rfind(",") > txt.rfind("."):
        txt = txt.replace(".", "").replace(",", ".")
    else:
        txt = txt.replace(",", "")
    
    try:
        price = round(float(txt), 2)
        # Validar se o preço está em um range razoável (entre 0.01 e 1.000.000)
        if price < 0.01 or price > 1000000:
            logger.warning(f"[CLEAN_PRICE] Preço fora do range válido: €{price} (texto original: {text})")
            return None
        return price
    except Exception as e:
        logger.warning(f"[CLEAN_PRICE] Erro ao converter preço: {e} (texto: {text})")
        return None

def create_driver():
    """Cria driver Chrome otimizado"""
    opts = uc.ChromeOptions()
    
    # Sempre rodar em modo headless (invisível) para não abrir janela do Chrome
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_argument("--disable-popup-blocking")
    opts.add_argument("--disable-notifications")
    opts.add_argument("--incognito")
    opts.add_argument("--lang=pt-PT")
    opts.add_argument("--window-size=1280,900")
    opts.add_argument(f"user-agent={SCRAPER_CONFIG['user_agent']}")
    
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
        
        # Continente
        if "continente" in driver.current_url.lower():
            try:
                # Tentar vários seletores de botão de cookies do Continente
                cookie_selectors = [
                    "//button[contains(text(), 'Aceitar')]",
                    "//button[contains(text(), 'Aceitar todos')]",
                    "//button[contains(text(), 'Aceitar Cookies')]",
                    "//button[@id='onetrust-accept-btn-handler']",
                    "button#onetrust-accept-btn-handler",
                    ".onetrust-accept-btn-handler"
                ]
                
                for selector in cookie_selectors:
                    try:
                        if selector.startswith("//") or selector.startswith(".//"):
                            # XPath
                            button = WebDriverWait(driver, 2).until(
                                EC.element_to_be_clickable((By.XPATH, selector))
                            )
                        else:
                            # CSS Selector
                            button = WebDriverWait(driver, 2).until(
                                EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                            )
                        button.click()
                        sleep(1)
                        logger.info("[CONTINENTE] Cookies aceitos")
                        return
                    except:
                        continue
            except:
                pass
        
        # Black Market / Back Market
        if "blackmarket" in driver.current_url.lower() or "backmarket" in driver.current_url.lower():
            try:
                blackmarket_button = WebDriverWait(driver, 2).until(
                    EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Aceitar') or contains(text(), 'Accept')]"))
                )
                blackmarket_button.click()
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
        logger.info(f"[EXTRACT] Acessando URL: {url}")
        driver.get(url)
        sleep(2)  # Aguardar carregamento inicial
        aceitar_cookies(driver)
        logger.debug(f"[EXTRACT] Página carregada, procurando preço...")
        
        # Amazon
        if "amazon." in u:
            try:
                logger.debug("[EXTRACT] Tentando extrair preço da Amazon...")
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
                if preco:
                    logger.info(f"[EXTRACT] Preço Amazon encontrado: €{preco}")
                    return "Amazon", preco, None
                else:
                    logger.warning(f"[EXTRACT] Preço Amazon não pôde ser limpo: {inteiro},{decimal}")
            except Exception as e:
                logger.error(f"[EXTRACT] Erro ao extrair preço Amazon: {e}")
                import traceback
                traceback.print_exc()
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
                logger.debug("[EXTRACT] Tentando extrair preço da Worten...")
                sleep(3)  # Aguarda carregamento
                aceitar_cookies(driver)
                sleep(2)
                
                # Seletores mais específicos da Worten (ordem de prioridade)
                worten_selectors = [
                    "span.w-product-price__main",
                    ".w-product-price__main",
                    "[data-testid*='price']",
                    ".product-price",
                    "span.value",
                    "sup.decimal",
                    ".price",
                    "[class*='w-product-price']",
                    "[class*='price']",
                    ".current-price"
                ]
                
                # Tentar seletores específicos primeiro
                for selector in worten_selectors:
                    try:
                        WebDriverWait(driver, 5).until(
                            EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                        )
                        elementos = driver.find_elements(By.CSS_SELECTOR, selector)
                        
                        for el in elementos:
                            try:
                                if el.is_displayed():
                                    texto_preco = el.text.strip()
                                    preco = clean_price_text(texto_preco)
                                    if preco and float(preco) > 0:
                                        logger.info(f"[WORTEN] Preço encontrado com seletor {selector}: €{preco}")
                                        return "Worten", preco, None
                            except:
                                continue
                    except:
                        continue
                
                # Tentar capturar preço com inteiro e decimal separados (estrutura Worten)
                try:
                    # Buscar span.value que contém o número inteiro
                    try:
                        value_element = driver.find_element(By.CSS_SELECTOR, "span.value")
                        inteiro = value_element.text.strip()
                        
                        # Buscar sup.decimal que contém a parte decimal
                        try:
                            decimal_element = value_element.find_element(By.CSS_SELECTOR, "sup.decimal")
                            decimal = decimal_element.text.strip()
                            # Remover vírgula ou ponto se houver
                            decimal = decimal.replace(",", "").replace(".", "").replace("€", "").strip()
                        except:
                            # Tentar buscar sup.decimal próximo ao span.value
                            try:
                                decimal_element = driver.find_element(By.CSS_SELECTOR, "sup.decimal")
                                decimal = decimal_element.text.strip()
                                decimal = decimal.replace(",", "").replace(".", "").replace("€", "").strip()
                            except:
                                decimal = ""
                        
                        # Se encontrou inteiro, tentar combinar
                        if inteiro:
                            # Limpar inteiro (remover € e espaços)
                            inteiro = inteiro.replace("€", "").replace(",", "").replace(".", "").strip()
                            
                            if decimal:
                                preco = clean_price_text(f"{inteiro},{decimal}")
                            else:
                                # Se não tem decimal, usar só o inteiro
                                preco = clean_price_text(inteiro)
                            
                            if preco and float(preco) > 0:
                                logger.info(f"[WORTEN] Preço encontrado (span.value + sup.decimal): €{preco}")
                                return "Worten", preco, None
                    except Exception as e:
                        logger.debug(f"[WORTEN] Erro ao buscar span.value/sup.decimal: {e}")
                        pass
                    
                    # Se não encontrou separado, tentar elemento completo
                    selectors = [
                        "span.value",
                        ".price",
                        "[data-testid*='price']",
                        ".product-price",
                        ".current-price",
                        "span[class*='price']",
                        "[class*='price']"
                    ]
                    
                    for selector in selectors:
                        try:
                            el = driver.find_element(By.CSS_SELECTOR, selector)
                            texto_completo = el.text.strip()
                            
                            # Se o texto contém o preço completo, usar
                            if "€" in texto_completo or re.search(r'\d+[,\.]\d{2}', texto_completo):
                                preco = clean_price_text(texto_completo)
                                if preco:
                                    logger.info(f"[WORTEN] Preço encontrado com seletor: {selector} = €{preco}")
                                    return "Worten", preco, None
                        except:
                            continue
                    
                except:
                    pass
                
                # Fallback: busca por padrão de preço no texto da página (com decimais)
                page_text = driver.page_source
                logger.debug(f"[WORTEN] Tentando regex no page_source (tamanho: {len(page_text)} chars)")
                
                # Padrão mais específico: número com vírgula/ponto e 2 decimais seguido de €
                price_patterns = [
                    r'(\d{1,6}[,\.]\d{2})\s*€',  # 122,57 € ou 122.57 €
                    r'€\s*(\d{1,6}[,\.]\d{2})',  # € 122,57 ou € 122.57
                    r'(\d{1,6})\s*[,\.]\s*(\d{2})\s*€',  # 122 , 57 €
                    r'price["\']?\s*:\s*["\']?(\d{1,6}[,\.]\d{2})',  # price: "122.57"
                    r'data-price["\']?\s*=\s*["\']?(\d{1,6}[,\.]\d{2})',  # data-price="122.57"
                ]
                
                for pattern in price_patterns:
                    price_match = re.search(pattern, page_text, re.IGNORECASE)
                    if price_match:
                        if len(price_match.groups()) == 2:
                            # Caso com grupos separados
                            preco = clean_price_text(f"{price_match.group(1)},{price_match.group(2)}")
                        else:
                            # Caso com grupo único
                            preco = clean_price_text(price_match.group(1))
                        
                        if preco and float(preco) > 0:
                            logger.info(f"[WORTEN] Preço encontrado via regex: €{preco}")
                            return "Worten", preco, None
                
                # Último fallback: salvar HTML para debug
                logger.warning(f"[WORTEN] Preço não encontrado. Salvando HTML para debug...")
                try:
                    with open("worten_debug.html", "w", encoding="utf-8") as f:
                        f.write(page_text)
                    logger.warning(f"[WORTEN] HTML salvo em worten_debug.html")
                except:
                    pass
                        
            except Exception as e:
                logger.error(f"[WORTEN] Erro ao extrair preço: {e}")
                import traceback
                traceback.print_exc()
            return "Worten", None, None
        
        # Continente
        elif "continente.pt" in u:
            try:
                sleep(3)  # Aguarda carregamento completo
                aceitar_cookies(driver)
                sleep(2)
                
                # Verificar se o produto está disponível (não marcar como indisponível se estiver disponível)
                disponivel = True
                try:
                    # Seletores que indicam produto indisponível
                    indisponivel_selectors = [
                        ".out-of-stock",
                        "[class*='unavailable']",
                        "[class*='esgotado']",
                        ".product-unavailable",
                        "[data-testid*='unavailable']",
                        ".ct-product-unavailable"
                    ]
                    
                    for selector in indisponivel_selectors:
                        try:
                            el = driver.find_element(By.CSS_SELECTOR, selector)
                            if el.is_displayed():
                                # Verificar se realmente está indisponível (não apenas oculto)
                                texto = el.text.lower()
                                if any(palavra in texto for palavra in ['esgotado', 'indisponível', 'unavailable', 'out of stock']):
                                    disponivel = False
                                    logger.warning(f"[CONTINENTE] Produto pode estar indisponível: {texto}")
                                    break
                        except:
                            continue
                except:
                    pass  # Se não encontrar indicadores, assumir disponível
                
                # Seletores para o preço do Continente (ordem de prioridade)
                selectors = [
                    "span.ct-price-formatted",
                    ".ct-price-formatted",
                    "span.price",
                    ".price",
                    ".product-price",
                    ".current-price",
                    "[class*='ct-price']",
                    "[data-testid*='price']",
                    ".ct-product-price"
                ]
                
                for selector in selectors:
                    try:
                        WebDriverWait(driver, 5).until(
                            EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                        )
                        elementos = driver.find_elements(By.CSS_SELECTOR, selector)
                        
                        # Tentar todos os elementos encontrados
                        for el in elementos:
                            try:
                                if el.is_displayed():
                                    texto_preco = el.text.strip()
                                    preco = clean_price_text(texto_preco)
                                    if preco and float(preco) > 0:
                                        logger.info(f"[CONTINENTE] Preço encontrado com seletor {selector}: €{preco}")
                                        return "Continente", preco, None
                            except:
                                continue
                    except:
                        continue
                
                # Tentar buscar por atributos data-* ou aria-*
                try:
                    price_elements = driver.find_elements(By.CSS_SELECTOR, "[data-price], [aria-label*='€'], [data-testid*='price']")
                    for el in price_elements:
                        try:
                            # Tentar atributo data-price
                            data_price = el.get_attribute("data-price")
                            if data_price:
                                preco = clean_price_text(data_price)
                                if preco and float(preco) > 0:
                                    logger.info(f"[CONTINENTE] Preço encontrado via data-price: €{preco}")
                                    return "Continente", preco, None
                            
                            # Tentar aria-label
                            aria_label = el.get_attribute("aria-label")
                            if aria_label and "€" in aria_label:
                                price_match = re.search(r'(\d+[,\.]\d{2})', aria_label)
                                if price_match:
                                    preco = clean_price_text(price_match.group(1))
                                    if preco and float(preco) > 0:
                                        logger.info(f"[CONTINENTE] Preço encontrado via aria-label: €{preco}")
                                        return "Continente", preco, None
                        except:
                            continue
                except:
                    pass
                
                # Fallback: busca por padrão de preço no texto da página
                page_text = driver.page_source
                # Padrões mais específicos para Continente
                price_patterns = [
                    r'ct-price-formatted[^>]*>([^<]*\d+[,\.]\d{2}[^<]*)',  # Dentro de ct-price-formatted
                    r'data-price="(\d+[,\.]\d{2})"',  # Atributo data-price
                    r'(\d+[,\.]\d{2})\s*€',  # Padrão genérico
                    r'€\s*(\d+[,\.]\d{2})',  # € seguido de número
                ]
                
                for pattern in price_patterns:
                    price_match = re.search(pattern, page_text, re.IGNORECASE)
                    if price_match:
                        preco = clean_price_text(price_match.group(1))
                        if preco and float(preco) > 0:
                            logger.info(f"[CONTINENTE] Preço encontrado via regex: €{preco}")
                            return "Continente", preco, None
                
                # Se chegou aqui e o produto está disponível, logar aviso mas não retornar None imediatamente
                if disponivel:
                    logger.warning(f"[CONTINENTE] Produto parece disponível mas preço não foi encontrado. Tentando busca mais ampla...")
                    
                    # Última tentativa: buscar qualquer número que pareça preço na página
                    try:
                        body_text = driver.find_element(By.TAG_NAME, "body").text
                        # Procurar padrões de preço no texto visível
                        price_matches = re.findall(r'(\d+[,\.]\d{2})\s*€', body_text)
                        for match in price_matches:
                            preco = clean_price_text(match)
                            if preco and 0.01 <= float(preco) <= 99999:  # Preço razoável
                                logger.info(f"[CONTINENTE] Preço encontrado via texto da página: €{preco}")
                                return "Continente", preco, None
                    except:
                        pass
                        
            except Exception as e:
                logger.error(f"Erro Continente: {e}")
                import traceback
                traceback.print_exc()
            
            # Se não encontrou preço mas produto está disponível, retornar None (será tratado como erro)
            logger.warning(f"[CONTINENTE] Preço não encontrado para produto (pode estar disponível mas sem preço visível)")
            return "Continente", None, None
        
        # Black Market / Back Market
        elif "blackmarket" in u or "backmarket" in u:
            try:
                sleep(2)  # Aguarda carregamento
                aceitar_cookies(driver)
                sleep(1)
                
                # Seletores para o preço do Black Market
                selectors = [
                    "span.heading-2",
                    ".heading-2",
                    "span[class*='price']",
                    ".price",
                    "[data-testid*='price']"
                ]
                
                for selector in selectors:
                    try:
                        WebDriverWait(driver, 5).until(
                            EC.visibility_of_element_located((By.CSS_SELECTOR, selector))
                        )
                        el = driver.find_element(By.CSS_SELECTOR, selector)
                        preco = clean_price_text(el.text)
                        if preco:
                            return "Black Market", preco, None
                    except:
                        continue
                
                # Fallback: busca por padrão de preço no texto da página
                page_text = driver.page_source
                price_match = re.search(r'(\d+[,\.]\d{2})\s*€', page_text)
                if price_match:
                    preco = clean_price_text(price_match.group(1))
                    if preco:
                        return "Black Market", preco, None
                        
            except Exception as e:
                logger.error(f"Erro Black Market: {e}")
            return "Black Market", None, None
        
        # Leroy Merlin
        elif "leroymerlin" in u or "leroy-merlin" in u:
            try:
                logger.debug("[EXTRACT] Tentando extrair preço da Leroy Merlin...")
                sleep(3)  # Aguarda carregamento
                aceitar_cookies(driver)
                sleep(2)
                
                # Estrutura Leroy Merlin: span.m-price_line contém o inteiro e span.m-price_decimal contém a parte decimal
                try:
                    # Buscar span.m-price_line que contém o preço principal
                    price_line = driver.find_element(By.CSS_SELECTOR, "span.m-price_line")
                    
                    # O texto do span.m-price_line contém o número inteiro
                    texto_completo = price_line.text.strip()
                    
                    # Tentar buscar span.m-price_decimal dentro do price_line
                    try:
                        decimal_element = price_line.find_element(By.CSS_SELECTOR, "span.m-price_decimal")
                        decimal_text = decimal_element.text.strip()
                        # Extrair apenas números da parte decimal (pode ter vírgula e €)
                        decimal_match = re.search(r'(\d{2})', decimal_text)
                        if decimal_match:
                            decimal = decimal_match.group(1)
                        else:
                            decimal = ""
                    except:
                        decimal = ""
                    
                    # Extrair número inteiro do texto
                    inteiro_match = re.search(r'(\d+)', texto_completo)
                    if inteiro_match:
                        inteiro = inteiro_match.group(1)
                        
                        if decimal:
                            preco = clean_price_text(f"{inteiro},{decimal}")
                        else:
                            preco = clean_price_text(inteiro)
                        
                        if preco and float(preco) > 0:
                            logger.info(f"[LEROY] Preço encontrado (m-price_line + m-price_decimal): €{preco}")
                            return "Leroy Merlin", preco, None
                    else:
                        # Se não encontrou padrão, tentar limpar o texto completo
                        preco = clean_price_text(texto_completo)
                        if preco and float(preco) > 0:
                            logger.info(f"[LEROY] Preço encontrado (m-price_line completo): €{preco}")
                            return "Leroy Merlin", preco, None
                except Exception as e:
                    logger.debug(f"[LEROY] Erro ao buscar m-price_line: {e}")
                    pass
                
                # Seletores alternativos para Leroy Merlin
                selectors = [
                    "span.m-price_line",
                    ".m-price_line",
                    ".kl-price",
                    ".m-price.-main",
                    ".price-value",
                    ".product-price",
                    ".price",
                    "[data-testid*='price']",
                    ".current-price",
                    "span.price",
                    "[class*='price']",
                    "[class*='Price']",
                    ".lm-price",
                    "[data-price]"
                ]
                
                for selector in selectors:
                    try:
                        WebDriverWait(driver, 5).until(
                            EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                        )
                        elementos = driver.find_elements(By.CSS_SELECTOR, selector)
                        
                        for el in elementos:
                            try:
                                if el.is_displayed():
                                    texto_preco = el.text.strip()
                                    preco = clean_price_text(texto_preco)
                                    if preco and float(preco) > 0:
                                        logger.info(f"[LEROY] Preço encontrado com seletor {selector}: €{preco}")
                                        return "Leroy Merlin", preco, None
                            except:
                                continue
                    except:
                        continue
                
                # Tentar atributo data-price
                try:
                    price_elements = driver.find_elements(By.CSS_SELECTOR, "[data-price]")
                    for el in price_elements:
                        try:
                            data_price = el.get_attribute("data-price")
                            if data_price:
                                preco = clean_price_text(data_price)
                                if preco and float(preco) > 0:
                                    logger.info(f"[LEROY] Preço encontrado via data-price: €{preco}")
                                    return "Leroy Merlin", preco, None
                        except:
                            continue
                except:
                    pass
                
                # Fallback: busca por padrão de preço no texto da página
                page_text = driver.page_source
                price_patterns = [
                    r'(\d{1,6}[,\.]\d{2})\s*€',
                    r'€\s*(\d{1,6}[,\.]\d{2})',
                    r'price["\']?\s*:\s*["\']?(\d{1,6}[,\.]\d{2})',
                ]
                
                for pattern in price_patterns:
                    price_match = re.search(pattern, page_text, re.IGNORECASE)
                    if price_match:
                        preco = clean_price_text(price_match.group(1))
                        if preco and float(preco) > 0:
                            logger.info(f"[LEROY] Preço encontrado via regex: €{preco}")
                            return "Leroy Merlin", preco, None
                            
            except Exception as e:
                logger.error(f"[LEROY] Erro ao extrair preço: {e}")
                import traceback
                traceback.print_exc()
            return "Leroy Merlin", None, None
        
        # Fallback genérico
        else:
            try:
                logger.debug("[EXTRACT] Loja não reconhecida, tentando fallback genérico...")
                page_text = driver.page_source
                price_match = re.search(r'(\d{1,6}[,\.]\d{2})\s*€', page_text)
                if price_match:
                    preco = clean_price_text(price_match.group(1))
                    if preco:
                        logger.info(f"[GENÉRICO] Preço encontrado: €{preco}")
                        return "Genérico", preco, None
            except Exception as e:
                logger.debug(f"[GENÉRICO] Erro no fallback: {e}")
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
                # Converter VerificacaoIntervalo para float (pode vir como string do banco)
                plano_intervalo = float(p.get("VerificacaoIntervalo", 24))
                plano_nome = p["PlanoNome"]
                preco_alvo = p["PrecoAlvo"]
                
                # Verifica se deve atualizar
                if not should_update_product(pid, plano_intervalo):
                    aguardando += 1
                    logger.debug(f"[SKIP] {nome}: aguardando intervalo de {plano_intervalo}h")
                    continue
                
                atualizados += 1
                started = time()
                
                try:
                    logger.info(f"[SCRAPING] Extraindo preço de {nome} ({link})...")
                    loja, preco, flag = extract_price(driver, link)
                    
                    if preco is not None:
                        preco = round(float(preco), 2)
                        logger.info(f"[OK] {nome} ({loja}): €{preco} [{round(time()-started,2)}s]")
                        update_price_and_history(pid, preco)
                        
                        if check_target_reached(pid, preco, preco_alvo):
                            metas += 1
                    else:
                        logger.warning(f"[ERRO] {nome}: preço não encontrado em {link}")
                        logger.warning(f"[ERRO] Loja detectada: {loja}, Flag: {flag}")
                        
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
                # Converter VerificacaoIntervalo para float (pode vir como string do banco)
                intervalo = float(p.get("VerificacaoIntervalo", 24))
                
                if abs(intervalo - 5/60) < 0.001:  # Premium
                    intervalos.add(300)  # 5 min
                elif intervalo == 0.5:  # Standard
                    intervalos.add(1800)  # 30 min
                elif intervalo == 4:  # Basic
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
        
def extract_product_info(driver, url):
    """
    Extrai informações relevantes do produto da página.
    Retorna título e texto relevante limitado para análise pela IA.
    """
    try:
        driver.get(url)
        aceitar_cookies(driver)
        sleep(2)
        
        # Extrair título (preferencialmente h1)
        title = ""
        try:
            # Tentar h1 primeiro
            title = driver.find_element(By.TAG_NAME, "h1").text.strip()
        except:
            try:
                # Fallback para outros seletores de título
                title_selectors = [
                    "h1.product-title",
                    "h1[class*='title']",
                    ".product-title",
                    "h2.product-name",
                    "[data-testid*='title']"
                ]
                for selector in title_selectors:
                    try:
                        title = driver.find_element(By.CSS_SELECTOR, selector).text.strip()
                        if title:
                            break
                    except:
                        continue
            except:
                pass
        
        # Extrair texto relevante da página (limitado)
        # Priorizar elementos com informações do produto
        relevant_text_parts = []
        
        # Tentar extrair descrição do produto
        try:
            desc_selectors = [
                "#productDescription",
                ".product-description",
                "[data-testid*='description']",
                ".description",
                "#description"
            ]
            for selector in desc_selectors:
                try:
                    desc = driver.find_element(By.CSS_SELECTOR, selector).text.strip()
                    if desc and len(desc) > 20:
                        relevant_text_parts.append(desc[:1000])  # Limitar descrição
                        break
                except:
                    continue
        except:
            pass
        
        # Extrair informações técnicas se disponíveis
        try:
            spec_selectors = [
                ".product-specs",
                ".specifications",
                "[data-testid*='spec']",
                ".technical-details"
            ]
            for selector in spec_selectors:
                try:
                    specs = driver.find_element(By.CSS_SELECTOR, selector).text.strip()
                    if specs and len(specs) > 20:
                        relevant_text_parts.append(specs[:500])
                        break
                except:
                    continue
        except:
            pass
        
        # Se não encontrou elementos específicos, usar parte do page_source
        if not relevant_text_parts:
            # Extrair texto visível da página (mais relevante que HTML completo)
            try:
                body_text = driver.find_element(By.TAG_NAME, "body").text.strip()
                # Limitar a primeiras linhas relevantes
                relevant_text_parts.append(body_text[:3000])
            except:
                # Último fallback: page_source limitado
                relevant_text_parts.append(driver.page_source[:3000])
        
        # Combinar todo o texto relevante
        raw_text = " ".join(relevant_text_parts)
        # Limitar tamanho total (máximo 5000 caracteres para economia de tokens)
        raw_text = raw_text[:5000]
        
        return {
            "title": title,
            "url": url,
            "raw_text": raw_text
        }
    except Exception as e:
        logger.error(f"Erro ao extrair informações do produto: {e}")
        # Retornar estrutura mínima em caso de erro
        return {
            "title": "",
            "url": url,
            "raw_text": ""
        }

# ==================== CLASSE WRAPPER PARA SCHEDULER ====================

class PriceScraper:
    """Wrapper class para o scraper, compatível com scheduler"""
    
    def __init__(self):
        """Inicializar scraper"""
        self.driver = None
        logger.info("PriceScraper inicializado")
    
    def scrape_all_products(self):
        """Executar scraping de todos os produtos uma vez"""
        driver = None
        try:
            driver = create_driver()
            logger.info("Executando scraping de todos os produtos...")
            
            produtos = fetch_products()
            logger.info(f"[{len(produtos)} produtos] {datetime.now().strftime('%H:%M:%S')}")
            
            atualizados = 0
            aguardando = 0
            metas = 0
            
            for p in produtos:
                pid = p["Id"]
                nome = p["Nome"]
                link = p["Link"]
                # Converter VerificacaoIntervalo para float (pode vir como string do banco)
                plano_intervalo = float(p.get("VerificacaoIntervalo", 24))
                preco_alvo = p.get("PrecoAlvo")
                
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
            logger.error(f"Erro no scraping: {e}")
            traceback.print_exc()
        finally:
            if driver:
                safe_quit(driver)
                logger.info("Driver fechado")

if __name__ == "__main__":
    monitor_loop()


    