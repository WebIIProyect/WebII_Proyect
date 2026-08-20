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
 */

const { SignedXml } = require('xml-crypto');
const { DOMParser } = require('@xmldom/xmldom');
const { validarXMLBienFormado } = require('./firmaService.js');

const NAMESPACE_XMLDSIG = 'http://www.w3.org/2000/09/xmldsig#';

/**
 * Valida que un XML firmado contenga una firma XMLDSig auténtica y
 * verificable con la llave pública indicada.
 *
 * @param {string} xmlFirmado - el XML ya firmado (con el nodo <Signature>
 *   que dejó `firmaService.firmarXML`).
 * @param {string|Buffer} llavePublica - PEM de la llave pública contra la
 *   que se valida (la misma que se guardó en `boveda_llaves_privadas`,
 *   ahí sí en claro porque no es secreta).
 * @returns {{ esValida: boolean, motivo?: string }} `esValida` en true solo
 *   si la firma es criptográficamente correcta; si es false, `motivo`
 *   explica por qué (para poder registrarlo o mostrarlo al usuario).
 */
function validarFirmaXML(xmlFirmado, llavePublica) {
  if (!xmlFirmado || typeof xmlFirmado !== 'string') {
    return { esValida: false, motivo: 'El XML firmado está vacío o no es un string.' };
  }
  if (!llavePublica) {
    return { esValida: false, motivo: 'Se requiere la llave pública para validar la firma.' };
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

  const verificador = new SignedXml({ publicCert: llavePublica });

  try {
    // Si el XML tuviera más de una firma, se valida la primera — el Flujo B
    // de este proyecto solo aplica una firma por factura.
    verificador.loadSignature(nodosFirma[0]);
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
      };
    }

    return { esValida: true };
  } catch (error) {
    return { esValida: false, motivo: `Error al validar la firma: ${error.message}` };
  }
}

module.exports = {
  validarFirmaXML,
};
