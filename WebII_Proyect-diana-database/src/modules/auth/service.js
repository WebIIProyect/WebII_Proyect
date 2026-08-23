const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const queries = require('./queries');

const login = async ({ correo, password }) => {
  if (!correo || !password) {
    const error = new Error('correo y password son obligatorios');
    error.status = 400;
    throw error;
  }

  const { rows } = await queries.obtenerContribuyentePorCorreo(correo);
  const contribuyente = rows[0];

  if (!contribuyente || !contribuyente.password_hash) {
    const error = new Error('Credenciales inválidas');
    error.status = 401;
    throw error;
  }

  if (contribuyente.estado !== 'ACTIVO') {
    const error = new Error(`Cuenta en estado ${contribuyente.estado}, no puede iniciar sesión`);
    error.status = 403;
    throw error;
  }

  const passwordValida = await bcrypt.compare(password, contribuyente.password_hash);
  if (!passwordValida) {
    const error = new Error('Credenciales inválidas');
    error.status = 401;
    throw error;
  }

  const token = jwt.sign(
    {
      id_contribuyente: contribuyente.id_contribuyente,
      correo: contribuyente.correo,
      id_rol: contribuyente.id_rol,
    },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  return {
    token,
    contribuyente: {
      id_contribuyente: contribuyente.id_contribuyente,
      tipo_contribuyente: contribuyente.tipo_contribuyente,
      identificacion: contribuyente.identificacion,
      nombre_razon_social: contribuyente.nombre_razon_social,
      correo: contribuyente.correo,
      estado: contribuyente.estado,
    },
  };
};

module.exports = { login };
