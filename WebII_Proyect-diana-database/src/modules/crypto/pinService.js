//Verificación de PIN de firma con hash BCrypt (punto 6 del checklist).

const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;  // vueltas internas de BCrypt 
const PIN_LONGITUD_MINIMA = 8;  // el PIN no puede tener menos de 8 caracteres
const PIN_LONGITUD_MAXIMA = 16; // el PIN no puede tener más de 16 caracteres

/**
 * Valida el PIN de firma contra la política de seguridad: longitud, mayúsculas, minúsculas, números y símbolos.
 * @param {string} pin
 * @returns {{ valido: boolean, motivo?: string }}
 */
function validarPoliticaPin(pin) {
  if (!pin || typeof pin !== 'string') {
    return { valido: false, motivo: 'El PIN es requerido.' };
  }
  if (pin.length < PIN_LONGITUD_MINIMA || pin.length > PIN_LONGITUD_MAXIMA) {
    return {
      valido: false,
      motivo: `El PIN debe tener entre ${PIN_LONGITUD_MINIMA} y ${PIN_LONGITUD_MAXIMA} caracteres.`,
    };
  }
  if (!/[A-Z]/.test(pin)) {
    return { valido: false, motivo: 'El PIN debe incluir al menos 1 letra mayúscula.' };
  }
  if (!/[a-z]/.test(pin)) {
    return { valido: false, motivo: 'El PIN debe incluir al menos 1 letra minúscula.' };
  }
  if (!/[0-9]/.test(pin)) {
    return { valido: false, motivo: 'El PIN debe incluir al menos 1 número.' };
  }
  if (!/[^A-Za-z0-9]/.test(pin)) {
    return { valido: false, motivo: 'El PIN debe incluir al menos 1 símbolo (ej. !@#$%&*).' };
  }

  return { valido: true };
}

/**
 * Genera el hash BCrypt de un PIN nuevo, listo para guardar en la BD
 *
 * @param {string} pin - PIN en claro, recién elegido por el contribuyente.
 * @returns {Promise<string>} el hash BCrypt, para guardar en `pin_hash`.
 * @throws {Error} si el PIN no cumple la política.
 */
async function hashearPin(pin) {
  const { valido, motivo } = validarPoliticaPin(pin);
  if (!valido) {
    throw new Error(`hashearPin: PIN inválido — ${motivo}`);
  }

  return bcrypt.hash(pin, SALT_ROUNDS);
}

/**
 * Verifica si un PIN en claro coincide con un hash BCrypt ya guardado.
 *
 * @param {string} pin - PIN ingresado por el contribuyente.
 * @param {string} hashAlmacenado - pin_hash guardado en la BD.
 * @returns {Promise<boolean>} true si coincide.
 */
async function verificarPin(pin, hashAlmacenado) {
  if (!pin || !hashAlmacenado) {
    return false;
  }

  return bcrypt.compare(pin, hashAlmacenado);
}

module.exports = {
  PIN_LONGITUD_MINIMA,
  PIN_LONGITUD_MAXIMA,
  validarPoliticaPin,
  hashearPin,
  verificarPin,
};
