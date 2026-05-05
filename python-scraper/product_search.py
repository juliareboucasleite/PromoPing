"""
Modulo para pesquisa de produtos em lojas europeias.
Reutiliza Selenium e funcoes existentes do scraper.
"""
import logging
import re
from time import sleep
from urllib.parse import quote_plus

from selenium.webdriver.common.by import By

from scraper import aceitar_cookies, clean_price_text

logger = logging.getLogger(__name__)

# Configuracoes de pesquisa por loja
STORE_SEARCH_CONFIGS = {
    "amazon_es": {
        "base_url": "https://www.amazon.es/s?k=",
        "result_selector": "[data-component-type='s-search-result']",
        "title_selector": "h2 a span",
        "price_selector": ".a-price .a-offscreen, .a-price-whole",
        "link_selector": "h2 a",
        "max_results": 5,
        "display_name": "Amazon ES",
    },
    "fnac": {
        "base_url": "https://www.fnac.pt/Pesquisa?sl=en&s=",
        "result_selector": ".Article-item",
        "title_selector": ".Article-title a",
        "price_selector": ".f-priceBox-price, .price",
        "link_selector": ".Article-title a",
        "max_results": 5,
        "display_name": "FNAC",
    },
    "worten": {
        "base_url": "https://www.worten.pt/search?query=",
        "result_selector": "[data-testid='product-card'], .product-card",
        "title_selector": "h3, .product-title, [data-testid='product-title']",
        "price_selector": ".price, .value, [class*='price']",
        "link_selector": "a[href*='/produto']",
        "max_results": 5,
        "display_name": "Worten",
    },
    "mediamarkt": {
        "base_url": "https://www.mediamarkt.pt/pt/search.html?query=",
        "result_selector": ".product-wrapper, .product-item",
        "title_selector": ".product-title, h2",
        "price_selector": ".price, .current-price",
        "link_selector": "a[href*='/produto']",
        "max_results": 5,
        "display_name": "MediaMarkt",
    },
}


def extract_result_price(element, config, store_name):
    """Extrai preco do card com fallback para layouts diferentes."""
    selector = config.get("price_selector")
    if selector:
        try:
            for price_elem in element.find_elements(By.CSS_SELECTOR, selector):
                price_text = (price_elem.text or "").strip()
                price = clean_price_text(price_text)
                if price:
                    return price
        except Exception:
            pass

    if store_name == "amazon_es":
        try:
            whole = (element.find_element(By.CSS_SELECTOR, ".a-price-whole").text or "").strip()
            frac = (element.find_element(By.CSS_SELECTOR, ".a-price-fraction").text or "").strip()
            if whole and frac:
                price = clean_price_text(f"{whole},{frac}")
                if price:
                    return price
        except Exception:
            pass

    try:
        element_text = element.text or ""
        patterns = (
            r"(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*(?:€|EUR)",
            r"(?:€|EUR)\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})",
            r"(\d+[.,]\d{2})",
        )
        for pattern in patterns:
            price_match = re.search(pattern, element_text, re.IGNORECASE)
            if not price_match:
                continue
            price = clean_price_text(price_match.group(1))
            if price:
                return price
    except Exception:
        pass

    return None


def extract_result_title(element, config):
    try:
        title_elem = element.find_element(By.CSS_SELECTOR, config["title_selector"])
        title = (title_elem.text or "").strip()
        if title:
            return title
    except Exception:
        pass

    for tag_name in ("h2", "h3"):
        try:
            title = (element.find_element(By.TAG_NAME, tag_name).text or "").strip()
            if title:
                return title
        except Exception:
            continue

    return ""


def extract_result_url(element, config):
    try:
        link_elem = element.find_element(By.CSS_SELECTOR, config["link_selector"])
        url = link_elem.get_attribute("href")
        if url and not url.startswith("http"):
            base_domain = config["base_url"].split("/")[2]
            url = f"https://{base_domain}{url}"
        if url:
            return url
    except Exception:
        pass

    try:
        link_elem = element.find_element(By.TAG_NAME, "a")
        return link_elem.get_attribute("href")
    except Exception:
        return ""


def search_store(driver, store_name, query):
    """
    Pesquisa produto em uma loja especifica.

    Returns:
        Lista de dicts com resultados: [{title, price, url, store}, ...]
    """
    if store_name not in STORE_SEARCH_CONFIGS:
        logger.warning(f"Loja nao suportada: {store_name}")
        return []

    config = STORE_SEARCH_CONFIGS[store_name]
    results = []

    try:
        search_url = config["base_url"] + quote_plus(query)
        logger.info(f"Pesquisando em {store_name}: {query}")
        driver.get(search_url)
        aceitar_cookies(driver)
        sleep(3)

        try:
            result_elements = driver.find_elements(By.CSS_SELECTOR, config["result_selector"])
            logger.info(f"Encontrados {len(result_elements)} resultados em {store_name}")
        except Exception as error:
            logger.error(f"Erro ao encontrar resultados em {store_name}: {error}")
            return []

        for index, element in enumerate(result_elements[: config["max_results"]]):
            try:
                title = extract_result_title(element, config)
                if not title:
                    continue

                url = extract_result_url(element, config)
                if not url:
                    continue

                price = extract_result_price(element, config, store_name)

                results.append({
                    "title": title,
                    "price": price,
                    "url": url,
                    "store": config.get("display_name") or store_name.replace("_", " ").title(),
                })
            except Exception as error:
                logger.warning(f"Erro ao processar resultado {index} em {store_name}: {error}")
                continue

        logger.info(f"Extraidos {len(results)} resultados validos de {store_name}")
        return results

    except Exception as error:
        logger.error(f"Erro ao pesquisar em {store_name}: {error}")
        return []


def search_all_stores(driver, query):
    """Pesquisa produto em todas as lojas suportadas."""
    all_results = []

    for store_name in STORE_SEARCH_CONFIGS.keys():
        try:
            results = search_store(driver, store_name, query)
            all_results.extend(results)
            sleep(2)
        except Exception as error:
            logger.error(f"Erro ao pesquisar em {store_name}: {error}")
            continue

    return all_results

