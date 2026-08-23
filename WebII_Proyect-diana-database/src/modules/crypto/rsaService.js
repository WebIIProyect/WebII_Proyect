
 //Generación de pares de llaves RSA (2048 bits) para el módulo de firma digital.
 

const crypto = require('crypto');

const RSA_KEY_LENGTH_BITS = 2048;

/**
 * @returns {{ publicKey: string, privateKey: string }} par de llaves en
 *   formato PEM
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
