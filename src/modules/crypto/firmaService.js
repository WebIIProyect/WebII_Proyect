/**
 * firmaService.js
 * Servicio de firma digital: aplica XMLDSig sobre el XML de una factura
 * electrónica (punto 3 del checklist).
 *
 * Alcance de este archivo — a propósito, hace SOLO una cosa:
 *   - NO verifica el PIN (eso es el punto 6, `pinService`).
 *   - NO carga ni descifra la llave privada (eso ya lo hace
 *     `hsmService.cargarLlaveTemporalmente`, punto 2 — este servicio recibe
 *     la llave ya en claro, en memoria, lista para usar).
 *   - NO registra la operación en `Transacciones_Firma` (eso es el punto 5).
 * Cada responsabilidad del Flujo B vive en su propio servicio para poder
 * probarla y explicarla por separado.
 *
 * Estándar usado: XMLDSig (XML Digital Signature), firma de tipo
 * "enveloped" — el nodo <Signature> queda insertado dentro del propio XML
 * de la factura, junto al resto del documento. Algoritmos: RSA-SHA256 para
 * la firma y SHA-256 para el digest, consistentes con las decisiones ya
 * tomadas en CLAUDE.md.
 *
 * Nota de robustez (encontrada probando este archivo): el parser XML que
 * usa `xml-crypto` por debajo (`@xmldom/xmldom`) es muy permisivo — ante un
 * XML mal formado, en vez de fallar intenta "repararlo" en silencio y sigue
 * adelante. Para una factura electrónica eso es peligroso: firmaríamos una
 * versión distinta del documento a la que en realidad se recibió, sin que
 * nadie se entere. Por eso `firmarXML` valida primero que el XML esté bien
 * formado y rechaza cualquier caso donde el parser reporte un problema
 * (`validarXMLBienFormado`), en vez de confiar en que `computeSignature`
 * lo vaya a detectar por su cuenta (no siempre lo hace).
 */

const { SignedXml } = require('xml-crypto');
const { DOMParser } = require('@xmldom/xmldom');

const ALGORITMO_FIRMA = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const ALGORITMO_DIGEST = 'http://www.w3.org/2001/04/xmlenc#sha256';
const ALGORITMO_CANONICALIZACION = 'http://www.w3.org/2001/10/xml-exc-c14n#';

/**
 * Verifica que un XML esté bien formado antes de firmarlo. Lanza un error
 * apenas el parser reporta CUALQUIER problema (warning, error o
 * fatalError) — no solo los fatales — porque para firmar un documento
 * legal/fiscal preferimos rechazar de más a firmar una versión "reparada"
 * que el emisor original nunca envió.
 *
 * Esto detecta XML vacío, etiquetas/atributos sin cerrar y etiquetas
 * cruzadas (ej. `<a><b></a></b>`) — pero sigue sin ser una validación de
 * esquema completa. Si `/api` recibe el XML de una fuente no confiable,
 * conviene validarlo también contra el XSD de Hacienda antes de llegar
 * hasta aquí.
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
 * @param {string} xmlFactura - el XML de la factura, sin firmar (ej. el
 *   `xmlFactura` que llega en la solicitud de firma, ver Flujo B en CLAUDE.md).
 * @param {string|Buffer} llavePrivada - llave privada RSA en formato PEM,
 *   ya descifrada en memoria (tal como la entrega
 *   `hsmService.cargarLlaveTemporalmente`).
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
  });

  // "/*" = el elemento raíz del documento (ej. <FacturaElectronica>), sea
  // cual sea su nombre — así no dependemos de un tag fijo.
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
};
