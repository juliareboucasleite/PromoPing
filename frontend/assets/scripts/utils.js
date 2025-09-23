export async function identificarProduto(link) {
    try {
        const response = await fetch(`http://localhost:3000/scrape?url=${encodeURIComponent(link)}`);
        const data = await response.json();
        return data.nome || "Produto inserido";
    } catch (error) {
        console.error("Erro ao buscar produto:", error);
        return "Produto inserido";
    }
}