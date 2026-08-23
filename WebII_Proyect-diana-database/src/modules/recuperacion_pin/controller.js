const service = require('./service');
const wrap = require('../../utils/wrap');

const solicitar = wrap(async (req, res) => {
  const { identificacion } = req.body;
  const ip_solicitud = req.ip;
  const solicitud = await service.solicitarRecuperacion(identificacion, ip_solicitud);
  res.status(201).json(solicitud);
});

const confirmar = wrap(async (req, res) => {
  const { token, nuevo_pin } = req.body;
  const resultado = await service.confirmarRecuperacion(token, nuevo_pin);
  res.status(200).json(resultado);
});

module.exports = { solicitar, confirmar };