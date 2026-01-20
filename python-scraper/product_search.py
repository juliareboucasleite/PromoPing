"""
Módulo para pesquisa de produtos em lojas europeias.
Reutiliza Selenium e funções existentes do scraper.
"""
import logging
from time import sleep
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from urllib.parse import quote_plus

from scraper import create_driver, safe_quit, aceitar_cookies, clean_price_text
import re

logger = logging.getLogger(__name__)

# Configurações de pesquisa por loja
STORE_SEARCH_CONFIGS = {
    "amazon_es": {
        "base_url": "https://www.amazon.es/s?k=",
        "result_selector": "[data-component-type='s-search-result']",
        "title_selector": "h2 a span",
        "price_selector": ".a-price-whole, .a-price .a-offscreen",
        "link_selector": "h2 a",
        "max_results": 5
    },
    "fnac": {
        "base_url": "https://www.fnac.pt/Pesquisa?sl=en&s=",
        "result_selector": ".Article-item",
        "title_selector": ".Article-title a",
        "price_selector": ".f-priceBox-price, .price",
        "link_selector": ".Article-title a",
        "max_results": 5
    },
    "worten": {
        "base_url": "https://www.worten.pt/search?query=",
        "result_selector": "[data-testid='product-card'], .product-card",
        "title_selector": "h3, .product-title, [data-testid='product-title']",
        "price_selector": ".price, .value, [class*='price']",
        "link_selector": "a[href*='/produto']",
        "max_results": 5
    },
    "mediamarkt": {
        "base_url": "https://www.mediamarkt.pt/pt/search.html?query=",
        "result_selector": ".product-wrapper, .product-item",
        "title_selector": ".product-title, h2",
        "price_selector": ".price, .current-price",
        "link_selector": "a[href*='/produto']",
        "max_results": 5
    }
}


def search_store(driver, store_name, query):
    """
    Pesquisa produto em uma loja específica.
    
    Args:
        driver: Selenium WebDriver
        store_name: Nome da loja (amazon_es, fnac, worten, mediamarkt)
        query: Query de pesquisa
    
    Returns:
        Lista de dicts com resultados: [{title, price, url, store}, ...]
    """
    if store_name not in STORE_SEARCH_CONFIGS:
        logger.warning(f"Loja não suportada: {store_name}")
        return []
    
    config = STORE_SEARCH_CONFIGS[store_name]
    results = []
    
    try:
        # Construir URL de pesquisa
        encoded_query = quote_plus(query)
        search_url = config["base_url"] + encoded_query
        
        logger.info(f"Pesquisando em {store_name}: {query}")
        driver.get(search_url)
        aceitar_cookies(driver)
        sleep(3)  # Aguardar carregamento
        
        # Encontrar elementos de resultado
        try:
            result_elements = driver.find_elements(By.CSS_SELECTOR, config["result_selector"])
            logger.info(f"Encontrados {len(result_elements)} resultados em {store_name}")
        except Exception as e:
            logger.error(f"Erro ao encontrar resultados em {store_name}: {e}")
            return []
        
        # Processar cada resultado (limitado a max_results)
        for i, element in enumerate(result_elements[:config["max_results"]]):
            try:
                # Extrair título
                title = ""
                try:
                    title_elem = element.find_element(By.CSS_SELECTOR, config["title_selector"])
                    title = title_elem.text.strip()
                except:
                    # Fallback: tentar encontrar qualquer texto de título
                    try:
                        title = element.find_element(By.TAG_NAME, "h2").text.strip()
                    except:
                        try:
                            title = element.find_element(By.TAG_NAME, "h3").text.strip()
                        except:
                            pass
                
                if not title:
                    continue
                
                # Extrair URL
                url = ""
                try:
                    link_elem = element.find_element(By.CSS_SELECTOR, config["link_selector"])
                    url = link_elem.get_attribute("href")
                    # Garantir URL absoluta
                    if url and not url.startswith("http"):
                        base_domain = config["base_url"].split("/")[2]
                        url = f"https://{base_domain}{url}"
                except:
                    # Fallback: procurar qualquer link no elemento
                    try:
                        link_elem = element.find_element(By.TAG_NAME, "a")
                        url = link_elem.get_attribute("href")
                    except:
                        pass
                
                if not url:
                    continue
                
                # Extrair preço
                price = None
                try:
                    price_elem = element.find_element(By.CSS_SELECTOR, config["price_selector"])
                    price_text = price_elem.text.strip()
                    price = clean_price_text(price_text)
                except:
                    # Fallback: buscar preço no texto do elemento
                    try:
                        element_text = element.text
                        price_match = re.search(r'(\d+[,\.]\d{2})\s*€', element_text)
                        if price_match:
                            price = clean_price_text(price_match.group(1))
                    except:
                        pass
                
                if title and url:
                    results.append({
                        "title": title,
                        "price": price,
                        "url": url,
                        "store": store_name.replace("_", " ").title()
                    })
                    
            except Exception as e:
                logger.warning(f"Erro ao processar resultado {i} em {store_name}: {e}")
                continue
        
        logger.info(f"Extraídos {len(results)} resultados válidos de {store_name}")
        return results
        
    except Exception as e:
        logger.error(f"Erro ao pesquisar em {store_name}: {e}")
        return []


def search_all_stores(driver, query):
    """
    Pesquisa produto em todas as lojas suportadas.
    
    Args:
        driver: Selenium WebDriver
        query: Query de pesquisa
    
    Returns:
        Lista de dicts com todos os resultados de todas as lojas
    """
    all_results = []
    
    for store_name in STORE_SEARCH_CONFIGS.keys():
        try:
            results = search_store(driver, store_name, query)
            all_results.extend(results)
            sleep(2)  # Pausa entre lojas
        except Exception as e:
            logger.error(f"Erro ao pesquisar em {store_name}: {e}")
            continue
    
    return all_results

