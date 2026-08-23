/**
 * service.js — módulo /certificate
 * Ciclo de vida completo del certificado digital (Integrante 2).
 *
 * Se apoya en el módulo /crypto (Integrante 3) para la parte puramente
 * criptográfica: generar el par de llaves RSA y guardar/cifrar la llave
 * privada en la bóveda del HSM simulado. Este módulo NUNCA maneja la llave
 * privada directamente — solo la llave pública, que sí forma parte del
 * certificado.
 */

const crypto = require('../crypto');
const queries = require('./queries');
const stateService = require('./stateService');
const { generarSerial } = require('./serialService');

// Decisión ya tomada para el proyecto (ver CLAUDE.md de /crypto, sección 5):
// vigencia de 2 años para el certificado/firma.
const VIGENCIA_ANIOS = 2;

function calcularFechaExpiracion(desde = new Date()) {
  const fecha = new Date(desde);
  fecha.setFullYear(fecha.getFullYear() + VIGENCIA_ANIOS);
  return fecha;
}

// ─── Solicitudes ─────────────────────────────────────────────────────────

const solicitarCertificado = async (id_contribuyente, observaciones) => {
  if (!id_contribuyente) {
    const error = new Error('id_contribuyente es obligatorio');
    error.status = 400;
    throw error;
  }
  const { rows } = await queries.crearSolicitud({ id_contribuyente, observaciones });
  return rows[0];
};

const listarSolicitudes = async () => {
  const { rows } = await queries.listarSolicitudes();
  return rows;
};

const obtenerSolicitud = async (id_solicitud) => {
  const { rows } = await queries.obtenerSolicitudPorId(id_solicitud);
  if (rows.length === 0) {
    const error = new Error('Solicitud no encontrada');
    error.status = 404;
    throw error;
  }
  return rows[0];
};

const listarSolicitudesDeContribuyente = async (id_contribuyente) => {
  const { rows } = await queries.listarSolicitudesPorContribuyente(id_contribuyente);
  return rows;
};

const rechazarSolicitud = async (id_solicitud, motivo) => {
  const solicitud = await obtenerSolicitud(id_solicitud);
  stateService.asegurarTransicionSolicitud(solicitud.estado, 'RECHAZADA');

  if (!motivo) {
    const error = new Error('motivo es obligatorio para rechazar una solicitud');
    error.status = 400;
    throw error;
  }

  const { rows } = await queries.resolverSolicitud(id_solicitud, 'RECHAZADA', motivo);
  return rows[0];
};

// ─── Emisión ─────────────────────────────────────────────────────────────

const emitirCertificado = async (id_solicitud) => {
  const solicitud = await obtenerSolicitud(id_solicitud);
  stateService.asegurarTransicionSolicitud(solicitud.estado, 'APROBADA');

  const { publicKey, privateKey } = crypto.rsa.generarParLlavesRSA();
  await crypto.hsm.guardarLlaveEnBoveda(solicitud.id_contribuyente, publicKey, privateKey);

  let numero_serie = generarSerial();
  let existente = await queries.obtenerCertificadoPorSerial(numero_serie);
  while (existente.rows.length > 0) {
    numero_serie = generarSerial();
    existente = await queries.obtenerCertificadoPorSerial(numero_serie);
  }

  const fecha_expiracion = calcularFechaExpiracion();
  const { rows } = await queries.crearCertificado({
    id_contribuyente: solicitud.id_contribuyente,
    id_solicitud: solicitud.id_solicitud,
    numero_serie,
    llave_publica: publicKey,
    algoritmo: 'RSA-2048',
    fecha_expiracion,
  });
  const certificado = rows[0];

  await queries.resolverSolicitud(id_solicitud, 'APROBADA', null);

  await queries.registrarCambioEstado({
    id_certificado: certificado.id_certificado,
    estado_anterior: null,
    estado_nuevo: 'VIGENTE',
    motivo: 'Emisión de certificado',
  });

  return certificado;
};

// ─── Consulta ────────────────────────────────────────────────────────────

const listarCertificados = async () => {
  const { rows } = await queries.listarCertificados();
  return rows;
};

const obtenerCertificado = async (id_certificado) => {
  const { rows } = await queries.obtenerCertificadoPorId(id_certificado);
  if (rows.length === 0) {
    const error = new Error('Certificado no encontrado');
    error.status = 404;
    throw error;
  }
  return rows[0];
};

const obtenerCertificadoPorSerial = async (numero_serie) => {
  const { rows } = await queries.obtenerCertificadoPorSerial(numero_serie);
  if (rows.length === 0) {
    const error = new Error('Certificado no encontrado');
    error.status = 404;
    throw error;
  }
  return rows[0];
};

