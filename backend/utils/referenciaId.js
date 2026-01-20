/**
 * Gera um ReferenciaID único no formato REF-XXXXXXXXX
 * @returns {string} ReferenciaID no formato REF-XXXXXXXXX
 */
export function gerarReferenciaID() {
    // Gerar 9 dígitos aleatórios
    const randomDigits = Math.floor(100000000 + Math.random() * 900000000);
    return `REF-${randomDigits}`;
}

/**
 * Valida se um ReferenciaID está no formato correto
 * @param {string} referenciaID - ReferenciaID a validar
 * @returns {boolean} true se válido, false caso contrário
 */
export function validarReferenciaID(referenciaID) {
    if (!referenciaID || typeof referenciaID !== 'string') {
        return false;
    }
    // Formato: REF-XXXXXXXXX (REF- seguido de 9 dígitos)
    const regex = /^REF-\d{9}$/;
    return regex.test(referenciaID);
}
