/**
 * Valida se um preço (e uma mudança de preço) parece realista.
 * Bloqueia erros comuns de scraping (ex.: 769€ -> 11€).
 */
export function isPlausiblePrice(currentPrice, previousPrice = null) {
  const current = Number(currentPrice);
  if (!Number.isFinite(current) || current <= 0) {
    return false;
  }

  // Preços absurdamente baixos para produtos monitorizados em lojas PT
  if (current < 0.5) {
    return false;
  }

  if (previousPrice == null || previousPrice === undefined) {
    return current <= 50000;
  }

  const previous = Number(previousPrice);
  if (!Number.isFinite(previous) || previous <= 0) {
    return current <= 50000;
  }

  if (current === previous) {
    return true;
  }

  const dropRatio = (previous - current) / previous;
  const increaseRatio = (current - previous) / previous;

  // Queda ou subida extrema num único ciclo — quase sempre HTML errado
  if (dropRatio > 0.85) {
    return false;
  }
  if (increaseRatio > 2.5) {
    return false;
  }

  // Ex.: smartphone ~700€ que passa a 11€
  if (previous >= 50 && current < previous * 0.2) {
    return false;
  }
  if (previous >= 100 && current < 10) {
    return false;
  }

  return current <= 50000;
}

export function describePriceRejection(currentPrice, previousPrice = null) {
  const current = Number(currentPrice);
  const previous = previousPrice == null ? null : Number(previousPrice);

  if (!Number.isFinite(current) || current <= 0) {
    return "preço inválido ou zero";
  }
  if (current < 0.5) {
    return `preço demasiado baixo (${current})`;
  }
  if (previous != null && Number.isFinite(previous) && previous > 0) {
    const dropRatio = ((previous - current) / previous) * 100;
    if (dropRatio > 85) {
      return `queda de ${dropRatio.toFixed(1)}% (${previous} -> ${current})`;
    }
    if (previous >= 100 && current < 10) {
      return `preço atual (${current}) incompatível com anterior (${previous})`;
    }
  }
  return "mudança de preço suspeita";
}
