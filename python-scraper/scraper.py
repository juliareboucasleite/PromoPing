#!/usr/bin/env python3
import os
import re
import traceback
from datetime import datetime
from time import sleep
import mysql.connector
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import logging
from config import DB_CONFIG, SCRAPER_CONFIG, LOGGING_CONFIG

# ==================== LOGGING ====================

os.makedirs(os.path.dirname(LOGGING_CONFIG["file"]), exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(LOGGING_CONFIG["file"]),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# ==================== DB ====================

def connect_db():
    return mysql.connector.connect(**DB_CONFIG)

def fetch_products():
    conn = connect_db()
    cur = conn.cursor(dictionary=True)
    cur.execute("""
        SELECT Id, Nome, Link, PrecoAlvo
        FROM produtos
        WHERE Link IS NOT NULL AND Link <> '' AND DeletedAt IS NULL
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows

def update_price(product_id, price):
    conn = connect_db()
    cur = conn.cursor()
    cur.execute("""
        UPDATE produtos
        SET PrecoAtual=%s, UpdatedAt=NOW()
        WHERE Id=%s
    """, (price, product_id))
    conn.commit()
    cur.close()
    conn.close()

def save_price_history(product_id, price):
    """Salva o preço no histórico de preços"""
    conn = connect_db()
    cur = conn.cursor()
    try:
        # Inserir no histórico (a tabela já existe)
        # Usar ProdutoId (com 'I' maiúsculo) conforme a estrutura real da tabela
        cur.execute("""
            INSERT INTO historicoprecos (ProdutoId, Preco, DataRegisto)
            VALUES (%s, %s, NOW())
        """, (product_id, price))
        conn.commit()
        logger.info(f"[HISTORICO] Preço €{price} salvo no histórico para produto {product_id}")
    except mysql.connector.Error as e:
        # Se a tabela não existir ou houver erro de estrutura, tentar criar
        if e.errno == 1146:  # Table doesn't exist
            logger.warning(f"[HISTORICO] Tabela não existe, tentando criar...")
            try:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS historicoprecos (
                        Id INT AUTO_INCREMENT PRIMARY KEY,
                        ProdutoId INT NOT NULL,
                        Preco DECIMAL(10,2) NOT NULL,
                        DataRegisto DATETIME DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_produto (ProdutoId),
                        INDEX idx_data (DataRegisto)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """)
                conn.commit()
                # Tentar inserir novamente
                cur.execute("""
                    INSERT INTO historicoprecos (ProdutoId, Preco, DataRegisto)
                    VALUES (%s, %s, NOW())
                """, (product_id, price))
                conn.commit()
                logger.info(f"[HISTORICO] Tabela criada e preço €{price} salvo para produto {product_id}")
            except Exception as e2:
                logger.error(f"[HISTORICO] Erro ao criar tabela ou inserir: {e2}")
                conn.rollback()
        else:
            logger.error(f"[HISTORICO] Erro ao salvar histórico: {e}")
            conn.rollback()
    except Exception as e:
        logger.error(f"[HISTORICO] Erro inesperado ao salvar histórico: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

# ==================== DRIVER ====================

def create_driver():
    opts = uc.ChromeOptions()

    # Desativar headless para debug - ver o que está acontecendo
    # opts.add_argument("--headless=new")  # COMENTADO PARA DEBUG
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    # opts.add_argument("--disable-gpu")  # COMENTADO - necessário quando não headless
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_argument("--disable-popup-blocking")
    opts.add_argument("--disable-notifications")
    opts.add_argument("--incognito")
    opts.add_argument("--lang=pt-PT")
    opts.add_argument("--start-maximized")
    opts.add_argument("--window-size=1920,1080")
    opts.add_argument(f"--user-agent={SCRAPER_CONFIG['user_agent']}")
    driver = uc.Chrome(options=opts, use_subprocess=True)
    driver.delete_all_cookies()
    return driver

def safe_quit(driver):
    try:
        driver.quit()
    except:
        pass

# ==================== UTIL ====================

def clean_price_text(text):
    if not text:
        return None

    # Remover símbolos de moeda e espaços
    text = text.replace("€", "").replace("EUR", "").replace("\xa0", " ").strip()
    
    # Procurar padrão de preço: números com separador decimal (vírgula ou ponto)
    # Aceita: 379,99 ou 379.99 ou 3.799,99 (milhar) ou 3,799.99
    match = re.search(r'(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})|(\d+[.,]\d{2})', text)
    if match:
        value_str = match.group(0)
        # Se tem vírgula como separador decimal, substituir ponto de milhar e vírgula decimal por ponto
        if ',' in value_str and '.' in value_str:
            # Formato: 3.799,99 (ponto = milhar, vírgula = decimal)
            value_str = value_str.replace('.', '').replace(',', '.')
        elif ',' in value_str:
            # Formato: 379,99 (vírgula = decimal)
            value_str = value_str.replace(',', '.')
        # Se só tem ponto, assumir que é decimal (379.99)
        # value_str já está correto
        
        try:
            value = float(value_str)
            return round(value, 2)
        except:
            pass
    
    # Fallback: procurar qualquer número com vírgula ou ponto
    match = re.search(r'(\d+[,\.]\d+)', text)
    if match:
        value_str = match.group(1).replace(',', '.')
        try:
            value = float(value_str)
            return round(value, 2)
        except:
            pass
    
    return None

def aceitar_cookies(driver):
    try:
        for b in driver.find_elements(By.TAG_NAME, "button"):
            if "aceitar" in b.text.lower():
                b.click()
                sleep(1)
                break
    except:
        pass

def fechar_modais(driver):
    """Fecha modais de localização e outros popups"""
    try:
        # Fechar modal de localização Leroy Merlin
        try:
            close_buttons = driver.find_elements(By.CSS_SELECTOR, "button.mc-layer__close, button.js-close-layer, button[class*='close'], button[aria-label*='Fechar'], button[aria-label*='Close']")
            for btn in close_buttons:
                try:
                    if btn.is_displayed():
                        btn.click()
                        logger.debug("[MODAL] Modal de localização fechado")
                        sleep(1)
                        break
                except:
                    continue
        except:
            pass
        
        # Fechar outros modais comuns
        try:
            # Modais com overlay
            overlays = driver.find_elements(By.CSS_SELECTOR, ".mc-layer, .modal, .popup, [class*='overlay'], [id*='modal'], [id*='popup']")
            for overlay in overlays:
                try:
                    if overlay.is_displayed():
                        # Tentar encontrar botão de fechar dentro do overlay
                        close_btn = overlay.find_element(By.CSS_SELECTOR, "button[class*='close'], .close, [aria-label*='Fechar'], [aria-label*='Close']")
                        if close_btn and close_btn.is_displayed():
                            close_btn.click()
                            logger.debug("[MODAL] Modal fechado")
                            sleep(1)
                            break
                except:
                    continue
        except:
            pass
    except:
        pass

# ==================== SCRAPERS POR LOJA ====================

def extract_leroy_price(driver):
    selectors = [
        "span.m-price__line",
        ".m-price__line",
        "span.kl-hidden-accessibility",
        "span.ct-price-formatted",
        "span.value"
    ]

    for selector in selectors:
        try:
            el = WebDriverWait(driver, 10).until(
                EC.visibility_of_element_located((By.CSS_SELECTOR, selector))
            )
            price = clean_price_text(el.text)
            if price:
                return price
        except:
            continue

    return None

def extract_continente_price(driver):
    try:
        # PRIORIDADE 1: span.ct-price-formatted (formato visual)
        try:
            el = WebDriverWait(driver, 10).until(
                EC.visibility_of_element_located((By.CSS_SELECTOR, "span.ct-price-formatted"))
            )
            price = clean_price_text(el.text)
            if price:
                logger.info(f"[CONTINENTE] Preço encontrado via ct-price-formatted: €{price}")
                return price
        except:
            pass
        
        # PRIORIDADE 2: span.value com atributo content
        try:
            value_element = driver.find_element(By.CSS_SELECTOR, "span.value")
            content_value = value_element.get_attribute("content")
            if content_value:
                price = clean_price_text(content_value)
                if price:
                    logger.info(f"[CONTINENTE] Preço encontrado via span.value content: €{price}")
                    return price
        except:
            pass
        
        # PRIORIDADE 3: span.value texto
        try:
            value_element = driver.find_element(By.CSS_SELECTOR, "span.value")
            price = clean_price_text(value_element.text)
            if price:
                logger.info(f"[CONTINENTE] Preço encontrado via span.value texto: €{price}")
                return price
        except:
            pass
            
    except Exception as e:
        logger.debug(f"[CONTINENTE] Erro: {e}")
        pass

    return None

# ==================== EXTRACT PRICE ====================

def extract_price(driver, url):
    logger.info(f"[GET] {url}")
    driver.get(url)
    sleep(3)

    logger.info(f"[DEBUG] URL atual: {driver.current_url}")

    aceitar_cookies(driver)
    fechar_modais(driver)  # Fechar modal de localização e outros popups
    sleep(2)

    u = url.lower()

    # AMAZON
    if "amazon." in u:
        try:
            whole = driver.find_element(By.CSS_SELECTOR, "span.a-price-whole").text
            frac = driver.find_element(By.CSS_SELECTOR, "span.a-price-fraction").text
            return "Amazon", clean_price_text(f"{whole},{frac}")
        except:
            return "Amazon", None

    # WORTEN
    if "worten" in u:
        try:
            # PRIORIDADE 1: Meta tag (mais confiável)
            try:
                meta_price = driver.find_element(By.CSS_SELECTOR, 'meta[itemprop="price"]')
                price_value = meta_price.get_attribute("content")
                if price_value:
                    price = clean_price_text(price_value)
                    if price:
                        logger.info(f"[WORTEN] Preço encontrado via meta tag: €{price}")
                        return "Worten", price
            except:
                pass

            # PRIORIDADE 2: Estrutura span.value + sup.decimal
            try:
                # Aguardar elementos aparecerem
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "span.value, sup.decimal"))
                )
                
                # Buscar span.value (número inteiro)
                inteiro = ""
                try:
                    # Tentar buscar dentro do container primeiro
                    try:
                        price_container = driver.find_element(By.CSS_SELECTOR, "span.price_numbers, span[class*='price_numbers']")
                        value_element = price_container.find_element(By.CSS_SELECTOR, "span.value")
                    except:
                        # Se não encontrar container, buscar diretamente
                        value_element = driver.find_element(By.CSS_SELECTOR, "span.value")
                    
                    # Pegar texto do elemento (pode estar vazio se colapsado, tentar innerHTML)
                    inteiro = value_element.text.strip()
                    if not inteiro:
                        # Se texto vazio, tentar innerHTML
                        inteiro = value_element.get_attribute("innerHTML").strip()
                    
                    # Limpar inteiro - remover apenas símbolos, mas preservar estrutura numérica
                    # Se vier com vírgula ou ponto, pode ser que já seja o número completo
                    inteiro_limpo = inteiro.replace("€", "").strip()
                    
                    # Verificar se já tem separador decimal (vírgula ou ponto seguido de 2 dígitos)
                    if re.search(r'[,\.]\d{2}', inteiro_limpo):
                        # Já tem decimal, tratar como número completo
                        logger.debug(f"[WORTEN] Inteiro já contém decimal: '{inteiro_limpo}'")
                        price = clean_price_text(inteiro_limpo)
                        if price:
                            logger.info(f"[WORTEN] Preço encontrado completo: €{price}")
                            return "Worten", price
                    
                    # Se não tem decimal, remover separadores de milhar (pontos) mas manter vírgulas/pontos decimais
                    # Remover apenas pontos que não sejam seguidos de 2 dígitos (separadores de milhar)
                    inteiro = re.sub(r'\.(?=\d{3})', '', inteiro_limpo)  # Remove pontos de milhar
                    inteiro = inteiro.replace(",", "").replace(".", "").strip()  # Remove vírgulas e pontos restantes
                    logger.debug(f"[WORTEN] Inteiro limpo: '{inteiro}'")
                except Exception as e:
                    logger.debug(f"[WORTEN] Erro ao buscar span.value: {e}")
                    inteiro = ""

                # Buscar sup.decimal (parte decimal)
                decimal = ""
                try:
                    # Tentar buscar dentro do container primeiro
                    try:
                        if 'price_container' not in locals():
                            price_container = driver.find_element(By.CSS_SELECTOR, "span.price_numbers, span[class*='price_numbers']")
                        decimal_element = price_container.find_element(By.CSS_SELECTOR, "sup.decimal")
                    except:
                        # Se não encontrar container, buscar diretamente
                        decimal_element = driver.find_element(By.CSS_SELECTOR, "sup.decimal")
                    
                    decimal = decimal_element.text.strip()
                    # Limpar decimal
                    decimal = decimal.replace(",", "").replace(".", "").replace("€", "").strip()
                    logger.debug(f"[WORTEN] Decimal encontrado: '{decimal}'")
                except Exception as e:
                    logger.debug(f"[WORTEN] Erro ao buscar sup.decimal: {e}")
                    decimal = ""

                # Combinar inteiro e decimal
                if inteiro:
                    if decimal:
                        # Combinar: inteiro + vírgula + decimal (ex: "379" + "," + "99" = "379,99")
                        preco_completo = f"{inteiro},{decimal}"
                        logger.debug(f"[WORTEN] Preço completo antes de limpar: '{preco_completo}'")
                        price = clean_price_text(preco_completo)
                        logger.info(f"[WORTEN] Preço combinado: {inteiro} + {decimal} = €{price}")
                    else:
                        # Apenas inteiro (sem decimal)
                        price = clean_price_text(inteiro)
                        logger.info(f"[WORTEN] Preço apenas inteiro: €{price}")

                    if price:
                        logger.info(f"[WORTEN] Preço encontrado (span.value + sup.decimal): €{price}")
                        return "Worten", price
                else:
                    logger.warning(f"[WORTEN] span.value está vazio! Inteiro: '{inteiro}', Decimal: '{decimal}'")
                    
            except Exception as e:
                logger.error(f"[WORTEN] Erro ao buscar estrutura: {e}")
                import traceback
                traceback.print_exc()
                pass

            return "Worten", None
        except:
            return "Worten", None

    # FNAC
    if "fnac" in u:
        try:
            el = driver.find_element(By.CSS_SELECTOR, "span.f-faPriceBox__price")
            return "FNAC", clean_price_text(el.text)
        except:
            return "FNAC", None

    # LEROY MERLIN
    if "leroymerlin" in u or "leroy-merlin" in u:
        try:
            logger.debug("[EXTRACT] Tentando extrair preço da Leroy Merlin...")
            sleep(3)  # Aguardar carregamento da página
            fechar_modais(driver)  # Fechar modal de localização antes de buscar preço
            sleep(1)  # Aguardar modal fechar
            
            # Aguardar elementos aparecerem com múltiplos seletores
            try:
                WebDriverWait(driver, 10).until(
                    EC.any_of(
                        EC.presence_of_element_located((By.CSS_SELECTOR, "span.m-price__line")),
                        EC.presence_of_element_located((By.CSS_SELECTOR, "span.kl-hidden-accessibility")),
                        EC.presence_of_element_located((By.CSS_SELECTOR, "p.m-price")),
                        EC.presence_of_element_located((By.CSS_SELECTOR, "[class*='price']"))
                    )
                )
            except:
                logger.warning("[LEROY] Elementos de preço não apareceram, tentando continuar...")
            
            # Estrutura Leroy: span.m-price__line (duplo underscore) contém "28" + span.m-price_decimal contém ",09€"
            # Alternativa: span.kl-hidden-accessibility contém "Vendido 28,09 €"
            price_line = None
            
            # Tentativa 1: Buscar dentro de p.m-price primeiro
            try:
                logger.debug("[LEROY] Tentativa 1: Buscar dentro de p.m-price")
                price_container = WebDriverWait(driver, 8).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "p.m-price.-main, p.m-price"))
                )
                price_line = price_container.find_element(By.CSS_SELECTOR, "span.m-price__line")
                logger.debug("[LEROY] Encontrado dentro de p.m-price")
            except Exception as e:
                logger.debug(f"[LEROY] Tentativa 1 falhou: {e}")
            
            # Tentativa 2: Buscar span.m-price_line diretamente
            if not price_line:
                try:
                    logger.debug("[LEROY] Tentativa 2: Buscar span.m-price_line diretamente")
                    price_line = WebDriverWait(driver, 8).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, "span.m-price__line"))
                    )
                    logger.debug("[LEROY] Encontrado span.m-price_line diretamente")
                except Exception as e:
                    logger.debug(f"[LEROY] Tentativa 2 falhou: {e}")
            
            # Tentativa 3: Buscar qualquer elemento com classe m-price_line
            if not price_line:
                try:
                    logger.debug("[LEROY] Tentativa 3: Buscar [class*='m-price_line']")
                    price_line = WebDriverWait(driver, 5).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, "[class*='m-price__line']"))
                    )
                    logger.debug("[LEROY] Encontrado via [class*='m-price_line']")
                except Exception as e:
                    logger.debug(f"[LEROY] Tentativa 3 falhou: {e}")
            
            # Tentativa 4: Buscar span.kl-hidden-accessibility (contém preço completo como fallback)
            if not price_line:
                try:
                    logger.debug("[LEROY] Tentativa 4: Buscar span.kl-hidden-accessibility")
                    accessibility_span = driver.find_element(By.CSS_SELECTOR, "span.kl-hidden-accessibility")
                    accessibility_text = accessibility_span.text.strip()
                    logger.debug(f"[LEROY] Texto de kl-hidden-accessibility: '{accessibility_text}'")
                    
                    # Extrair preço do texto (ex: "Vendido 28,09 €")
                    price_match = re.search(r'(\d+[,\.]\d{2})\s*€?', accessibility_text)
                    if price_match:
                        price_str = price_match.group(1)
                        price = clean_price_text(price_str)
                        if price:
                            logger.info(f"[LEROY] Preço encontrado via kl-hidden-accessibility: €{price}")
                            return "Leroy Merlin", price
                except Exception as e:
                    logger.debug(f"[LEROY] Tentativa 4 (kl-hidden-accessibility) falhou: {e}")
            
            if not price_line:
                logger.error("[LEROY] Não foi possível encontrar span.m-price__line após todas as tentativas")
                # Tentar fallback
                return "Leroy Merlin", extract_leroy_price(driver)
            
            # Continuar com a extração
            try:
                
                # O texto do price_line contém o número inteiro diretamente (ex: "28")
                texto_completo = price_line.text.strip()
                logger.debug(f"[LEROY] Texto completo do m-price__line: '{texto_completo}'")
                
                # Extrair inteiro do texto (pode ter espaços ou outros caracteres)
                inteiro_match = re.search(r'(\d+)', texto_completo)
                if inteiro_match:
                    inteiro = inteiro_match.group(1)
                    logger.debug(f"[LEROY] Inteiro extraído: '{inteiro}'")
                else:
                    # Se não encontrou no texto, tentar buscar diretamente os nós de texto
                    inteiro = texto_completo.replace("€", "").replace(",", "").replace(".", "").strip()
                    # Remover tudo que não é número
                    inteiro = re.sub(r'[^\d]', '', inteiro)
                    logger.debug(f"[LEROY] Inteiro limpo: '{inteiro}'")

                # Buscar span.m-price_decimal dentro do price_line
                decimal = ""
                try:
                    decimal_element = price_line.find_element(By.CSS_SELECTOR, "span.m-price_decimal")
                    decimal_text = decimal_element.text.strip()
                    logger.debug(f"[LEROY] Texto do m-price_decimal: '{decimal_text}'")
                    
                    # Extrair apenas os 2 dígitos decimais (pode ter ",09" ou ",09€")
                    decimal_match = re.search(r'(\d{2})', decimal_text)
                    if decimal_match:
                        decimal = decimal_match.group(1)
                        logger.debug(f"[LEROY] Decimal extraído: '{decimal}'")
                    else:
                        # Se não encontrou, limpar e pegar números
                        decimal = re.sub(r'[^\d]', '', decimal_text)
                        if len(decimal) >= 2:
                            decimal = decimal[:2]
                        logger.debug(f"[LEROY] Decimal limpo: '{decimal}'")
                except Exception as e:
                    logger.debug(f"[LEROY] Erro ao buscar m-price_decimal: {e}")
                    decimal = ""

                # Combinar inteiro e decimal
                if inteiro:
                    if decimal:
                        price = clean_price_text(f"{inteiro},{decimal}")
                        logger.info(f"[LEROY] Preço combinado: {inteiro} + {decimal} = €{price}")
                    else:
                        price = clean_price_text(inteiro)
                        logger.info(f"[LEROY] Preço apenas inteiro: €{price}")

                    if price:
                        logger.info(f"[LEROY] Preço encontrado: €{price}")
                        return "Leroy Merlin", price
                else:
                    logger.warning(f"[LEROY] Inteiro não encontrado! Texto completo: '{texto_completo}'")
                    
            except Exception as e:
                logger.error(f"[LEROY] Erro ao buscar estrutura m-price__line: {e}")
                import traceback
                traceback.print_exc()
                pass

            # Fallback para seletores alternativos
            logger.debug("[LEROY] Tentando fallback...")
            return "Leroy Merlin", extract_leroy_price(driver)
        except Exception as e:
            logger.error(f"[LEROY] Erro geral: {e}")
            return "Leroy Merlin", None

    # CONTINENTE
    if "continente.pt" in u:
        return "Continente", extract_continente_price(driver)

    # FALLBACK
    try:
        body = driver.find_element(By.TAG_NAME, "body").text
        matches = re.findall(r'(\d+[,\.]\d{2})\s*€', body)
        if matches:
            return "Genérico", clean_price_text(matches[0])
    except:
        pass

    return "Desconhecida", None

# ==================== MAIN ====================

def monitor_loop():
    driver = create_driver()
    logger.info("PromoPing scraper iniciado")

    try:
        produtos = fetch_products()

        for p in produtos:
            loja, preco = extract_price(driver, p["Link"])

            if preco:
                logger.info(f"[OK] {p['Nome']} ({loja}) €{preco}")
                update_price(p["Id"], preco)
                save_price_history(p["Id"], preco)  # Salvar no histórico da base de dados
            else:
                logger.warning(f"[FAIL] {p['Nome']} sem preço ({loja})")

            sleep(2)

    except Exception as e:
        logger.error(e)
        traceback.print_exc()

    finally:
        safe_quit(driver)
        logger.info("Driver encerrado")

# ==================== ENTRY ====================

if __name__ == "__main__":
    monitor_loop()
