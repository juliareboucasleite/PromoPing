import puppeteer from "puppeteer";

export async function scrapeProduct(url) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Pega o título da página
    const title = await page.title();

    // Exemplo de pegar preço (teríamos que adaptar para cada site)
    let preco = await page.evaluate(() => {
        const el = document.querySelector(".price, .sales-price, .product-price");
        return el ? el.innerText : "Preço não encontrado";
    });

    await browser.close();
    return { nome: title, preco };
}