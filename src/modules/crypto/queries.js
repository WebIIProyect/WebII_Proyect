
const pool = require('../../config/db.js');

/**
 * Inserta la llave de un contribuyente en la bóveda, o la reemplaza si ya
 * existía
 * @param {object} datos
 * @param {number} datos.idContribuyente
 * @param {string} datos.llavePublica - PEM, en claro (no es secreta).
 * @param {string} datos.llavePrivadaCifrada - ciphertext en base64 (AES-256-GCM).
 * @param {string} datos.iv - vector de inicialización en base64.
 * @param {string} datos.authTag - tag de autenticación GCM en base64.
 * @param {string} [datos.algoritmo='AES-256-GCM']
 * @returns {Promise<object>} la fila resultante (sin el material cifrado).
 */
async function guardarLlaveEnBoveda({
  idContribuyente,
  llavePublica,
  llavePrivadaCifrada,
  iv,
  authTag,
  algoritmo = 'AES-256-GCM',
}) {
  const { rows } = await pool.query(
    `
    INSERT INTO boveda_llaves_privadas
      (id_contribuyente, llave_publica, llave_privada_cifrada, iv, auth_tag, algoritmo)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (id_contribuyente) DO UPDATE SET
      llave_publica          = EXCLUDED.llave_publica,
      llave_privada_cifrada  = EXCLUDED.llave_privada_cifrada,
      iv                     = EXCLUDED.iv,
      auth_tag               = EXCLUDED.auth_tag,
      algoritmo               = EXCLUDED.algoritmo,
      fecha_actualizacion    = NOW()
    RETURNING id_boveda, id_contribuyente, algoritmo, fecha_creacion, fecha_actualizacion
    `,
    [idContribuyente, llavePublica, llavePrivadaCifrada, iv, authTag, algoritmo]
  );

  return rows[0];
}

/**
 * Obtiene el registro cifrado de la bóveda para un contribuyente
 *
 * @param {number} idContribuyente
 * @returns {Promise<object|null>} la fila completa, o null si no tiene llave.
 */
async function obtenerLlaveDeBoveda(idContribuyente) {
  const { rows } = await pool.query(
    `
    SELECT id_boveda, id_contribuyente, llave_publica, llave_privada_cifrada,
           iv, auth_tag, algoritmo, fecha_creacion, fecha_actualizacion
    FROM boveda_llaves_privadas
    WHERE id_contribuyente = $1
    `,
    [idContribuyente]
  );

  return rows[0] || null;
}

/**
 * Registra una operación de firma (exitosa o fallida) en transacciones_firma.
 *
 * @param {object} datos
 * @param {number} datos.idContribuyente
 * @param {string} datos.serialCertificado - serial del certificado usado (lo entrega /certificate).
 * @param {string} datos.hashDocumento - hash SHA-256 (hex) del XML firmado (ver `hashService`).
 * @param {'EXITOSA'|'FALLIDA'} [datos.resultado='EXITOSA']
 * @param {string} [datos.detalleError] - mensaje de error, solo si resultado='FALLIDA'.
 * @returns {Promise<object>} la fila insertada.
 */
async function registrarTransaccionFirma({
  idContribuyente,
  serialCertificado,
  hashDocumento,
  resultado = 'EXITOSA',
  detalleError = null,
}) {
  const { rows } = await pool.query(
    `
    INSERT INTO transacciones_firma
      (id_contribuyente, serial_certificado, hash_documento, resultado, detalle_error)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id_transaccion_firma, id_contribuyente, serial_certificado, resultado, fecha_hora
    `,
    [idContribuyente, serialCertificado, hashDocumento, resultado, detalleError]
  );

  return rows[0];
}

/**
 * Historial de firmas de un contribuyente, más recientes primero
 *
 * @param {number} idContribuyente
 * @returns {Promise<object[]>}
 */
async function obtenerTransaccionesFirmaPorContribuyente(idContribuyente) {
  const { rows } = await pool.query(
    `
    SELECT id_transaccion_firma, serial_certificado, hash_documento, resultado, detalle_error, fecha_hora
    FROM transacciones_firma
    WHERE id_contribuyente = $1
    ORDER BY fecha_hora DESC
    `,
    [idContribuyente]
  );

  return rows;
}

/**
 * Registra una operación de cifrado o descifrado (exitosa o fallida) en
 * transacciones_cifrado
 *
 * @param {object} datos
 * @param {number} datos.idContribuyente
 * @param {'CIFRADO'|'DESCIFRADO'} datos.operacion
 * @param {string} [datos.algoritmo='AES-256-GCM']
 * @param {'EXITOSA'|'FALLIDA'} [datos.resultado='EXITOSA']
 * @param {string} [datos.detalleError] - mensaje de error, solo si resultado='FALLIDA'.
 * @returns {Promise<object>} la fila insertada.
 */
async function registrarTransaccionCifrado({
  idContribuyente,
  operacion,
  algoritmo = 'AES-256-GCM',
  resultado = 'EXITOSA',
  detalleError = null,
}) {
  const { rows } = await pool.query(
    `
    INSERT INTO transacciones_cifrado
      (id_contribuyente, operacion, algoritmo, resultado, detalle_error)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id_transaccion_cifrado, id_contribuyente, operacion, resultado, fecha_hora
    `,
    [idContribuyente, operacion, algoritmo, resultado, detalleError]
  );

  return rows[0];
}

module.exports = {
  guardarLlaveEnBoveda,
  obtenerLlaveDeBoveda,
  registrarTransaccionFirma,
  obtenerTransaccionesFirmaPorContribuyente,
  registrarTransaccionCifrado,
};
