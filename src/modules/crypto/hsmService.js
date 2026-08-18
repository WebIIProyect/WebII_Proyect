
const crypto = require('crypto');
const queries = require('./queries.js');

const ALGORITMO_CIFRADO = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // tamaño recomendado de IV para GCM
const AUTH_TAG_LENGTH_BYTES = 16;

/**
 *  
 *
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
 * en claro como Buffer (para poder destruirla luego con `fill(0)`).
 * GCM valida el authTag automáticamente: si el ciphertext fue manipulado,
 * `decipher.final()` lanza un error en vez de devolver datos corruptos.
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
 * (uso típico: justo después de `rsaService.generarParLlavesRSA()`, en el
 * Flujo A — alta de certificado).
 *
 * @param {number} idContribuyente
 * @param {string} llavePublica - PEM, se guarda en claro (no es secreta).
 * @param {string} llavePrivadaPem - PEM, se cifra antes de guardar.
 * @returns {Promise<object>} la fila insertada/actualizada (sin el material cifrado).
 */
async function guardarLlaveEnBoveda(idContribuyente, llavePublica, llavePrivadaPem) {
  const { llavePrivadaCifrada, iv, authTag, algoritmo } = cifrarLlavePrivada(llavePrivadaPem);

  return queries.guardarLlaveEnBoveda({
    idContribuyente,
    llavePublica,
    llavePrivadaCifrada,
    iv,
    authTag,
    algoritmo,
  });
}

/**
 * Carga temporalmente la llave privada de un contribuyente en memoria:
 * la trae cifrada desde la bóveda y la descifra al vuelo. El llamador
 * (más adelante, el servicio de firma del punto 3) es responsable de:
 *   1. Usar `llavePrivadaBuffer` SOLO durante la operación de firma.
 *   2. Llamar a `destruirLlaveDeMemoria(llavePrivadaBuffer)` apenas termine,
 *      esté la firma en éxito o en error (idealmente en un `finally`).
 *
 * @param {number} idContribuyente
 * @returns {Promise<{ llavePublica: string, llavePrivadaBuffer: Buffer }>}
 */
async function cargarLlaveTemporalmente(idContribuyente) {
  const registro = await queries.obtenerLlaveDeBoveda(idContribuyente);
  if (!registro) {
    throw new Error(`No existe llave en la bóveda para el contribuyente ${idContribuyente}.`);
  }

  const llavePrivadaBuffer = descifrarLlavePrivada({
    llavePrivadaCifrada: registro.llave_privada_cifrada,
    iv: registro.iv,
    authTag: registro.auth_tag,
  });

  return {
    llavePublica: registro.llave_publica,
    llavePrivadaBuffer,
  };
}

/**
 * "Destruye" una llave privada que estaba en memoria en claro: sobrescribe
 * todos sus bytes con ceros para que ya no quede el valor real en el Buffer,
 * y así intentar minimizar la ventana de tiempo en la que la llave existe en
 * claro. Ver la nota honesta en el encabezado del archivo sobre las
 * limitaciones reales de esto en JavaScript.
 *
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
