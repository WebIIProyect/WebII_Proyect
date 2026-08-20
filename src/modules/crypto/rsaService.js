/**
 * rsaService.js
 * Generación de pares de llaves RSA (2048 bits) para el módulo de firma digital.
 *
 * Usa el módulo nativo `crypto` de Node.js — no requiere librerías externas
 * (ver CLAUDE.md, punto 4 de la estructura del repo).
 *
 * Formato de salida (PEM):
 *   - Llave pública:  SPKI  — estándar para incluir en certificados X.509.
 *   - Llave privada:  PKCS#8 — estándar, compatible con las funciones nativas
 *     de firma/cifrado de `crypto` que se usarán en los puntos 2 y 3.
 *
 * Importante: esta función SOLO genera el par de llaves en memoria. No las
 * persiste ni las cifra — eso corresponde al HSM simulado / bóveda de llaves
 * (punto 2 del checklist, `Boveda_Llaves_Privadas`).
 */

const crypto = require('crypto');

const RSA_KEY_LENGTH_BITS = 2048;

/**
 * @returns {{ publicKey: string, privateKey: string }} par de llaves en
 *   formato PEM (publicKey = SPKI, privateKey = PKCS#8, ambas en claro).
 */

function generarParLlavesRSA() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: RSA_KEY_LENGTH_BITS,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return { publicKey, privateKey };
}

module.exports = {
  RSA_KEY_LENGTH_BITS,
  generarParLlavesRSA,
};
