import os
import re
import traceback
from datetime import datetime
from time import sleep
from urllib.parse import urlparse
import psycopg2
import psycopg2.errors
from psycopg2.extras import RealDictCursor
import requests
from bs4 import BeautifulSoup
try:
    from curl_cffi import requests as curl_requests
    HAS_CURL_CFFI = True
except ImportError:
    HAS_CURL_CFFI = False
import undetected_chromedriver as uc
from selenium.common.exceptions import SessionNotCreatedException, WebDriverException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import logging
from config import DB_CONFIG, SCRAPER_CONFIG, LOGGING_CONFIG

# Force sensible defaults for Chrome when .env is missing or broken
os.environ.setdefault('CHROME_BIN', '/usr/bin/chromium-browser')
os.environ.setdefault('CHROMEDRIVER_PATH', '/usr/bin/chromedriver')

# ==================== LOGGING ====================

if not LOGGING_CONFIG["file"]:
    LOGGING_CONFIG["file"] = "python-scraper/logs/scraper.log"

log_dir = os.path.dirname(LOGGING_CONFIG["file"]) or "python-scraper/logs"
os.makedirs(log_dir, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(LOGGING_CONFIG["file"]),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)
BACKEND_INTERNAL_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:3000").rstrip("/")
INTERNAL_NEWSLETTER_SECRET = os.getenv("INTERNAL_NEWSLETTER_SECRET", "").strip()
PROMOTION_NEWSLETTER_THRESHOLD = float(os.getenv("PROMOTION_NEWSLETTER_THRESHOLD", "0.10"))
MAX_PRICE_DROP_RATIO = float(os.getenv("MAX_PRICE_DROP_RATIO", "0.85"))
MIN_PLAUSIBLE_PRICE = float(os.getenv("MIN_PLAUSIBLE_PRICE", "0.5"))


def is_plausible_price(current_price, previous_price=None):
    try:
        current = float(current_price)
    except (TypeError, ValueError):
        return False

    if current <= 0 or current < MIN_PLAUSIBLE_PRICE or current > 50000:
        return False

    if previous_price is None:
        return True

    try:
        previous = float(previous_price)
    except (TypeError, ValueError):
        return True

    if previous <= 0:
        return True

    if current == previous:
        return True

    drop_ratio = (previous - current) / previous
    increase_ratio = (current - previous) / previous

    if drop_ratio > MAX_PRICE_DROP_RATIO:
        return False
    if increase_ratio > 2.5:
        return False
    if previous >= 50 and current < previous * 0.2:
        return False
    if previous >= 100 and current < 10:
        return False

    return True


def record_price_update(product_id, price):
    headers = {}
    if INTERNAL_NEWSLETTER_SECRET:
        headers["X-Internal-Secret"] = INTERNAL_NEWSLETTER_SECRET

    response = requests.post(
        f"{BACKEND_INTERNAL_URL}/api/newsletter/internal/record-price",
        json={"productId": product_id, "price": price},
        headers=headers,
        timeout=15,
    )

    if response.status_code == 422:
        logger.warning(
            f"[SCRAPER] Preço ignorado para produto {product_id}: resposta 422 ({response.text[:200]})"
        )
        return False

    if not response.ok:
        logger.warning(
            f"[SCRAPER] Falha ao registar preço do produto {product_id}: "
            f"{response.status_code} {response.text[:200]}"
        )
        return False

    return True

# Avisar se Google OAuth estiver ausente — relevante se algum site usa login Google
missing_google_id = not os.getenv('GOOGLE_CLIENT_ID')
missing_google_secret = not os.getenv('GOOGLE_CLIENT_SECRET')
if missing_google_id or missing_google_secret:
    parts = []
    if missing_google_id:
        parts.append('GOOGLE_CLIENT_ID: Ausente')
    if missing_google_secret:
        parts.append('GOOGLE_CLIENT_SECRET: Ausente')
    logger.warning('Google OAuth ausente — ' + ', '.join(parts) + '. Se um site requerer login via Google, o scraping pode falhar.')

# ==================== DB ====================

def connect_db():
    return psycopg2.connect(**DB_CONFIG)

