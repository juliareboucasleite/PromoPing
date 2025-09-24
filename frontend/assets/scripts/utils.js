export async function identificarProduto(link) {
    try {
        const response = await fetch(`/api/scrape?url=${encodeURIComponent(link)}`);
        const data = await response.json();
        return data?.nome || "Produto inserido";
    } catch (error) {
        console.error("Erro ao buscar produto:", error);
        return "Produto inserido";
    }
}

export async function detectarLoja(link) {
    try {
        const res = await fetch(`/api/scrape?url=${encodeURIComponent(link)}`);
        const data = await res.json();
        return data?.loja || null;
    } catch {
        return null;
    }
}