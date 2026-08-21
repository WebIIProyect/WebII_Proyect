/**
 * serialService.js
 * Generación del número de serie único de cada certificado digital.
 *
 * Formato: CERT-YYYYMMDD-XXXXXXXXXXXXXXXX
 *   - Prefijo fijo "CERT" para identificar visualmente el tipo de recurso.
 *   - Fecha de emisión (YYYYMMDD) para que el serial sea legible/ordenable
 *     a simple vista, igual que hace Hacienda con la clave numérica.
 *   - 16 caracteres hexadecimales al azar (8 bytes de crypto.randomBytes)
 *     para que sea prácticamente imposible que choque con otro.
 *
 * La unicidad real la garantiza el UNIQUE de la columna numero_serie en
 * la base de datos (ver database/schema_completo.sql) — esta función solo
 * hace que una colisión sea astronómicamente improbable.
 */

const crypto = require('crypto');

function generarSerial() {
  const fecha = new Date();
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');

  const aleatorio = crypto.randomBytes(8).toString('hex').toUpperCase();

  return `CERT-${yyyy}${mm}${dd}-${aleatorio}`;
}

module.exports = { generarSerial };