const pool = require('../../config/db');

async function listar() {
  const { rows } = await pool.query(
    `SELECT id_rol, nombre_rol, descripcion, activo, fecha_creacion FROM roles ORDER BY id_rol`
  );
  return rows;
}

async function obtenerPorId(id_rol) {
  const { rows } = await pool.query(
    `SELECT id_rol, nombre_rol, descripcion, activo, fecha_creacion FROM roles WHERE id_rol = $1`,
    [id_rol]
  );
  return rows[0];
}

async function crear(nombre_rol, descripcion) {
  const { rows } = await pool.query(
    `INSERT INTO roles (nombre_rol, descripcion)
     VALUES ($1, $2)
     RETURNING id_rol, nombre_rol, descripcion, activo, fecha_creacion`,
    [nombre_rol, descripcion]
  );
  return rows[0];
}

module.exports = { listar, obtenerPorId, crear };