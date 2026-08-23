
const crypto = require('crypto');
const { SignedXml } = require('xml-crypto');
const { DOMParser } = require('@xmldom/xmldom');

const ALGORITMO_FIRMA = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const ALGORITMO_DIGEST = 'http://www.w3.org/2001/04/xmlenc#sha256';
const ALGORITMO_CANONICALIZACION = 'http://www.w3.org/2001/10/xml-exc-c14n#';

/**
 * Construye el contenido de <KeyInfo> con la llave pública en formato
 * <KeyValue><RSAKeyValue><Modulus>/<Exponent>, el formato estándar de
 * XMLDSig para embeber una llave pública RSA "suelta" (sin certificado).
 *
 * @param {string|Buffer} llavePublicaOprivada - PEM de la llave pública, o
 *   de la llave privada (Node deriva la pública automáticamente).
 * @returns {string} el XML de `<KeyValue>...</KeyValue>`.
 */
function construirKeyInfoRSA(llavePublicaOprivada) {
  const llaveObjeto = crypto.createPublicKey(llavePublicaOprivada);
  const jwk = llaveObjeto.export({ format: 'jwk' }); // { kty:'RSA', n, e } en base64url

  const modulus = Buffer.from(jwk.n, 'base64url').toString('base64');
  const exponent = Buffer.from(jwk.e, 'base64url').toString('base64');

  return `<KeyValue><RSAKeyValue><Modulus>${modulus}</Modulus><Exponent>${exponent}</Exponent></RSAKeyValue></KeyValue>`;
}

/**
 * Verifica que un XML esté bien formado antes de firmarlo detectando
 *  XML vacío, etiquetas/atributos sin cerrar y etiquetas
 *
 * @param {string} xmlFactura
 * @throws {Error} si el XML no está bien formado.
 */
function validarXMLBienFormado(xmlFactura) {
  const mensajes = [];

  new DOMParser({
    onError: (nivel, mensaje) => {
      mensajes.push(`${nivel}: ${mensaje}`);
    },
  }).parseFromString(xmlFactura, 'text/xml');

  if (mensajes.length > 0) {
    throw new Error(`firmarXML: el XML no está bien formado, no se firma. Detalle: ${mensajes.join(' | ')}`);
  }
}

/**
 * Firma un XML de factura electrónica con XMLDSig.
 *
 * @param {string} xmlFactura - el XML de la factura, sin firmar 
 * @param {string|Buffer} llavePrivada -llave privada RSA en formato PEM, ya descifrada en memoria 
 * @returns {string} el mismo XML, con el nodo <Signature> insertado.
 * @throws {Error} si falta el XML o la llave, o si el XML no está bien formado.
 */
function firmarXML(xmlFactura, llavePrivada) {
  if (!xmlFactura || typeof xmlFactura !== 'string') {
    throw new Error('firmarXML: xmlFactura debe ser un string con el XML a firmar.');
  }
  if (!llavePrivada) {
    throw new Error('firmarXML: se requiere la llave privada para firmar.');
  }

  validarXMLBienFormado(xmlFactura);

  const sig = new SignedXml({
    privateKey: llavePrivada,
    signatureAlgorithm: ALGORITMO_FIRMA,
    canonicalizationAlgorithm: ALGORITMO_CANONICALIZACION,
    getKeyInfoContent: () => construirKeyInfoRSA(llavePrivada),
  });

  // "/*" = el elemento raíz del documento independientemente del nombre que tenga
  sig.addReference({
    xpath: '/*',
    digestAlgorithm: ALGORITMO_DIGEST,
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', ALGORITMO_CANONICALIZACION],
  });

  sig.computeSignature(xmlFactura);

  return sig.getSignedXml();
}

module.exports = {
  firmarXML,
  validarXMLBienFormado,
  construirKeyInfoRSA,
};
