const service = require('./service');

const firmar = async (req, res) => {
  const resultado = await service.firmarDocumento(req.body);
  res.json({ success: true, ...resultado });
};

const validar = async (req, res) => {
  const resultado = await service.validarDocumento(req.body);
  res.json(resultado);
};

const certificadosDeContribuyente = async (req, res) => {
  const certificados = await service.listarCertificadosDeContribuyente(req.params.idContribuyente);
  res.json(certificados);
};

const historialDeFirmas = async (req, res) => {
  const historial = await service.obtenerHistorialDeFirmas(req.params.idContribuyente);
  res.json(historial);
};

const cambiarPin = async (req, res) => {
  const resultado = await service.cambiarPin({
    idContribuyente: req.params.idContribuyente,
    currentPin: req.body.currentPin,
    newPin: req.body.newPin,
  });
  res.json(resultado);
};

const cambiarPassword = async (req, res) => {
  const resultado = await service.cambiarPassword({
    idContribuyente: req.params.idContribuyente,
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword,
  });
  res.json(resultado);
};

const renovarCertificado = async (req, res) => {
  const certificado = await service.renovarCertificado({
    idCertificado: req.params.idCertificado,
    idContribuyente: req.body.idContribuyente,
    pin: req.body.pin,
    motivo: req.body.motivo,
  });
  res.status(201).json(certificado);
};

const revocarCertificado = async (req, res) => {
  const certificado = await service.revocarCertificado({
    idCertificado: req.params.idCertificado,
    idContribuyente: req.body.idContribuyente,
    pin: req.body.pin,
    motivo: req.body.motivo,
  });
  res.json(certificado);
};

module.exports = {
  firmar,
  validar,
  certificadosDeContribuyente,
  historialDeFirmas,
  cambiarPin,
  cambiarPassword,
  renovarCertificado,
  revocarCertificado,
};