const listarCertificadosDeContribuyente = async (id_contribuyente) => {
  const { rows } = await queries.listarCertificadosPorContribuyente(id_contribuyente);
  return rows;
};

const consultarEstado = async (id_certificado) => {
  let certificado = await obtenerCertificado(id_certificado);

  if (certificado.estado === 'VIGENTE' && new Date(certificado.fecha_expiracion) < new Date()) {
    certificado = await expirarCertificado(id_certificado);
  }

  return certificado;
};

const listarHistorial = async (id_certificado) => {
  await obtenerCertificado(id_certificado);
  const { rows } = await queries.listarHistorialPorCertificado(id_certificado);
  return rows;
};

// ─── Renovación ──────────────────────────────────────────────────────────

const renovarCertificado = async (id_certificado_anterior, motivo) => {
  const anterior = await obtenerCertificado(id_certificado_anterior);
  stateService.asegurarTransicionCertificado(anterior.estado, 'RENOVADO');

  const { publicKey, privateKey } = crypto.rsa.generarParLlavesRSA();
  await crypto.hsm.guardarLlaveEnBoveda(anterior.id_contribuyente, publicKey, privateKey);

  let numero_serie = generarSerial();
  let existente = await queries.obtenerCertificadoPorSerial(numero_serie);
  while (existente.rows.length > 0) {
    numero_serie = generarSerial();
    existente = await queries.obtenerCertificadoPorSerial(numero_serie);
  }

  const fecha_expiracion = calcularFechaExpiracion();
  const { rows } = await queries.crearCertificado({
    id_contribuyente: anterior.id_contribuyente,
    id_solicitud: anterior.id_solicitud,
    numero_serie,
    llave_publica: publicKey,
    algoritmo: 'RSA-2048',
    fecha_expiracion,
  });
  const nuevo = rows[0];

  await queries.registrarCambioEstado({
    id_certificado: nuevo.id_certificado,
    estado_anterior: null,
    estado_nuevo: 'VIGENTE',
    motivo: `Emitido por renovación del certificado ${anterior.numero_serie}`,
  });

  await queries.crearRenovacion({
    id_certificado_anterior: anterior.id_certificado,
    id_certificado_nuevo: nuevo.id_certificado,
    motivo,
  });

  await queries.cambiarEstadoCertificado(anterior.id_certificado, 'RENOVADO');
  await queries.registrarCambioEstado({
    id_certificado: anterior.id_certificado,
    estado_anterior: 'VIGENTE',
    estado_nuevo: 'RENOVADO',
    motivo: motivo || 'Renovación de certificado',
  });

  return nuevo;
};

// ─── Revocación ──────────────────────────────────────────────────────────

const revocarCertificado = async (id_certificado, motivo) => {
  if (!motivo) {
    const error = new Error('motivo es obligatorio para revocar un certificado');
    error.status = 400;
    throw error;
  }

  const certificado = await obtenerCertificado(id_certificado);
  stateService.asegurarTransicionCertificado(certificado.estado, 'REVOCADO');

  const { rows } = await queries.cambiarEstadoCertificado(id_certificado, 'REVOCADO');
  await queries.crearRevocacion({ id_certificado, motivo });
  await queries.registrarCambioEstado({
    id_certificado,
    estado_anterior: certificado.estado,
    estado_nuevo: 'REVOCADO',
    motivo,
  });

  return rows[0];
};

// ─── Expiración ──────────────────────────────────────────────────────────

const expirarCertificado = async (id_certificado) => {
  const certificado = await obtenerCertificado(id_certificado);

  if (stateService.esEstadoTerminal(certificado.estado)) {
    return certificado;
  }

  const { rows } = await queries.cambiarEstadoCertificado(id_certificado, 'EXPIRADO');
  await queries.registrarCambioEstado({
    id_certificado,
    estado_anterior: certificado.estado,
    estado_nuevo: 'EXPIRADO',
    motivo: 'Vencimiento de la fecha de expiración',
  });

  return rows[0];
};

const expirarCertificadosVencidos = async () => {
  const { rows: vencidos } = await queries.listarCertificadosVigentesExpirados(new Date());

  const resultados = [];
  for (const certificado of vencidos) {
    const actualizado = await expirarCertificado(certificado.id_certificado);
    resultados.push(actualizado);
  }
  return resultados;
};

module.exports = {
  VIGENCIA_ANIOS,
  solicitarCertificado,
  listarSolicitudes,
  obtenerSolicitud,
  listarSolicitudesDeContribuyente,
  rechazarSolicitud,
  emitirCertificado,
  listarCertificados,
  obtenerCertificado,
  obtenerCertificadoPorSerial,
  listarCertificadosDeContribuyente,
  consultarEstado,
  listarHistorial,
  renovarCertificado,
  revocarCertificado,
  expirarCertificado,
  expirarCertificadosVencidos,
};