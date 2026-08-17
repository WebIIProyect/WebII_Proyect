const bcrypt = require('bcrypt');
const queries = require('./queries');

const TIPOS_VALIDOS = ['FISICO', 'JURIDICO'];
const ESTADOS_VALIDOS = ['PENDIENTE', 'ACTIVO', 'SUSPENDIDO', 'RECHAZADO'];

const listarContribuyentes = async () => {
  const { rows } = await queries.listar();
  return rows;
};

const obtenerContribuyente = async (id) => {
  const { rows } = await queries.obtenerPorId(id);
  if (rows.length === 0) {
    const error = new Error('Contribuyente no encontrado');
    error.status = 404;
    throw error;
  }
  return rows[0];
};

const registrarContribuyente = async (datos) => {
  const { tipo_contribuyente, identificacion, nombre_razon_social, correo, pin, id_rol } = datos;

  if (!TIPOS_VALIDOS.includes(tipo_contribuyente)) {
    const error = new Error('tipo_contribuyente debe ser FISICO o JURIDICO');
    error.status = 400;
    throw error;
  }
  if (!identificacion || !nombre_razon_social || !correo || !pin || !id_rol) {
    const error = new Error('Faltan campos obligatorios');
    error.status = 400;
    throw error;
  }

  const existente = await queries.obtenerPorIdentificacion(identificacion);
  if (existente.rows.length > 0) {
    const error = new Error('Ya existe un contribuyente con esa identificación');
    error.status = 409;
    throw error;
  }

  const pin_hash = await bcrypt.hash(pin, 10);

  const { rows } = await queries.crear({ ...datos, pin_hash });
  return rows[0];
};

const editarContribuyente = async (id, datos) => {
  await obtenerContribuyente(id); // valida que exista, lanza 404 si no
  const { rows } = await queries.actualizar(id, datos);
  return rows[0];
};

const cambiarEstadoContribuyente = async (id, estado) => {
  if (!ESTADOS_VALIDOS.includes(estado)) {
    const error = new Error('Estado inválido');
    error.status = 400;
    throw error;
  }
  await obtenerContribuyente(id);
  const { rows } = await queries.cambiarEstado(id, estado);
  return rows[0];
};

module.exports = {
  listarContribuyentes,
  obtenerContribuyente,
  registrarContribuyente,
  editarContribuyente,
  cambiarEstadoContribuyente,
};