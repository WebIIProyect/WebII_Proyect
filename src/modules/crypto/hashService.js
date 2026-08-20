/**
 * hashService.js
 * Generación de hash SHA-256 para el módulo de firma digital.
 *
 * Usa el módulo nativo `crypto` de Node.js — no requiere librerías externas
 * (ver CLAUDE.md, punto 4 de la estructura del repo).
 *
 * Este hash se usará más adelante para:
 *   - Calcular la huella del XML de factura dentro del proceso de firma
 *     XMLDSig (punto 3 del checklist).
 *   - Guardar el hash del documento firmado en `Transacciones_Firma`
 *     (punto 5 del checklist), como evidencia de integridad.
 */

const crypto = require('crypto');

/**
 * Calcula el hash SHA-256 de un contenido.
 *
 * @param {string|Buffer} contenido - dato a hashear (ej. el XML de la factura).
 * @param {'hex'|'base64'} [encoding='hex'] - formato de salida del hash.
 * @returns {string} hash SHA-256 en el formato solicitado.
 */
function calcularHashSHA256(contenido, encoding = 'hex') {
  if (contenido === undefined || contenido === null) {
    throw new Error('calcularHashSHA256: el contenido a hashear no puede ser undefined o null');
  }

  return crypto.createHash('sha256').update(contenido).digest(encoding);
}

module.exports = {
  calcularHashSHA256,
};
