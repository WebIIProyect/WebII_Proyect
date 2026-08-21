const service = require('./service');

const solicitar = async (req, res) => {
  const solicitud = await service.solicitarCertificado(req.body.id_contribuyente, req.body.observaciones);
  res.status(201).json(solicitud);
};

const listarSolicitudes = async (req, res) => {
  if (req.query.id_contribuyente) {
    const solicitudes = await service.listarSolicitudesDeContribuyente(req.query.id_contribuyente);
    return res.json(solicitudes);
  }
  const solicitudes = await service.listarSolicitudes();
  res.json(solicitudes);
};

const obtenerSolicitud = async (req, res) => {
  const solicitud = await service.obtenerSolicitud(req.params.id);
  res.json(solicitud);
};

const rechazarSolicitud = async (req, res) => {
  const solicitud = await service.rechazarSolicitud(req.params.id, req.body.motivo);
  res.json(solicitud);
};

const emitir = async (req, res) => {
  const certificado = await service.emitirCertificado(req.params.id);
  res.status(201).json(certificado);
};

const listar = async (req, res) => {
  if (req.query.id_contribuyente) {
    const certificados = await service.listarCertificadosDeContribuyente(req.query.id_contribuyente);
    return res.json(certificados);
  }
  const certificados = await service.listarCertificados();
  res.json(certificados);
};

const obtener = async (req, res) => {
  const certificado = await service.obtenerCertificado(req.params.id);
  res.json(certificado);
};

const obtenerPorSerial = async (req, res) => {
  const certificado = await service.obtenerCertificadoPorSerial(req.params.serial);
  res.json(certificado);
};

const consultarEstado = async (req, res) => {
  const certificado = await service.consultarEstado(req.params.id);
  res.json({ id_certificado: certificado.id_certificado, numero_serie: certificado.numero_serie, estado: certificado.estado });
};

const historial = async (req, res) => {
  const eventos = await service.listarHistorial(req.params.id);
  res.json(eventos);
};

const renovar = async (req, res) => {
  const nuevo = await service.renovarCertificado(req.params.id, req.body.motivo);
  res.status(201).json(nuevo);
};

const revocar = async (req, res) => {
  const certificado = await service.revocarCertificado(req.params.id, req.body.motivo);
  res.json(certificado);
};

const expirar = async (req, res) => {
  const certificado = await service.expirarCertificado(req.params.id);
  res.json(certificado);
};

const expirarVencidos = async (req, res) => {
  const expirados = await service.expirarCertificadosVencidos();
  res.json({ total_expirados: expirados.length, certificados: expirados });
};

module.exports = {
  solicitar,
  listarSolicitudes,
  obtenerSolicitud,
  rechazarSolicitud,
  emitir,
  listar,
  obtener,
  obtenerPorSerial,
  consultarEstado,
  historial,
  renovar,
  revocar,
  expirar,
  expirarVencidos,
};