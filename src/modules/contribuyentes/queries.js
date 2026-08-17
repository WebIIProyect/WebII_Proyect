const pool = require('../../config/db');

const listar = () => {
  return pool.query(
    `SELECT id_contribuyente, tipo_contribuyente, identificacion, nombre_razon_social,
            correo, telefono, direccion, actividad_economica, estado, fecha_registro
     FROM contribuyentes
     ORDER BY fecha_registro DESC`
  );
};

const obtenerPorId = (id) => {
  return pool.query(
    `SELECT id_contribuyente, tipo_contribuyente, identificacion, nombre_razon_social,
            correo, telefono, direccion, actividad_economica, estado, fecha_registro
     FROM contribuyentes WHERE id_contribuyente = $1`,
    [id]
  );
};

const obtenerPorIdentificacion = (identificacion) => {
  return pool.query(
    `SELECT * FROM contribuyentes WHERE identificacion = $1`,
    [identificacion]
  );
};

const crear = ({ tipo_contribuyente, identificacion, nombre_razon_social, correo,
                 telefono, direccion, actividad_economica, pin_hash, id_rol }) => {
  return pool.query(
    `INSERT INTO contribuyentes
       (tipo_contribuyente, identificacion, nombre_razon_social, correo, telefono,
        direccion, actividad_economica, pin_hash, id_rol)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id_contribuyente, tipo_contribuyente, identificacion, nombre_razon_social,
               correo, estado, fecha_registro`,
    [tipo_contribuyente, identificacion, nombre_razon_social, correo, telefono,
     direccion, actividad_economica, pin_hash, id_rol]
  );
};

const actualizar = (id, { nombre_razon_social, correo, telefono, direccion, actividad_economica }) => {
  return pool.query(
    `UPDATE contribuyentes
     SET nombre_razon_social = $1, correo = $2, telefono = $3,
         direccion = $4, actividad_economica = $5, fecha_actualizacion = NOW()
     WHERE id_contribuyente = $6
     RETURNING id_contribuyente, nombre_razon_social, correo, telefono, direccion, actividad_economica`,
    [nombre_razon_social, correo, telefono, direccion, actividad_economica, id]
  );
};

const cambiarEstado = (id, estado) => {
  return pool.query(
    `UPDATE contribuyentes SET estado = $1, fecha_actualizacion = NOW()
     WHERE id_contribuyente = $2 RETURNING id_contribuyente, estado`,
    [estado, id]
  );
};

module.exports = { listar, obtenerPorId, obtenerPorIdentificacion, crear, actualizar, cambiarEstado };