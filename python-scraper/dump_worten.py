import re
import time
import sys

sys.path.insert(0, "/root/PromoPing/python-scraper")

from scraper import create_driver, aceitar_cookies, fechar_modais, safe_quit

URL = "https://www.worten.pt/produtos/portatil-gaming-lenovo-loq-15irx10-intel-core-i7-13650hx-nvidia-geforce-rtx-5060-ram-32-gb-1-tb-ssd-15-6-8629579"

driver = None
try:
    driver = create_driver()
    driver.get(URL)
    time.sleep(5)
    try:
        aceitar_cookies(driver)
        fechar_modais(driver)
    except Exception as e:
        print("cookie/modal err:", e)
    time.sleep(3)

    print("FINAL URL:", driver.current_url)
    print("TITLE:", driver.title)
    html = driver.page_source
    print("page_source len:", len(html))

    low = html.lower()
    print("has 'datadome':", "datadome" in low)
    print("has 'captcha':", "captcha" in low)
    print("has 'access denied':", "access denied" in low or "acesso negado" in low)

    patterns = [
        (r'<meta[^>]*itemprop=["\']price["\'][^>]*>', "meta itemprop=price"),
        (r'<meta[^>]*product:price:amount[^>]*>', "meta product:price:amount"),
        (r'"price"\s*:\s*"?[0-9.,]+', 'json "price"'),
        (r'"priceValue"\s*:\s*"?[0-9.,]+', 'json priceValue'),
        (r'"currentPrice"\s*:\s*"?[0-9.,]+', 'json currentPrice'),
        (r'"lowPrice"\s*:\s*"?[0-9.,]+', 'json lowPrice'),
        (r'class=["\'][^"\']*price[^"\']*["\']', "class*=price"),
        (r'data-[a-z-]*price[a-z-]*=["\'][^"\']+["\']', "data-*price*"),
        (r'<span[^>]*class=["\'][^"\']*value[^"\']*["\'][^>]*>[^<]*', "span value text"),
        (r'<sup[^>]*class=["\'][^"\']*decimal[^"\']*["\'][^>]*>[^<]*', "sup decimal text"),
        (r'\d{2,4}[,\.]\d{2}\s*\u20ac', "number+euro"),
        (r'\u20ac\s*\d{2,4}[,\.]\d{2}', "euro+number"),
    ]
    for pat, label in patterns:
        found = re.findall(pat, html, flags=re.IGNORECASE)
        if found:
            uniq = []
            for f in found:
                s = re.sub(r"\s+", " ", f)[:140]
                if s not in uniq:
                    uniq.append(s)
            print("--", label)
            for s in uniq[:5]:
                print("    ", s)

    with open("/tmp/worten_dump.html", "w", encoding="utf-8") as fh:
        fh.write(html)
    print("saved /tmp/worten_dump.html")
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    if driver:
        safe_quit(driver)