def fetch_products():
    conn = connect_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT p.Id AS "Id", p.Nome AS "Nome", p.Link AS "Link",
               p.PrecoAtual AS "PrecoAtual", p.PrecoAlvo AS "PrecoAlvo", p.UpdatedAt AS "UpdatedAt",
               COALESCE(NULLIF(regexp_replace(pl.intervaloverificacao, '\\D', '', 'g'), '')::int, 24) AS "VerificacaoIntervalo"
        FROM produtos p
        LEFT JOIN configutilizador cu ON cu.referenciaid = p.ReferenciaID
        LEFT JOIN planos pl ON pl.id = cu.planoativoid
        WHERE p.Link IS NOT NULL AND p.Link <> '' AND p.DeletedAt IS NULL
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

def apply_price_update(product, price, store=None):
    product_id = product["Id"]
    previous_price = product.get("PrecoAtual")

    if not is_plausible_price(price, previous_price):
        logger.warning(
            f"[SCRAPER] Preço suspeito ignorado para {product.get('Nome')}: "
            f"{previous_price} -> {price}"
        )
        return False

    if record_price_update(product_id, price):
        product["PrecoAtual"] = price
        maybe_notify_promotion_subscribers(product, previous_price, price, store)
        return True

    logger.warning(
        f"[SCRAPER] API interna indisponível para produto {product_id}; "
        "a usar fallback local sem alertas automáticos."
    )
    update_price(product_id, price)
    save_price_history(product_id, price)
    maybe_notify_promotion_subscribers(product, previous_price, price, store)
    return True


def maybe_notify_promotion_subscribers(product, previous_price, current_price, store=None):
    try:
        if previous_price is None:
            return

        if not is_plausible_price(current_price, previous_price):
            return

        previous_value = float(previous_price)
        current_value = float(current_price)
        if previous_value <= 0 or current_value >= previous_value:
            return

        drop_ratio = (previous_value - current_value) / previous_value
        if drop_ratio <= PROMOTION_NEWSLETTER_THRESHOLD:
            return

        headers = {}
        if INTERNAL_NEWSLETTER_SECRET:
            headers["X-Internal-Secret"] = INTERNAL_NEWSLETTER_SECRET

        payload = {
            "product": {
                "Id": product.get("Id"),
                "Nome": product.get("Nome"),
                "Link": product.get("Link"),
                "Loja": store or product.get("Loja"),
            },
            "novoPreco": current_value,
            "precoAnterior": previous_value,
        }

        response = requests.post(
            f"{BACKEND_INTERNAL_URL}/api/newsletter/internal/promotion",
            json=payload,
            headers=headers,
            timeout=10,
        )

        if response.ok:
            logger.info(
                f"[NEWSLETTER] Promoção enviada para subscritores do produto {product.get('Id')} "
                f"({drop_ratio * 100:.1f}% de redução)"
            )
        else:
            logger.warning(
                f"[NEWSLETTER] Falha ao notificar promoção do produto {product.get('Id')}: "
                f"{response.status_code} {response.text[:200]}"
            )
    except Exception as err:
        logger.warning(f"[NEWSLETTER] Erro ao notificar promoção: {err}")

