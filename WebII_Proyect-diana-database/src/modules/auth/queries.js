const pool = require('../../config/db');

const obtenerContribuyentePorCorreo = (correo) => {
  return pool.query(
    `SELECT * FROM contribuyentes WHERE correo = $1`,
    [correo]
  );
};

module.exports = { obtenerContribuyentePorCorreo };
