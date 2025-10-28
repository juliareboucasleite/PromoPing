/**
 *  Utilitários de formatação para preços e datas
 * Padroniza valores para consistência em todo o sistema
 */

/**
 *  Formata preço para número decimal
 * @param {string|number} rawPrice - Preço em qualquer formato
 * @returns {number|null} - Preço como número decimal ou null se inválido
 */
export function formatPrice(rawPrice) {
  if (!rawPrice) return null;

  try {
    // Se já é número, retorna
    if (typeof rawPrice === 'number') return rawPrice;

    let cleaned = String(rawPrice)
      .replace(/[^\d.,-]/g, "") // remove tudo que não for número, vírgula ou ponto
      .trim();

    // Se tem vírgula e ponto -> assume padrão europeu (1.199,99)
    if (cleaned.includes(",") && cleaned.includes(".")) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    }
    // Se só tem vírgula -> troca por ponto (ex: 199,90 -> 199.90)
    else if (cleaned.includes(",") && !cleaned.includes(".")) {
      cleaned = cleaned.replace(",", ".");
    }

    const result = parseFloat(cleaned);
    return isNaN(result) ? null : result;
    
  } catch (err) {
    console.error(" Erro ao formatar preço:", rawPrice, err);
    return null;
  }
}

/**
 *  Formata data para formato português (DD/MM/YYYY)
 * @param {string|Date} dateString - Data em qualquer formato
 * @returns {string|null} - Data formatada como DD/MM/YYYY ou null se inválida
 */
export function formatDate(dateString) {
  if (!dateString) return null;

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  } catch (err) {
    console.error(" Erro ao formatar data:", dateString, err);
    return null;
  }
}

/**
 *  Formata data e hora para formato português
 * @param {string|Date} date - Data em qualquer formato
 * @returns {string} - Data e hora formatada como DD/MM/YYYY HH:MM ou "—" se inválida
 */
export function formatDateTime(date) {
  if (!date) return "—";
  
  try {
    let dateObj;
    
    if (date instanceof Date) {
      dateObj = date;
    } else {
      const dateString = String(date);
      
      if (dateString.includes('T')) {
        dateObj = new Date(dateString);
      } else if (dateString.includes(' ') && dateString.includes(':')) {
        dateObj = new Date(dateString.replace(' ', 'T'));
      } else {
        dateObj = new Date(dateString);
      }
    }
    
    if (isNaN(dateObj.getTime())) {
      return "—";
    }
    
    return dateObj.toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
  } catch (error) {
    console.error(' Erro ao formatar data e hora:', date, error);
    return "—";
  }
}

/**
 *  Formata preço para exibição
 * @param {number} price - Preço como número
 * @returns {string} - Preço formatado como "€X,XX"
 */
export function formatPriceDisplay(price) {
  if (!price || isNaN(price)) return "—";
  
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  }).format(price);
}

/**
 *  Formata percentual
 * @param {number} value - Valor decimal (0.15 = 15%)
 * @returns {string} - Percentual formatado como "15%"
 */
export function formatPercentage(value) {
  if (!value || isNaN(value)) return "—";
  
  return new Intl.NumberFormat('pt-PT', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 *  Valida se uma string é uma URL válida
 * @param {string} url - URL para validar
 * @returns {boolean} - True se URL é válida
 */
export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 *  Limpa e normaliza texto
 * @param {string} text - Texto para limpar
 * @returns {string} - Texto limpo e normalizado
 */
export function cleanText(text) {
  if (!text) return "";
  
  return String(text)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\r\n\t]/g, ' ');
}

/**
 *  Formata dados do produto para consistência
 * @param {Object} product - Dados do produto
 * @returns {Object} - Produto formatado
 */
export function formatProduct(product) {
  if (!product) return null;
  
  return {
    ...product,
    nome: cleanText(product.nome),
    preco: formatPrice(product.preco),
    preco_atual: formatPrice(product.preco_atual),
    preco_anterior: formatPrice(product.preco_anterior),
    preco_alvo: formatPrice(product.preco_alvo),
    criado_em: formatDateTime(product.criado_em),
    data_limite: formatDate(product.data_limite)
  };
}