def should_update_product(product, current_time=None):
    """
    Verifica se um produto deve ser atualizado baseado no plano e última verificação.
    
    Intervalo de verificação (horas) por tipo de plano:
    - Premium: 1h
    - Standard: 4h 
    - Basic: 8h
    - Free: 24h
    
    Se UpdatedAt é NULL (produto novo), atualiza imediatamente.
    """
    if current_time is None:
        current_time = datetime.now()
    
    updated_at = product.get("UpdatedAt")
    intervalo_horas = product.get("VerificacaoIntervalo", 24)  # Default 24h (Free)
    
    # Se nunca foi atualizado (NULL), deve atualizar imediatamente (produto novo)
    if updated_at is None:
        return True
    
    # Calcular tempo decorrido desde última verificação
    if isinstance(updated_at, str):
        try:
            updated_at = datetime.strptime(updated_at, '%Y-%m-%d %H:%M:%S')
        except:
            # Se não conseguir fazer parse, assume que deve atualizar
            return True
    
    tempo_decorrido = (current_time - updated_at).total_seconds() / 3600  # em horas
    
    # Se tempo decorrido >= intervalo, deve atualizar
    return tempo_decorrido >= intervalo_horas


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
    except psycopg2.errors.UndefinedTable as e:
        logger.warning(f"[HISTORICO] Tabela não existe, tentando criar...")
        conn.rollback()
        try:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS historicoprecos (
                    Id SERIAL PRIMARY KEY,
                    ProdutoId INTEGER NOT NULL,
                    Preco NUMERIC(10,2) NOT NULL,
                    DataRegisto TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_historicoprecos_produto ON historicoprecos (ProdutoId)")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_historicoprecos_data ON historicoprecos (DataRegisto)")
            conn.commit()
            cur.execute("""
                INSERT INTO historicoprecos (ProdutoId, Preco, DataRegisto)
                VALUES (%s, %s, NOW())
            """, (product_id, price))
            conn.commit()
            logger.info(f"[HISTORICO] Tabela criada e preço €{price} salvo para produto {product_id}")
        except Exception as e2:
            logger.error(f"[HISTORICO] Erro ao criar tabela ou inserir: {e2}")
            conn.rollback()
    except psycopg2.Error as e:
        logger.error(f"[HISTORICO] Erro ao salvar histórico: {e}")
        conn.rollback()
    except Exception as e:
        logger.error(f"[HISTORICO] Erro inesperado ao salvar histórico: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

# ==================== DRIVER ====================

def get_chrome_major_version():
    """
    Resolve a versão major do Chrome.
    Prioridade:
    1) CHROME_VERSION_MAIN no ambiente
    2) Registro do Windows (BLBeacon)
    """
    env_version = os.getenv("CHROME_VERSION_MAIN", "").strip()
    if env_version:
        try:
            return int(env_version)
        except ValueError:
            logger.warning(f"CHROME_VERSION_MAIN inválido: '{env_version}'. Usando autodetecção.")

    if os.name != "nt":
        return None

    try:
        import winreg

        reg_paths = [
            (winreg.HKEY_CURRENT_USER, r"Software\\Google\\Chrome\\BLBeacon"),
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\\Google\\Chrome\\BLBeacon"),
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\\WOW6432Node\\Google\\Chrome\\BLBeacon"),
        ]

        for hive, subkey in reg_paths:
            try:
                with winreg.OpenKey(hive, subkey) as key:
                    version, _ = winreg.QueryValueEx(key, "version")
                major = int(str(version).split(".", 1)[0])
                if major > 0:
                    return major
            except OSError:
                continue
    except Exception as err:
        logger.debug(f"Falha ao detectar versão do Chrome no registro: {err}")

    return None

def resolve_existing_path(*candidates):
    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            return candidate
    return None


def get_browser_executable_path():
    candidates = [
        SCRAPER_CONFIG.get('chrome_bin'),
        os.environ.get('CHROME_BIN'),
    ]

    if os.name == "nt":
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        program_files = os.environ.get("PROGRAMFILES", r"C:\Program Files")
        program_files_x86 = os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")
        candidates.extend([
            os.path.join(program_files, "Google", "Chrome", "Application", "chrome.exe"),
            os.path.join(program_files_x86, "Google", "Chrome", "Application", "chrome.exe"),
            os.path.join(local_app_data, "Google", "Chrome", "Application", "chrome.exe"),
            os.path.join(program_files, "Chromium", "Application", "chrome.exe"),
            os.path.join(program_files_x86, "Chromium", "Application", "chrome.exe"),
        ])
    else:
        candidates.extend([
            "/usr/bin/google-chrome",
            "/usr/bin/chromium-browser",
            "/usr/bin/chromium",
        ])

    return resolve_existing_path(*candidates)


def get_chromedriver_path():
    candidates = [
        SCRAPER_CONFIG.get('chromedriver_path'),
        os.environ.get('CHROMEDRIVER_PATH'),
    ]

    if os.name == "nt":
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        program_files = os.environ.get("PROGRAMFILES", r"C:\Program Files")
        candidates.extend([
            os.path.join(program_files, "ChromeDriver", "chromedriver.exe"),
            os.path.join(local_app_data, "Programs", "Python", "Python313", "Scripts", "chromedriver.exe"),
        ])
    else:
        candidates.extend([
            "/usr/bin/chromedriver",
            "/usr/local/bin/chromedriver",
        ])

    return resolve_existing_path(*candidates)


def extract_browser_major_from_error(err):
    """Extrai a versão major do Chrome da mensagem de erro do Selenium."""
    match = re.search(r"Current browser version is\s+(\d+)\.", str(err))
    if match:
        return int(match.group(1))
    return None


def start_chrome_with_version(options, version_main=None, headless=False):
    browser_exec = get_browser_executable_path()
    driver_exec = get_chromedriver_path()
    chrome_kwargs = {
        "options": options,
        "use_subprocess": True,
        "headless": headless,
    }

    if browser_exec:
        chrome_kwargs["browser_executable_path"] = browser_exec
    if driver_exec:
        chrome_kwargs["driver_executable_path"] = driver_exec

    if version_main:
        logger.info(f"Iniciando ChromeDriver com version_main={version_main} (headless={headless})")
        return uc.Chrome(version_main=version_main, **chrome_kwargs)

    logger.info(f"Iniciando ChromeDriver com autodetecção de versão (headless={headless})")
    return uc.Chrome(**chrome_kwargs)


def build_options():
    options = uc.ChromeOptions()
    browser_exec = get_browser_executable_path()
    if browser_exec:
        options.binary_location = browser_exec
    # Use new headless mode
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    # Keep other sensible defaults
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-popup-blocking")
    options.add_argument("--disable-notifications")
    options.add_argument("--incognito")
    options.add_argument("--lang=pt-PT")
    options.add_argument("--window-size=1920,1080")
    options.add_argument(f"--user-agent={SCRAPER_CONFIG['user_agent']}")
    return options

def create_driver():
    headless = bool(SCRAPER_CONFIG.get("headless"))

    # If a chromedriver path is provided in config, export it to the environment
    if SCRAPER_CONFIG.get('chromedriver_path'):
        os.environ['CHROMEDRIVER_PATH'] = SCRAPER_CONFIG['chromedriver_path']

    version_main = get_chrome_major_version()

    try:
        driver = start_chrome_with_version(build_options(), version_main, headless=headless)
    except SessionNotCreatedException as err:
        browser_major = extract_browser_major_from_error(err)
        if browser_major and browser_major != version_main:
            logger.warning(
                f"Incompatibilidade de driver detectada (driver={version_main}, browser={browser_major}). Tentando novamente."
            )
            driver = start_chrome_with_version(build_options(), browser_major, headless=headless)
        else:
            logger.warning("Falha com version_main explícita; tentando autodetecção total do undetected_chromedriver.")
            driver = start_chrome_with_version(build_options(), headless=headless)

    driver.delete_all_cookies()
    return driver

def safe_quit(driver):
    try:
        if driver:
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

def is_amazon_url(url):
    if not url:
        return False

    try:
        hostname = (urlparse(url).hostname or "").lower()
    except Exception:
        hostname = str(url).lower()

    if hostname.startswith("www."):
        hostname = hostname[4:]

    return hostname.startswith("amazon.") or ".amazon." in hostname or hostname in ("amzn.eu", "amzn.to")

def extract_first_price_from_elements(driver, selectors, log_prefix):
    for selector in selectors:
        try:
            elements = driver.find_elements(By.CSS_SELECTOR, selector)
        except Exception as err:
            logger.debug(f"[{log_prefix}] Erro ao buscar seletor '{selector}': {err}")
            continue

        for el in elements:
            raw_candidates = [
                el.text,
                el.get_attribute("textContent"),
                el.get_attribute("innerText"),
                el.get_attribute("content"),
                el.get_attribute("aria-label"),
                el.get_attribute("value"),
            ]

            for raw_text in raw_candidates:
                price = clean_price_text(raw_text)
                if price:
                    logger.info(f"[{log_prefix}] Preço encontrado via seletor '{selector}': €{price}")
                    return price

    return None

def extract_amazon_price(driver):
    selectors = [
        "#corePrice_feature_div span.a-price span.a-offscreen",
        "#corePriceDisplay_desktop_feature_div span.a-price span.a-offscreen",
        "#corePrice_desktop span.a-price span.a-offscreen",
        "#apex_desktop span.a-price span.a-offscreen",
        "#corePrice_feature_div .reinventPricePriceToPayMargin span.a-offscreen",
        "span.priceToPay span.a-offscreen",
        "#price_inside_buybox",
        "#priceblock_ourprice",
        "#priceblock_dealprice",
        "#priceblock_saleprice",
        "span.a-price[data-a-size='xl'] span.a-offscreen",
        "span.a-price span.a-offscreen",
        "span[data-a-size='xl'] span.a-offscreen",
    ]

    try:
        WebDriverWait(driver, 12).until(
            EC.any_of(*[
                EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                for selector in selectors
            ])
        )
    except Exception:
        logger.debug("[AMAZON] Nenhum seletor principal apareceu a tempo; tentando fallbacks.")

    price = extract_first_price_from_elements(driver, selectors, "AMAZON")
    if price:
        return price

    try:
        whole = driver.find_element(By.CSS_SELECTOR, "span.a-price-whole").text
        frac = driver.find_element(By.CSS_SELECTOR, "span.a-price-fraction").text
        price = clean_price_text(f"{whole},{frac}")
        if price:
            logger.info(f"[AMAZON] Preço encontrado via whole/fraction: €{price}")
            return price
    except Exception as err:
        logger.debug(f"[AMAZON] Fallback whole/fraction falhou: {err}")

    try:
        page_source = driver.page_source

        regex_candidates = [
            r'"priceToPay"\s*:\s*\{.*?"priceAmount"\s*:\s*([\d.,]+)',
            r'"priceAmount"\s*:\s*([\d.,]+)',
            r'"displayPrice"\s*:\s*"([^"]+)"',
        ]

        for pattern in regex_candidates:
            for match in re.finditer(pattern, page_source, re.IGNORECASE | re.DOTALL):
                price = clean_price_text(match.group(1))
                if price:
                    logger.info(f"[AMAZON] Preço encontrado via regex '{pattern}': €{price}")
                    return price
    except Exception as err:
        logger.debug(f"[AMAZON] Fallback por regex falhou: {err}")

    return None

def is_amazon_unavailable(driver):
    selectors = [
        "#availability",
        "#outOfStock",
        "#buybox",
        "#centerCol",
    ]

    phrases = [
        "não disponível",
        "nao disponível",
        "nao disponivel",
        "currently unavailable",
        "temporarily out of stock",
        "we don't know when or if this item will be back in stock",
        "não temos previsão de quando este produto estará disponível novamente",
        "este produto estará disponível novamente",
    ]

    for selector in selectors:
        try:
            elements = driver.find_elements(By.CSS_SELECTOR, selector)
        except Exception:
            continue

        for el in elements:
            text = " ".join(filter(None, [
                el.text,
                el.get_attribute("textContent"),
                el.get_attribute("innerText"),
            ])).lower()
            if any(phrase in text for phrase in phrases):
                logger.info(f"[AMAZON] Produto marcado como indisponível via seletor '{selector}'")
                return True

    try:
        body = driver.find_element(By.TAG_NAME, "body").text.lower()
        if any(phrase in body for phrase in phrases):
            logger.info("[AMAZON] Produto marcado como indisponível via conteúdo da página")
            return True
    except Exception:
        pass

    return False

# ==================== LIGHTWEIGHT (requests + BS4) ====================

LIGHTWEIGHT_SUPPORTED = ("continente.pt", "worten", "fnac")
LIGHTWEIGHT_BLOCKED = ("amazon.", "leroymerlin", "leroy-merlin")
ANTIBOT_SITES = ("worten", "fnac")

def _fetch_plain(url, timeout=10):
    headers = {
        "User-Agent": SCRAPER_CONFIG["user_agent"],
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }
    try:
        r = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        if r.status_code == 200 and r.text:
            return r.text
        logger.debug(f"[LIGHT] requests HTTP {r.status_code} para {url}")
    except Exception as e:
        logger.debug(f"[LIGHT] requests falhou para {url}: {e}")
    return None

def _fetch_impersonated(url, timeout=20):
    if not HAS_CURL_CFFI:
        logger.debug("[LIGHT] curl_cffi indisponível; instale com `pip install curl_cffi`")
        return None
    try:
        r = curl_requests.get(url, impersonate="chrome120", timeout=timeout, allow_redirects=True)
        if r.status_code == 200 and r.text:
            return r.text
        logger.debug(f"[LIGHT] curl_cffi HTTP {r.status_code} para {url}")
    except Exception as e:
        logger.debug(f"[LIGHT] curl_cffi falhou para {url}: {e}")
    return None

def fetch_html(url, timeout=10):
    u = url.lower()
    if any(d in u for d in ANTIBOT_SITES):
        return _fetch_impersonated(url, timeout=max(timeout, 20))
    return _fetch_plain(url, timeout=timeout)

def extract_price_lightweight(url):
    """
    Tenta extrair preço sem abrir Chrome, apenas requests + BS4.
    Retorna (loja, preco) em sucesso, (loja, None) se site é suportado mas sem preço,
    ou None se a URL não é suportada em modo leve (cair no Selenium).
    """
    u = url.lower()

    if any(d in u for d in LIGHTWEIGHT_BLOCKED):
        return None
    if not any(d in u for d in LIGHTWEIGHT_SUPPORTED):
        return None

    html = fetch_html(url)
    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")

    if "worten" in u:
        meta = soup.find("meta", {"itemprop": "price"})
        if meta and meta.get("content"):
            price = clean_price_text(meta["content"])
            if price:
                return ("Worten", price)
        meta_og = soup.find("meta", {"property": "product:price:amount"})
        if meta_og and meta_og.get("content"):
            price = clean_price_text(meta_og["content"])
            if price:
                return ("Worten", price)
        el = soup.select_one("span.value")
        if el:
            content = el.get("content")
            if content:
                price = clean_price_text(content)
                if price:
                    return ("Worten", price)
        return ("Worten", None)

    if "fnac" in u:
        meta = soup.find("meta", {"property": "product:price:amount"})
        if meta and meta.get("content"):
            price = clean_price_text(meta["content"])
            if price:
                return ("FNAC", price)
        meta_itemprop = soup.find("meta", {"itemprop": "price"})
        if meta_itemprop and meta_itemprop.get("content"):
            price = clean_price_text(meta_itemprop["content"])
            if price:
                return ("FNAC", price)
        el = soup.select_one("span.f-faPriceBox__price, span.userPrice")
        if el:
            price = clean_price_text(el.get_text(" ", strip=True))
            if price:
                return ("FNAC", price)
        return ("FNAC", None)

    if "continente.pt" in u:
        el = soup.select_one("span.value")
        if el:
            content = el.get("content")
            if content:
                price = clean_price_text(content)
                if price:
                    return ("Continente", price)
            price = clean_price_text(el.get_text(" ", strip=True))
            if price:
                return ("Continente", price)
        el = soup.select_one("span.ct-price-formatted")
        if el:
            price = clean_price_text(el.get_text(" ", strip=True))
            if price:
                return ("Continente", price)
        return ("Continente", None)

    return None

# ==================== EXTRACT PRICE ====================

def extract_price(driver, url):
    light = extract_price_lightweight(url)
    if light is not None:
        loja, preco = light
        if preco:
            logger.info(f"[LIGHT] {loja} €{preco} (sem Chrome)")
            return loja, preco
        logger.info(f"[LIGHT] {loja} sem preço — caindo para Selenium")

    if driver is None:
        logger.error("[GET] Driver indisponível para fallback Selenium")
        return "Desconhecida", None

    logger.info(f"[GET] {url}")
    driver.get(url)
    sleep(3)

    logger.info(f"[DEBUG] URL atual: {driver.current_url}")

    aceitar_cookies(driver)
    fechar_modais(driver)  # Fechar modal de localização e outros popups
    sleep(2)

    current_url = driver.current_url or url
    u = current_url.lower()

    # AMAZON
    if is_amazon_url(u):
        try:
            price = extract_amazon_price(driver)
            if price:
                return "Amazon", price
            if is_amazon_unavailable(driver):
                return "Amazon", None
            return "Amazon", None
        except Exception as err:
            logger.debug(f"[AMAZON] Erro ao extrair preço: {err}")
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

# ==================== SINGLE PRODUCT ====================

def scrape_single_product(url, is_initial=False):
    """
    Faz scraping de um único produto por URL
    Útil para verificação inicial quando um produto é adicionado
    """
    driver = None
    try:
        logger.info(f"[SINGLE] Iniciando scraping para: {url}")

        loja, preco = (None, None)
        light = extract_price_lightweight(url)
        if light is not None and light[1]:
            loja, preco = light
            logger.info(f"[SINGLE] Preço obtido em modo leve (sem Chrome): €{preco} ({loja})")
        else:
            driver = create_driver()
            loja, preco = extract_price(driver, url)
        
        if preco:
            logger.info(f"[SINGLE] Preço encontrado: €{preco} ({loja})")
            
            # Buscar produto na base de dados pelo link
            conn = connect_db()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("""
                SELECT Id AS "Id", ReferenciaID AS "ReferenciaID", Nome AS "Nome",
                       PrecoAtual AS "PrecoAtual", PrecoAlvo AS "PrecoAlvo"
                FROM produtos
                WHERE Link = %s AND DeletedAt IS NULL
                LIMIT 1
            """, (url,))
            produto = cur.fetchone()
            
            if produto:
                produto_id = produto["Id"]
                preco_anterior = produto.get("PrecoAtual")

                apply_price_update(
                    {
                        "Id": produto_id,
                        "Nome": produto.get("Nome"),
                        "Link": url,
                        "Loja": loja,
                        "PrecoAtual": preco_anterior,
                    },
                    preco,
                    loja,
                )

                logger.info(f"[SINGLE] Produto {produto['Nome']} atualizado: €{preco_anterior} → €{preco}")
            else:
                logger.warning(f"[SINGLE] Produto não encontrado na base de dados para URL: {url}")
            
            cur.close()
            conn.close()
        else:
            logger.warning(f"[SINGLE] Não foi possível extrair preço de {url}")
            
    except Exception as e:
        logger.error(f"[SINGLE] Erro ao fazer scraping: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if driver:
            safe_quit(driver)

# ==================== MAIN ====================

def monitor_loop():
    cycle_interval = max(5, int(SCRAPER_CONFIG.get("cycle_interval", 60)))
    driver = None
    logger.info(f"PromoPing scraper iniciado (ciclo a cada {cycle_interval}s)")

    try:
        while True:
            started_at = datetime.now()

            try:
                produtos = fetch_products()
                logger.info(f"[CICLO] {len(produtos)} produto(s) ativo(s) carregado(s) da base")

                ciclo_agora = datetime.now()
                atualizados = 0
                aguardando = 0
                novos = 0
                light_hits = 0
                heavy_hits = 0

                for p in produtos:
                    if not should_update_product(p, ciclo_agora):
                        intervalo = p.get("VerificacaoIntervalo", 24)
                        logger.debug(f"[SKIP] {p['Nome']} aguarda proxima atualizacao (intervalo: {intervalo}h)")
                        aguardando += 1
                        continue

                    if p.get("UpdatedAt") is None:
                        novos += 1
                        logger.info(f"[NOVO] Monitorando novo produto: {p['Nome']}")

                    atualizados += 1
                    url = p["Link"]

                    light = extract_price_lightweight(url)
                    if light is not None and light[1]:
                        loja, preco = light
                        preco_anterior = p.get("PrecoAtual")
                        light_hits += 1
                        logger.info(f"[OK] {p['Nome']} ({loja}) €{preco} [leve]")
                        apply_price_update(p, preco, loja)
                        sleep(1)
                        continue

                    if driver is None:
                        try:
                            logger.info("[DRIVER] Iniciando Chrome (necessário para este produto)")
                            driver = create_driver()
                        except Exception as driver_err:
                            logger.error(f"Falha ao criar driver: {driver_err}")
                            traceback.print_exc()
                            break

                    try:
                        loja, preco = extract_price(driver, url)
                    except WebDriverException as wd_err:
                        logger.warning(f"Driver instável ao processar '{p['Nome']}': {wd_err}")
                        safe_quit(driver)
                        driver = None
                        break
                    except Exception as prod_err:
                        logger.error(f"Erro ao processar produto '{p['Nome']}': {prod_err}")
                        traceback.print_exc()
                        continue

                    heavy_hits += 1
                    if preco:
                        logger.info(f"[OK] {p['Nome']} ({loja}) €{preco}")
                        apply_price_update(p, preco, loja)
                    else:
                        logger.warning(f"[FAIL] {p['Nome']} sem preço ({loja})")

                    sleep(2)

                logger.info(
                    f"[CICLO] Resumo: {atualizados} atualizados ({light_hits} leves, {heavy_hits} via Chrome), "
                    f"{aguardando} aguardando, {novos} novos"
                )

            except Exception as cycle_err:
                logger.error(f"Erro durante ciclo de monitorização: {cycle_err}")
                traceback.print_exc()
                safe_quit(driver)
                driver = None

            elapsed = (datetime.now() - started_at).total_seconds()
            wait_seconds = max(1, cycle_interval - int(elapsed))
            logger.info(f"[CICLO] Finalizado em {int(elapsed)}s. Próxima execução em {wait_seconds}s")
            sleep(wait_seconds)

    except KeyboardInterrupt:
        logger.info("Interrompido manualmente pelo utilizador")
    except Exception as err:
        logger.error(err)
        traceback.print_exc()

    finally:
        safe_quit(driver)
        logger.info("Driver encerrado")

# ==================== ENTRY ====================

if __name__ == "__main__":
    monitor_loop()
