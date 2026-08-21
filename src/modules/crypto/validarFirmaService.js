//Servicio de validación de firmas XMLDSig (punto 4 del checklist).
 

const crypto = require('crypto');
const { SignedXml } = require('xml-crypto');
const { DOMParser } = require('@xmldom/xmldom');
const xpath = require('xpath');
const { validarXMLBienFormado } = require('./firmaService.js');

const NAMESPACE_XMLDSIG = 'http://www.w3.org/2000/09/xmldsig#';

/**
 * Extrae la llave pública embebida en un nodo <KeyInfo> con formato
 * <KeyValue><RSAKeyValue><Modulus>/<Exponent>
 *
 * @param {Node|null} keyInfoNode
 * @returns {string|null} PEM de la llave pública, o null si no se encontró.
 */
function extraerLlavePublicaDeKeyInfo(keyInfoNode) {
  if (!keyInfoNode) return null;

  const modulusNode = xpath.select1(".//*[local-name(.)='Modulus']", keyInfoNode);
  const exponentNode = xpath.select1(".//*[local-name(.)='Exponent']", keyInfoNode);
  if (!modulusNode || !exponentNode) return null;

  try {
    const n = Buffer.from(modulusNode.textContent.trim(), 'base64').toString('base64url');
    const e = Buffer.from(exponentNode.textContent.trim(), 'base64').toString('base64url');
    return crypto.createPublicKey({ key: { kty: 'RSA', n, e }, format: 'jwk' }).export({ type: 'spki', format: 'pem' });
  } catch {
    return null;
  }
}

/**
 * Valida que un XML firmado contenga una firma XMLDSig auténtica.
 *
 * @param {string} xmlFirmado - el XML ya firmado (con el nodo <Signature>
 *   que dejó `firmaService.firmarXML`).
 * @param {string|Buffer} [llavePublicaEsperada] - PEM de la llave pública
 *   contra la que se quiere validar 
 * @returns {{ esValida: boolean, motivo?: string, origenLlave?: 'proporcionada'|'keyInfo' }}
 */
function validarFirmaXML(xmlFirmado, llavePublicaEsperada) {
  if (!xmlFirmado || typeof xmlFirmado !== 'string') {
    return { esValida: false, motivo: 'El XML firmado está vacío o no es un string.' };
  }

  try {
    validarXMLBienFormado(xmlFirmado);
  } catch (error) {
    return { esValida: false, motivo: `El XML no está bien formado: ${error.message}` };
  }

  const documento = new DOMParser().parseFromString(xmlFirmado, 'text/xml');
  const nodosFirma = documento.getElementsByTagNameNS(NAMESPACE_XMLDSIG, 'Signature');

  if (!nodosFirma || nodosFirma.length === 0) {
    return { esValida: false, motivo: 'El XML no contiene ningún nodo <Signature> — no está firmado.' };
  }

  const origenLlave = llavePublicaEsperada ? 'proporcionada' : 'keyInfo';

  const verificador = new SignedXml(
    llavePublicaEsperada
      ? { publicCert: llavePublicaEsperada }
      : { getCertFromKeyInfo: (keyInfoNode) => extraerLlavePublicaDeKeyInfo(keyInfoNode) }
  );

  try {
    // Si el XML tuviera más de una firma, se valida la primera 
    verificador.loadSignature(nodosFirma[0]);

    if (!llavePublicaEsperada && !extraerLlavePublicaDeKeyInfo(nodosFirma[0])) {
      return {
        esValida: false,
        motivo: 'No se proporcionó una llave pública y el documento no trae una embebida en <KeyInfo>.',
        origenLlave,
      };
    }

    const esValida = verificador.checkSignature(xmlFirmado);

    if (!esValida) {
      const errores = verificador
        .getReferences()
        .map((referencia) => referencia.validationError && referencia.validationError.message)
        .filter(Boolean);

      return {
        esValida: false,
        motivo: errores.length
          ? errores.join(' | ')
          : 'La firma no es válida: el documento pudo haber sido alterado después de firmarse, o la llave pública no corresponde a la que firmó.',
        origenLlave,
      };
    }

    return { esValida: true, origenLlave };
  } catch (error) {
    return { esValida: false, motivo: `Error al validar la firma: ${error.message}`, origenLlave };
  }
}

module.exports = {
  validarFirmaXML,
  extraerLlavePublicaDeKeyInfo,
};
