/**
 * pinService.js
 * Verificación de PIN de firma con hash BCrypt (punto 6 del checklist).
 *
 * Alcance de este archivo — a propósito, NO toca la base de datos:
 *   - No lee ni escribe la tabla `contribuyentes` (esa tabla y su columna
 *     `pin_hash` son del Integrante 1, no de este módulo).
 *   - No implementa el bloqueo de 3 intentos fallidos / 15 minutos — esa
 *     lógica de estado (contar intentos, bloquear, desbloquear pasado el
 *     tiempo) vive en `/auth` o `/users`. Esta función solo responde
 *     "¿este PIN coincide con este hash?" cada vez que se le pregunta, para
 *     que quien la use pueda contar los intentos y aplicar el bloqueo por
 *     su cuenta (ver CLAUDE.md, sección 6).
 *
 * Encaja en dos momentos del proyecto:
 *   - Al dar de alta o cambiar el PIN de firma → `validarPoliticaPin` +
 *     `hashearPin` (Flujo A, y también al confirmar una recuperación de PIN).
 *   - Cada vez que se solicita una firma → `verificarPin` (paso 1 del
 *     Flujo B en CLAUDE.md, antes de cargar la llave privada del HSM).
 */

const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10; // mismo valor que ya usan contribuyentes/service.js y recuperacion_pin/service.js

const PIN_LONGITUD_MINIMA = 8;
const PIN_LONGITUD_MAXIMA = 16;

/**
 * Valida el PIN de firma contra la política del proyecto (CLAUDE.md,
 * sección 6): entre 8 y 16 caracteres, con al menos 1 mayúscula,
 * 1 minúscula, 1 número y 1 símbolo.
 *
 * No lanza excepción — devuelve el resultado para que el llamador decida
 * qué hacer (ej. mostrarle al usuario por qué se rechazó su PIN nuevo).
 *
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
 * Genera el hash BCrypt de un PIN nuevo, listo para guardar en la BD.
 * Aplica `validarPoliticaPin` primero y rechaza el PIN si no cumple —
 * a diferencia de `verificarPin`, esta función SÍ debe fallar fuerte,
 * porque su trabajo es evitar que un PIN débil llegue a guardarse.
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
 * No valida la política aquí a propósito: un hash ya guardado pudo haberse
 * creado bajo una política anterior, y lo único que importa al firmar es
 * si el PIN ingresado coincide con el que el contribuyente ya tiene.
 *
 * @param {string} pin - PIN ingresado por el contribuyente.
 * @param {string} hashAlmacenado - `pin_hash` guardado en la BD.
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
