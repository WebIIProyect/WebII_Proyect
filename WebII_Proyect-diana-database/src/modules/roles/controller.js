const queries = require('./queries');
const wrap = require('../../utils/wrap');

const listar = wrap(async (req, res) => {
  const roles = await queries.listar();
  res.json(roles);
});

const obtener = wrap(async (req, res) => {
  const rol = await queries.obtenerPorId(req.params.id);
  if (!rol) {
    return res.status(404).json({ error: 'Rol no encontrado' });
  }
  res.json(rol);
});

const crear = wrap(async (req, res) => {
  const { nombre_rol, descripcion } = req.body;
  if (!nombre_rol) {
    return res.status(400).json({ error: 'nombre_rol es requerido' });
  }
  const rol = await queries.crear(nombre_rol, descripcion);
  res.status(201).json(rol);
});

module.exports = { listar, obtener, crear };