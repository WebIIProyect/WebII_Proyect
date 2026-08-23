const bcrypt = require('bcrypt');
const crypto = require('../crypto');
const contribuyentesQueries = require('../contribuyentes/queries');
const contribuyentesService = require('../contribuyentes/service');
const certificateService = require('../certificate/service');
const queries = require('./queries');

const firmarDocumento = async ({ identificacion, pin, xmlFactura }) => {
  if (!identificacion || !pin || !xmlFactura) {
    const error = new Error('identificacion, pin y xmlFactura son obligatorios');
    error.status = 400;
    throw error;
  }

  const { rows } = await contribuyentesQueries.obtenerPorIdentificacion(identificacion);
  const contribuyente = rows[0];
  if (!contribuyente) {
    const error = new Error('No existe un contribuyente con esa identificación');
    error.status = 404;
    throw error;
  }

  const certificados = await certificateService.listarCertificadosDeContribuyente(contribuyente.id_contribuyente);
  const certificadoVigente = certificados.find((c) => c.estado === 'VIGENTE');
  if (!certificadoVigente) {
    const error = new Error('El contribuyente no tiene un certificado digital vigente');
    error.status = 400;
    throw error;
  }

  const pinValido = await crypto.pin.verificarPin(pin, contribuyente.pin_hash);
  if (!pinValido) {
    await crypto.queries.registrarTransaccionFirma({
      idContribuyente: contribuyente.id_contribuyente,
      serialCertificado: certificadoVigente.numero_serie,
      hashDocumento: crypto.hash.calcularHashSHA256(xmlFactura),
      resultado: 'FALLIDA',
      detalleError: 'PIN incorrecto',
    });
    const error = new Error('PIN incorrecto');
    error.status = 401;
    throw error;
  }

  const { llavePrivadaBuffer } = await crypto.hsm.cargarLlaveTemporalmente(contribuyente.id_contribuyente);
  let xmlFirmado;
  try {
    xmlFirmado = crypto.firma.firmarXML(xmlFactura, llavePrivadaBuffer);
  } finally {
    crypto.hsm.destruirLlaveDeMemoria(llavePrivadaBuffer);
  }

  const hashDocumento = crypto.hash.calcularHashSHA256(xmlFirmado);
  await crypto.queries.registrarTransaccionFirma({
    idContribuyente: contribuyente.id_contribuyente,
    serialCertificado: certificadoVigente.numero_serie,
    hashDocumento,
    resultado: 'EXITOSA',
  });

  return { xmlFirmado, hashDocumento, serialCertificado: certificadoVigente.numero_serie };
};

const validarDocumento = async ({ xmlFirmado }) => {
  if (!xmlFirmado) {
    const error = new Error('xmlFirmado es obligatorio');
    error.status = 400;
    throw error;
  }

  const llavePublicaEnXml = crypto.validarFirma.extraerLlavePublicaDeXMLFirmado(xmlFirmado);
  if (!llavePublicaEnXml) {
    return { esValida: false, motivo: 'El XML no trae una firma con llave pública embebida' };
  }

  const certificado = await queries.buscarCertificadoPorLlavePublica(llavePublicaEnXml);
  if (!certificado) {
    return { esValida: false, motivo: 'La llave que firmó el documento no corresponde a ningún certificado emitido por el sistema' };
  }

  const resultado = crypto.validarFirma.validarFirmaXML(xmlFirmado, certificado.llave_publica);
  if (!resultado.esValida) {
    return resultado;
  }

  const contribuyente = await contribuyentesService.obtenerContribuyente(certificado.id_contribuyente);
  const hashDocumento = crypto.hash.calcularHashSHA256(xmlFirmado);
  const transaccion = await crypto.queries.buscarTransaccionFirmaPorHash(hashDocumento);

  return {
    esValida: true,
    signerId: contribuyente.identificacion,
    signerName: contribuyente.nombre_razon_social,
    algorithm: certificado.algoritmo,
    certificateStatus: certificado.estado,
    signatureDate: transaccion ? transaccion.fecha_hora : null,
  };
};

const listarCertificadosDeContribuyente = (idContribuyente) => {
  return certificateService.listarCertificadosDeContribuyente(idContribuyente);
};

const obtenerHistorialDeFirmas = (idContribuyente) => {
  return crypto.queries.obtenerTransaccionesFirmaPorContribuyente(idContribuyente);
};

const verificarPinDeContribuyente = async (idContribuyente, pin) => {
  const pinHash = await queries.obtenerPinHashPorId(idContribuyente);
  if (!pinHash) {
    const error = new Error('Contribuyente no encontrado');
    error.status = 404;
    throw error;
  }
  const valido = await crypto.pin.verificarPin(pin, pinHash);
  if (!valido) {
    const error = new Error('PIN incorrecto');
    error.status = 401;
    throw error;
  }
};

const cambiarPin = async ({ idContribuyente, currentPin, newPin }) => {
  if (!idContribuyente || !currentPin || !newPin) {
    const error = new Error('idContribuyente, currentPin y newPin son obligatorios');
    error.status = 400;
    throw error;
  }

  await verificarPinDeContribuyente(idContribuyente, currentPin);

  let nuevoHash;
  try {
    nuevoHash = await crypto.pin.hashearPin(newPin);
  } catch (err) {
    err.status = 400;
    throw err;
  }

  await queries.actualizarPinHash(idContribuyente, nuevoHash);
  return { success: true };
};

const cambiarPassword = async ({ idContribuyente, currentPassword, newPassword }) => {
  if (!idContribuyente || !currentPassword || !newPassword) {
    const error = new Error('idContribuyente, currentPassword y newPassword son obligatorios');
    error.status = 400;
    throw error;
  }
  if (newPassword.length < 8) {
    const error = new Error('La nueva contraseña debe tener al menos 8 caracteres');
    error.status = 400;
    throw error;
  }

  const passwordHash = await queries.obtenerPasswordHashPorId(idContribuyente);
  if (!passwordHash) {
    const error = new Error('Contribuyente no encontrado');
    error.status = 404;
    throw error;
  }

  const valido = await bcrypt.compare(currentPassword, passwordHash);
  if (!valido) {
    const error = new Error('Contraseña actual incorrecta');
    error.status = 401;
    throw error;
  }

  const nuevoHash = await bcrypt.hash(newPassword, 10);
  await queries.actualizarPasswordHash(idContribuyente, nuevoHash);
  return { success: true };
};

const renovarCertificado = async ({ idCertificado, idContribuyente, pin, motivo }) => {
  if (!idCertificado || !idContribuyente || !pin) {
    const error = new Error('idCertificado, idContribuyente y pin son obligatorios');
    error.status = 400;
    throw error;
  }
  await verificarPinDeContribuyente(idContribuyente, pin);
  return certificateService.renovarCertificado(idCertificado, motivo);
};

const revocarCertificado = async ({ idCertificado, idContribuyente, pin, motivo }) => {
  if (!idCertificado || !idContribuyente || !pin) {
    const error = new Error('idCertificado, idContribuyente y pin son obligatorios');
    error.status = 400;
    throw error;
  }
  await verificarPinDeContribuyente(idContribuyente, pin);
  return certificateService.revocarCertificado(idCertificado, motivo);
};

module.exports = {
  firmarDocumento,
  validarDocumento,
  listarCertificadosDeContribuyente,
  obtenerHistorialDeFirmas,
  cambiarPin,
  cambiarPassword,
  renovarCertificado,
  revocarCertificado,
};
