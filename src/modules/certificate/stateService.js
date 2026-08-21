/**
 * stateService.js
 * Toda la lógica de estados del ciclo de vida de un certificado digital.
 * Es la única fuente de verdad sobre qué transiciones son válidas — el
 * resto del módulo (service.js) llama a `validarTransicion` en vez de
 * comparar strings de estado a mano.
 *
 * Máquina de estados del certificado (tabla certificados_digitales):
 *
 *   VIGENTE ──► RENOVADO   (se emitió un certificado nuevo que lo reemplaza)
 *   VIGENTE ──► REVOCADO   (se dio de baja antes de expirar)
 *   VIGENTE ──► EXPIRADO   (se venció la fecha_expiracion sin renovarse)
 *
 * RENOVADO, REVOCADO y EXPIRADO son estados terminales: una vez ahí el
 * certificado no vuelve a cambiar de estado (así funciona una PKI real:
 * un certificado revocado no "revive").
 *
 * Aparte, la solicitud (tabla solicitudes_certificado) tiene su propia
 * mini máquina de estados, mucho más simple:
 *
 *   PENDIENTE ──► APROBADA   (se emitió el certificado)
 *   PENDIENTE ──► RECHAZADA  (el administrador la rechazó)
 */

const ESTADOS_CERTIFICADO = ['VIGENTE', 'RENOVADO', 'REVOCADO', 'EXPIRADO'];
const ESTADOS_SOLICITUD = ['PENDIENTE', 'APROBADA', 'RECHAZADA'];

// Mapa de transiciones válidas para el certificado: estado actual -> lista
// de estados a los que puede pasar. Lista vacía = estado terminal.
const TRANSICIONES_CERTIFICADO = {
  VIGENTE: ['RENOVADO', 'REVOCADO', 'EXPIRADO'],
  RENOVADO: [],
  REVOCADO: [],
  EXPIRADO: [],
};

const TRANSICIONES_SOLICITUD = {
  PENDIENTE: ['APROBADA', 'RECHAZADA'],
  APROBADA: [],
  RECHAZADA: [],
};

function validarTransicionCertificado(estadoActual, estadoNuevo) {
  const permitidos = TRANSICIONES_CERTIFICADO[estadoActual];
  return Array.isArray(permitidos) && permitidos.includes(estadoNuevo);
}

function validarTransicionSolicitud(estadoActual, estadoNuevo) {
  const permitidos = TRANSICIONES_SOLICITUD[estadoActual];
  return Array.isArray(permitidos) && permitidos.includes(estadoNuevo);
}

function esEstadoTerminal(estado) {
  const permitidos = TRANSICIONES_CERTIFICADO[estado];
  return Array.isArray(permitidos) && permitidos.length === 0;
}

function asegurarTransicionCertificado(estadoActual, estadoNuevo) {
  if (!validarTransicionCertificado(estadoActual, estadoNuevo)) {
    const error = new Error(
      `Transición de estado inválida: un certificado en estado ${estadoActual} no puede pasar a ${estadoNuevo}.`
    );
    error.status = 409;
    throw error;
  }
}

function asegurarTransicionSolicitud(estadoActual, estadoNuevo) {
  if (!validarTransicionSolicitud(estadoActual, estadoNuevo)) {
    const error = new Error(
      `Transición de estado inválida: una solicitud en estado ${estadoActual} no puede pasar a ${estadoNuevo}.`
    );
    error.status = 409;
    throw error;
  }
}

module.exports = {
  ESTADOS_CERTIFICADO,
  ESTADOS_SOLICITUD,
  TRANSICIONES_CERTIFICADO,
  TRANSICIONES_SOLICITUD,
  validarTransicionCertificado,
  validarTransicionSolicitud,
  esEstadoTerminal,
  asegurarTransicionCertificado,
  asegurarTransicionSolicitud,
};