/**
 * Generación de hash SHA-256 para el módulo de firma digital.
 */

const crypto = require('crypto');

/**
 * Calcula el hash SHA-256 de un contenido.
 * @param {string|Buffer} contenido - dato a hashear (xml de la factura o otro documento)
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
