import re
import time
import sys

sys.path.insert(0, "/root/PromoPing/python-scraper")

import undetected_chromedriver as uc
from scraper import (
    get_browser_executable_path,
    get_chromedriver_path,
    get_chrome_major_version,
    aceitar_cookies,
    fechar_modais,
    safe_quit,
    SCRAPER_CONFIG,
)

URL = "https://www.worten.pt/produtos/portatil-gaming-lenovo-loq-15irx10-intel-core-i7-13650hx-nvidia-geforce-rtx-5060-ram-32-gb-1-tb-ssd-15-6-8629579"


def build_headful_options():
    options = uc.ChromeOptions()
    be = get_browser_executable_path()
    if be:
        options.binary_location = be
    # NOTE: no --headless here (headful under xvfb)
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-popup-blocking")
    options.add_argument("--disable-notifications")
    options.add_argument("--lang=pt-PT")
    options.add_argument("--window-size=1920,1080")
    options.add_argument(f"--user-agent={SCRAPER_CONFIG['user_agent']}")
    return options


driver = None
try:
    vm = get_chrome_major_version()
    kwargs = {"options": build_headful_options(), "use_subprocess": True, "headless": False}
    be = get_browser_executable_path()
    de = get_chromedriver_path()
    if be:
        kwargs["browser_executable_path"] = be
    if de:
        kwargs["driver_executable_path"] = de
    driver = uc.Chrome(version_main=vm, **kwargs) if vm else uc.Chrome(**kwargs)
    driver.delete_all_cookies()

    driver.get(URL)
    # Wait for Cloudflare "Just a moment..." to clear
    cleared = False
    for i in range(20):
        time.sleep(1.5)
        title = (driver.title or "").lower()
        if "just a moment" not in title and "um momento" not in title:
            cleared = True
            print(f"[CF] challenge cleared after ~{(i+1)*1.5:.0f}s, title='{driver.title}'")
            break
    if not cleared:
        print("[CF] STILL on challenge, title=", driver.title)

    try:
        aceitar_cookies(driver)
        fechar_modais(driver)
    except Exception as e:
        print("cookie/modal err:", e)
    time.sleep(2)

    html = driver.page_source
    print("FINAL URL:", driver.current_url)
    print("TITLE:", driver.title)
    print("len:", len(html))

    patterns = [
        (r'<meta[^>]*itemprop=["\']price["\'][^>]*>', "meta itemprop=price"),
        (r'"price"\s*:\s*"?[0-9.,]+', 'json "price"'),
        (r'class=["\'][^"\']*price[^"\']*["\']', "class*=price"),
        (r'<span[^>]*class=["\'][^"\']*value[^"\']*["\'][^>]*>[^<]*', "span value"),
        (r'<sup[^>]*class=["\'][^"\']*decimal[^"\']*["\'][^>]*>[^<]*', "sup decimal"),
        (r'\d{2,4}[,\.]\d{2}\s*\u20ac', "number+euro"),
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
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    if driver:
        safe_quit(driver)
