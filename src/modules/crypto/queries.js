/**
 * queries.js — módulo /crypto
 * Acceso a la tabla `boveda_llaves_privadas` (bóveda de llaves).
 *
 * `Transacciones_Firma` y `Transacciones_Cifrado` NO se incluyen aquí todavía:
 * corresponden al punto 5 del checklist (registro de transacciones).
 */

const pool = require('../../config/db.js');

/**
 * Inserta la llave de un contribuyente en la bóveda, o la reemplaza si ya
 * existía (un contribuyente tiene una sola fila en la bóveda — ver el
 * UNIQUE sobre id_contribuyente en el schema).
 *
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
 * (para descifrarlo y cargarlo temporalmente en memoria — HSM simulado).
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

module.exports = {
  guardarLlaveEnBoveda,
  obtenerLlaveDeBoveda,
};
