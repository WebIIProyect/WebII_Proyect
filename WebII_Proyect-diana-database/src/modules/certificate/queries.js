const pool = require('../../config/db');

// ─── Solicitudes_Certificado ────────────────────────────────────────────

const crearSolicitud = ({ id_contribuyente, observaciones }) => {
  return pool.query(
    `INSERT INTO solicitudes_certificado (id_contribuyente, observaciones)
     VALUES ($1, $2)
     RETURNING *`,
    [id_contribuyente, observaciones || null]
  );
};

const listarSolicitudes = () => {
  return pool.query(
    `SELECT * FROM solicitudes_certificado ORDER BY fecha_solicitud DESC`
  );
};

const obtenerSolicitudPorId = (id_solicitud) => {
  return pool.query(
    `SELECT * FROM solicitudes_certificado WHERE id_solicitud = $1`,
    [id_solicitud]
  );
};

const listarSolicitudesPorContribuyente = (id_contribuyente) => {
  return pool.query(
    `SELECT * FROM solicitudes_certificado
     WHERE id_contribuyente = $1
     ORDER BY fecha_solicitud DESC`,
    [id_contribuyente]
  );
};

const resolverSolicitud = (id_solicitud, estado, observaciones) => {
  return pool.query(
    `UPDATE solicitudes_certificado
     SET estado = $1, observaciones = COALESCE($2, observaciones), fecha_resolucion = NOW()
     WHERE id_solicitud = $3
     RETURNING *`,
    [estado, observaciones || null, id_solicitud]
  );
};

// ─── Certificados_Digitales ─────────────────────────────────────────────

const crearCertificado = ({
  id_contribuyente,
  id_solicitud,
  numero_serie,
  llave_publica,
  algoritmo,
  fecha_expiracion,
}) => {
  return pool.query(
    `INSERT INTO certificados_digitales
       (id_contribuyente, id_solicitud, numero_serie, llave_publica, algoritmo, fecha_expiracion)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id_contribuyente, id_solicitud || null, numero_serie, llave_publica, algoritmo, fecha_expiracion]
  );
};

const listarCertificados = () => {
  return pool.query(
    `SELECT * FROM certificados_digitales ORDER BY fecha_emision DESC`
  );
};

const obtenerCertificadoPorId = (id_certificado) => {
  return pool.query(
    `SELECT * FROM certificados_digitales WHERE id_certificado = $1`,
    [id_certificado]
  );
};

const obtenerCertificadoPorSerial = (numero_serie) => {
  return pool.query(
    `SELECT * FROM certificados_digitales WHERE numero_serie = $1`,
    [numero_serie]
  );
};

const listarCertificadosPorContribuyente = (id_contribuyente) => {
  return pool.query(
    `SELECT * FROM certificados_digitales
     WHERE id_contribuyente = $1
     ORDER BY fecha_emision DESC`,
    [id_contribuyente]
  );
};

const listarCertificadosVigentesExpirados = (fechaCorte) => {
  return pool.query(
    `SELECT * FROM certificados_digitales
     WHERE estado = 'VIGENTE' AND fecha_expiracion < $1`,
    [fechaCorte]
  );
};

const cambiarEstadoCertificado = (id_certificado, estado) => {
  return pool.query(
    `UPDATE certificados_digitales
     SET estado = $1, fecha_actualizacion = NOW()
     WHERE id_certificado = $2
     RETURNING *`,
    [estado, id_certificado]
  );
};

// ─── Renovaciones ────────────────────────────────────────────────────────

const crearRenovacion = ({ id_certificado_anterior, id_certificado_nuevo, motivo }) => {
  return pool.query(
    `INSERT INTO renovaciones (id_certificado_anterior, id_certificado_nuevo, motivo)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [id_certificado_anterior, id_certificado_nuevo, motivo || null]
  );
};

const listarRenovacionesPorCertificado = (id_certificado) => {
  return pool.query(
    `SELECT * FROM renovaciones
     WHERE id_certificado_anterior = $1 OR id_certificado_nuevo = $1
     ORDER BY fecha_renovacion DESC`,
    [id_certificado]
  );
};

// ─── Revocaciones ────────────────────────────────────────────────────────

const crearRevocacion = ({ id_certificado, motivo }) => {
  return pool.query(
    `INSERT INTO revocaciones (id_certificado, motivo)
     VALUES ($1, $2)
     RETURNING *`,
    [id_certificado, motivo]
  );
};

const obtenerRevocacionPorCertificado = (id_certificado) => {
  return pool.query(
    `SELECT * FROM revocaciones WHERE id_certificado = $1`,
    [id_certificado]
  );
};

// ─── Historial_Estados ───────────────────────────────────────────────────

const registrarCambioEstado = ({ id_certificado, estado_anterior, estado_nuevo, motivo }) => {
  return pool.query(
    `INSERT INTO historial_estados (id_certificado, estado_anterior, estado_nuevo, motivo)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [id_certificado, estado_anterior || null, estado_nuevo, motivo || null]
  );
};

const listarHistorialPorCertificado = (id_certificado) => {
  return pool.query(
    `SELECT * FROM historial_estados
     WHERE id_certificado = $1
     ORDER BY fecha_cambio ASC`,
    [id_certificado]
  );
};

module.exports = {
  crearSolicitud,
  listarSolicitudes,
  obtenerSolicitudPorId,
  listarSolicitudesPorContribuyente,
  resolverSolicitud,
  crearCertificado,
  listarCertificados,
  obtenerCertificadoPorId,
  obtenerCertificadoPorSerial,
  listarCertificadosPorContribuyente,
  listarCertificadosVigentesExpirados,
  cambiarEstadoCertificado,
  crearRenovacion,
  listarRenovacionesPorCertificado,
  crearRevocacion,
  obtenerRevocacionPorCertificado,
  registrarCambioEstado,
  listarHistorialPorCertificado,
};