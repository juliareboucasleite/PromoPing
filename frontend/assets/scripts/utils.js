// utils.js

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