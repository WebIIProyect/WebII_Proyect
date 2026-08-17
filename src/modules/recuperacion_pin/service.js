const crypto = require('crypto');
const bcrypt = require('bcrypt');
const queries = require('./queries');

async function solicitarRecuperacion(identificacion, ip_solicitud) {
  if (!identificacion) {
    const err = new Error('La identificación es requerida');
    err.status = 400;
    throw err;
  }

  const contribuyente = await queries.buscarPorIdentificacion(identificacion);
  if (!contribuyente) {
    const err = new Error('No existe un contribuyente con esa identificación');
    err.status = 404;
    throw err;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const fecha_expiracion = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

  const solicitud = await queries.crearSolicitud(
    contribuyente.id_contribuyente,
    token,
    fecha_expiracion,
    ip_solicitud
  );

  // En un sistema real esto se envía por correo, no se devuelve en la respuesta.
  return solicitud;
}

async function confirmarRecuperacion(token, nuevoPin) {
  if (!token || !nuevoPin) {
    const err = new Error('El token y el nuevo PIN son requeridos');
    err.status = 400;
    throw err;
  }

  const solicitud = await queries.buscarTokenValido(token);
  if (!solicitud) {
    const err = new Error('Token inválido, expirado o ya utilizado');
    err.status = 400;
    throw err;
  }

  const pin_hash = await bcrypt.hash(nuevoPin, 10);
  await queries.actualizarPin(solicitud.id_contribuyente, pin_hash);
  await queries.marcarUsado(solicitud.id_recuperacion);

  return { mensaje: 'PIN actualizado correctamente' };
}

module.exports = { solicitarRecuperacion, confirmarRecuperacion };