import re
import sys
from curl_cffi import requests as curl_requests

URLS = [
    "https://www.worten.pt/produtos/maquina-de-costura-kunft-ksm5259-20-pontos-7583917",
    "https://www.worten.pt/produtos/portatil-gaming-lenovo-loq-15irx10-intel-core-i7-13650hx-nvidia-geforce-rtx-5060-ram-32-gb-1-tb-ssd-15-6-8629579",
]

PATTERNS = [
    (r'<meta[^>]*itemprop=["\']price["\'][^>]*>', "meta itemprop=price"),
    (r'<meta[^>]*property=["\']product:price:amount["\'][^>]*>', "meta product:price:amount"),
    (r'"price"\s*:\s*"?[0-9.,]+', 'json "price"'),
    (r'"priceValue"\s*:\s*"?[0-9.,]+', 'json priceValue'),
    (r'"currentPrice"\s*:\s*"?[0-9.,]+', 'json currentPrice'),
    (r'"sellingPrice"\s*:\s*"?[0-9.,]+', 'json sellingPrice'),
    (r'class=["\'][^"\']*price[^"\']*["\']', "class*=price"),
    (r'data-[a-z-]*price[a-z-]*=["\'][^"\']+["\']', "data-*price*"),
    (r'<span[^>]*class=["\'][^"\']*value[^"\']*["\'][^>]*>', "span class*=value"),
    (r'<sup[^>]*class=["\'][^"\']*decimal[^"\']*["\'][^>]*>', "sup class*=decimal"),
]

for url in URLS:
    print("\n=== " + url[:90])
    try:
        r = curl_requests.get(url, impersonate="chrome120", timeout=25, allow_redirects=True)
        print("HTTP", r.status_code, "len", len(r.text))
        html = r.text
        for pat, label in PATTERNS:
            found = re.findall(pat, html, flags=re.IGNORECASE)
            if found:
                uniq = []
                for f in found:
                    s = re.sub(r"\s+", " ", f)[:160]
                    if s not in uniq:
                        uniq.append(s)
                print("--", label)
                for s in uniq[:4]:
                    print("    ", s)
    except Exception as e:
        print("ERRO:", e)
