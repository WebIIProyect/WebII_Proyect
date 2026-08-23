
const crypto = require('crypto');
const queries = require('./queries.js');

const ALGORITMO_CIFRADO = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // tamaño recomendado de IV para GCM
const AUTH_TAG_LENGTH_BYTES = 16;

/**
 * Obtiene la llave maestra de 32 bytes.
 * @returns {Buffer} llave maestra de 32 bytes.
 */

function obtenerLlaveMaestra() {
  const hex = process.env.HSM_MASTER_KEY;
  if (!hex) {
    throw new Error(
      'HSM_MASTER_KEY no está configurada en el .env (se necesita una llave AES-256 de 64 caracteres hex).'
    );
  }

  const llaveMaestra = Buffer.from(hex, 'hex');
  if (llaveMaestra.length !== 32) {
    throw new Error(
      `HSM_MASTER_KEY debe representar 32 bytes (64 caracteres hex); tiene ${llaveMaestra.length} bytes.`
    );
  }

  return llaveMaestra;
}

/**
 * 
 *
 * @param {string} llavePrivadaPem - llave privada en claro, formato PEM.
 * @returns {{ llavePrivadaCifrada: string, iv: string, authTag: string, algoritmo: string }}
 *   todo en base64, salvo `algoritmo`.
 */
function cifrarLlavePrivada(llavePrivadaPem) {
  const llaveMaestra = obtenerLlaveMaestra();
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);

  const cipher = crypto.createCipheriv(ALGORITMO_CIFRADO, llaveMaestra, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  const cifrado = Buffer.concat([cipher.update(llavePrivadaPem, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    llavePrivadaCifrada: cifrado.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    algoritmo: 'AES-256-GCM',
  };
}

/**
 * Descifra el material guardado en la bóveda y devuelve la llave privada
 *
 * @param {{ llavePrivadaCifrada: string, iv: string, authTag: string }} datosCifrados
 * @returns {Buffer} llave privada PEM en claro, en un Buffer.
 */
function descifrarLlavePrivada({ llavePrivadaCifrada, iv, authTag }) {
  const llaveMaestra = obtenerLlaveMaestra();

  const decipher = crypto.createDecipheriv(ALGORITMO_CIFRADO, llaveMaestra, Buffer.from(iv, 'base64'), {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  return Buffer.concat([decipher.update(Buffer.from(llavePrivadaCifrada, 'base64')), decipher.final()]);
}

/**
 * Cifra y guarda en la bóveda el par de llaves de un contribuyente
 * @param {number} idContribuyente
 * @param {string} llavePublica - PEM, se guarda en claro (no es secreta).
 * @param {string} llavePrivadaPem - PEM, se cifra antes de guardar.
 * @returns {Promise<object>} la fila insertada/actualizada (sin el material cifrado).
 */
async function guardarLlaveEnBoveda(idContribuyente, llavePublica, llavePrivadaPem) {
  try {
    const { llavePrivadaCifrada, iv, authTag, algoritmo } = cifrarLlavePrivada(llavePrivadaPem);

    const fila = await queries.guardarLlaveEnBoveda({
      idContribuyente,
      llavePublica,
      llavePrivadaCifrada,
      iv,
      authTag,
      algoritmo,
    });

    await queries.registrarTransaccionCifrado({
      idContribuyente,
      operacion: 'CIFRADO',
      algoritmo,
      resultado: 'EXITOSA',
    });

    return fila;
  } catch (error) {
    // Best-effort: si el registro de la transacción fallida también falla,
    // no queremos que ESE error tape el error original del cifrado/guardado.
    await queries
      .registrarTransaccionCifrado({
        idContribuyente,
        operacion: 'CIFRADO',
        resultado: 'FALLIDA',
        detalleError: error.message,
      })
      .catch(() => {});
    throw error;
  }
}

/**
 * Carga temporalmente la llave privada de un contribuyente en memoria
 * @param {number} idContribuyente
 * @returns {Promise<{ llavePublica: string, llavePrivadaBuffer: Buffer }>}
 */

async function cargarLlaveTemporalmente(idContribuyente) {
  try {
    const registro = await queries.obtenerLlaveDeBoveda(idContribuyente);
    if (!registro) {
      throw new Error(`No existe llave en la bóveda para el contribuyente ${idContribuyente}.`);
    }

    const llavePrivadaBuffer = descifrarLlavePrivada({
      llavePrivadaCifrada: registro.llave_privada_cifrada,
      iv: registro.iv,
      authTag: registro.auth_tag,
    });

    await queries.registrarTransaccionCifrado({
      idContribuyente,
      operacion: 'DESCIFRADO',
      algoritmo: registro.algoritmo,
      resultado: 'EXITOSA',
    });

    return {
      llavePublica: registro.llave_publica,
      llavePrivadaBuffer,
    };
  } catch (error) {
    // Best-effort, mismo criterio que en guardarLlaveEnBoveda: un intento de
    // descifrado fallido
    await queries
      .registrarTransaccionCifrado({
        idContribuyente,
        operacion: 'DESCIFRADO',
        resultado: 'FALLIDA',
        detalleError: error.message,
      })
      .catch(() => {});
    throw error;
  }
}

/**
 * "Destruye" una llave privada que estaba en memoria en claro
 * @param {Buffer} llavePrivadaBuffer
 */
function destruirLlaveDeMemoria(llavePrivadaBuffer) {
  if (Buffer.isBuffer(llavePrivadaBuffer)) {
    llavePrivadaBuffer.fill(0);
  }
}

module.exports = {
  cifrarLlavePrivada,
  descifrarLlavePrivada,
  guardarLlaveEnBoveda,
  cargarLlaveTemporalmente,
  destruirLlaveDeMemoria,
};
