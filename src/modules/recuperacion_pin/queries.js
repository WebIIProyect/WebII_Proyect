const pool = require('../../config/db');

async function buscarPorIdentificacion(identificacion) {
  const { rows } = await pool.query(
    `SELECT id_contribuyente, identificacion, correo
     FROM contribuyentes
     WHERE identificacion = $1`,
    [identificacion]
  );
  return rows[0];
}

async function crearSolicitud(id_contribuyente, token, fecha_expiracion, ip_solicitud) {
  const { rows } = await pool.query(
    `INSERT INTO recuperacion_pin (id_contribuyente, token_recuperacion, fecha_expiracion, ip_solicitud)
     VALUES ($1, $2, $3, $4)
     RETURNING id_recuperacion, token_recuperacion, fecha_expiracion`,
    [id_contribuyente, token, fecha_expiracion, ip_solicitud]
  );
  return rows[0];
}

async function buscarTokenValido(token) {
  const { rows } = await pool.query(
    `SELECT * FROM recuperacion_pin
     WHERE token_recuperacion = $1 AND usado = FALSE AND fecha_expiracion > NOW()`,
    [token]
  );
  return rows[0];
}

async function marcarUsado(id_recuperacion) {
  await pool.query(
    `UPDATE recuperacion_pin SET usado = TRUE WHERE id_recuperacion = $1`,
    [id_recuperacion]
  );
}

async function actualizarPin(id_contribuyente, pin_hash) {
  await pool.query(
    `UPDATE contribuyentes SET pin_hash = $1, fecha_actualizacion = NOW() WHERE id_contribuyente = $2`,
    [pin_hash, id_contribuyente]
  );
}

module.exports = {
  buscarPorIdentificacion,
  crearSolicitud,
  buscarTokenValido,
  marcarUsado,
  actualizarPin
};