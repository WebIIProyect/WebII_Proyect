const pool = require('../../config/db');

/**
 * Busca el certificado digital cuya llave pública coincide exactamente con
 * la proporcionada (lectura sobre certificados_digitales, tabla de
 * /certificate). Se usa para determinar quién firmó un XML antes de validar
 * la firma contra la llave que consta oficialmente en el sistema.
 *
 * @param {string} llavePublicaPem
 * @returns {Promise<object|null>}
 */
const buscarCertificadoPorLlavePublica = (llavePublicaPem) => {
  return pool.query(
    `SELECT id_certificado, id_contribuyente, numero_serie, llave_publica,
            algoritmo, estado, fecha_emision, fecha_expiracion
     FROM certificados_digitales
     WHERE llave_publica = $1
     ORDER BY fecha_emision DESC
     LIMIT 1`,
    [llavePublicaPem]
  ).then(({ rows }) => rows[0] || null);
};

/**
 * Lee únicamente el pin_hash de un contribuyente (para verificar el PIN
 * antes de operaciones sensibles: cambiar PIN, renovar o revocar).
 *
 * @param {number} idContribuyente
 * @returns {Promise<string|null>}
 */
const obtenerPinHashPorId = (idContribuyente) => {
  return pool.query(
    `SELECT pin_hash FROM contribuyentes WHERE id_contribuyente = $1`,
    [idContribuyente]
  ).then(({ rows }) => (rows[0] ? rows[0].pin_hash : null));
};

/**
 * Reemplaza el pin_hash de un contribuyente (cambio de PIN de firma).
 *
 * @param {number} idContribuyente
 * @param {string} pinHash - hash BCrypt ya generado (ver crypto.pin.hashearPin).
 */
const actualizarPinHash = (idContribuyente, pinHash) => {
  return pool.query(
    `UPDATE contribuyentes SET pin_hash = $1, fecha_actualizacion = NOW() WHERE id_contribuyente = $2`,
    [pinHash, idContribuyente]
  );
};

/**
 * Lee únicamente el password_hash de un contribuyente (para verificar la
 * contraseña de acceso antes de cambiarla).
 *
 * @param {number} idContribuyente
 * @returns {Promise<string|null>}
 */
const obtenerPasswordHashPorId = (idContribuyente) => {
  return pool.query(
    `SELECT password_hash FROM contribuyentes WHERE id_contribuyente = $1`,
    [idContribuyente]
  ).then(({ rows }) => (rows[0] ? rows[0].password_hash : null));
};

/**
 * Reemplaza el password_hash de un contribuyente (cambio de contraseña de acceso).
 *
 * @param {number} idContribuyente
 * @param {string} passwordHash - hash BCrypt ya generado.
 */
const actualizarPasswordHash = (idContribuyente, passwordHash) => {
  return pool.query(
    `UPDATE contribuyentes SET password_hash = $1, fecha_actualizacion = NOW() WHERE id_contribuyente = $2`,
    [passwordHash, idContribuyente]
  );
};

module.exports = {
  buscarCertificadoPorLlavePublica,
  obtenerPinHashPorId,
  actualizarPinHash,
  obtenerPasswordHashPorId,
  actualizarPasswordHash,
};
