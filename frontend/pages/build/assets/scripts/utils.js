// utils.js

/**
 * Escapa HTML para evitar XSS ao inserir texto em innerHTML / atributos.
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  if (text == null || typeof text !== "string") return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Escapa uma string para uso em atributo HTML (ex.: onclick="window.open('...')").
 * @param {string} text
 * @returns {string}
 */
export function escapeHtmlAttr(text) {
  if (text == null || typeof text !== "string") return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Formata uma data vinda do MySQL (YYYY-MM-DD HH:mm:ss)
 * para o formato local (DD/MM/YYYY).
 */
export function formatDateTime(dateString) {
  if (!dateString) return "—";
  
  try {
    // Corrige formato MySQL -> JS
    const fixed = dateString.replace(" ", "T");
    const d = new Date(fixed);

    if (isNaN(d.getTime())) return "—";

    return d.toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch (e) {
    console.error("Erro ao formatar data:", dateString, e);
    return "—";
  }
}