/**
 * validarFirmaService.js
 * Servicio de validación de firmas XMLDSig (punto 4 del checklist).
 *
 * Es el complemento de `firmaService.js`: mientras ese firma, este verifica
 * que una firma ya aplicada sobre un XML sea auténtica — es decir, que el
 * documento no fue alterado después de firmarse y que la firma corresponde
 * de verdad a la llave pública indicada.
 *
 * Alcance de este archivo — a propósito, SOLO valida la firma criptográfica:
 *   - NO consulta si el certificado del contribuyente sigue vigente, está
 *     revocado o expirado. Esa parte le corresponde al módulo /certificate
 *     (Integrante 2). De hecho, según la política ya definida en
 *     CLAUDE.md, un certificado vencido igual debe poder usarse para
 *     validar firmas hechas cuando SÍ estaba vigente — por eso esta función
 *     no depende en nada del estado del certificado, solo de la matemática
 *     de la firma.
 *   - NO registra la operación en `Transacciones_Firma`/`Transacciones_Cifrado`
 *     (eso es el punto 5).
 *
 * Dos modos de validar (pedido del equipo tras revisar el frontend):
 *   1. Con `llavePublicaEsperada` — el modo fuerte: confirma que la firma
 *      corresponde EXACTAMENTE a esa llave (ej. la guardada en la bóveda
 *      para el contribuyente que dice haber firmado). Úsalo siempre que
 *      sepas quién debería haber firmado.
 *   2. Sin `llavePublicaEsperada` — extrae la llave directamente del
 *      `<KeyInfo>` que `firmaService.firmarXML` ya embebe en el documento.
 *      Solo confirma que la firma es "autoconsistente" (nadie tocó el
 *      documento después de firmarlo con ESA llave) — NO confirma que esa
 *      llave sea de verdad de quien dice ser. Cualquiera podría firmar con
 *      su propia llave y pasar este modo. Para confirmar identidad hace
 *      falta el certificado (Integrante 2) o comparar contra la bóveda.
 *      El resultado indica `origenLlave` para que quien lo use sepa cuál
 *      de los dos modos corrió.
 */

const crypto = require('crypto');
const { SignedXml } = require('xml-crypto');
const { DOMParser } = require('@xmldom/xmldom');
const xpath = require('xpath');
const { validarXMLBienFormado } = require('./firmaService.js');

const NAMESPACE_XMLDSIG = 'http://www.w3.org/2000/09/xmldsig#';

/**
 * Extrae la llave pública embebida en un nodo <KeyInfo> con formato
 * <KeyValue><RSAKeyValue><Modulus>/<Exponent> — el que genera
 * `firmaService.construirKeyInfoRSA`.
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
 *   contra la que se quiere validar (ej. la guardada en la bóveda para el
 *   contribuyente). Si se omite, se usa la llave embebida en el propio
 *   `<KeyInfo>` del documento (ver nota de dos modos arriba).
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
    // Si el XML tuviera más de una firma, se valida la primera — el Flujo B
    // de este proyecto solo aplica una firma por factura.
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
