const service = require('./service');

const listar = async (req, res) => {
  const contribuyentes = await service.listarContribuyentes();
  res.json(contribuyentes);
};

const obtener = async (req, res) => {
  const contribuyente = await service.obtenerContribuyente(req.params.id);
  res.json(contribuyente);
};

const registrar = async (req, res) => {
  const nuevo = await service.registrarContribuyente(req.body);
  res.status(201).json(nuevo);
};

const editar = async (req, res) => {
  const actualizado = await service.editarContribuyente(req.params.id, req.body);
  res.json(actualizado);
};

const cambiarEstado = async (req, res) => {
  const actualizado = await service.cambiarEstadoContribuyente(req.params.id, req.body.estado);
  res.json(actualizado);
};

module.exports = { listar, obtener, registrar, editar, cambiarEstado };