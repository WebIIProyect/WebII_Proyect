const express = require('express');
const router = express.Router();
const controller = require('./controller');
const wrap = require('../../utils/wrap');

/**
 * Módulo /api/certificados — Integrante 2 (Autoridad Certificadora / PKI).
 * Ciclo de vida completo del certificado digital: solicitud, emisión,
 * consulta, renovación, revocación y expiración. La emisión y la
 * renovación invocan internamente al módulo /crypto (Integrante 3) para
 * generar el par de llaves RSA y guardar la llave privada cifrada en la
 * bóveda — este módulo nunca ve la llave privada en claro.
 *
 * Máquina de estados (ver stateService.js para el detalle):
 *   Solicitud:   PENDIENTE → APROBADA | RECHAZADA
 *   Certificado: VIGENTE → RENOVADO | REVOCADO | EXPIRADO  (todos terminales)
 */

// ─── Solicitudes ─────────────────────────────────────────────────────────

/**
 * POST /api/certificados/solicitudes
 * Crea una solicitud de certificado para un contribuyente (queda PENDIENTE).
 * Body: { id_contribuyente: number, observaciones?: string }
 * Respuesta: 201 con la solicitud creada.
 */
router.post('/solicitudes', wrap(controller.solicitar));

/**
 * GET /api/certificados/solicitudes
 * Lista solicitudes de certificado.
 * Query opcional: ?id_contribuyente=<id> para filtrar por contribuyente.
 * Respuesta: 200, arreglo de solicitudes.
 */
router.get('/solicitudes', wrap(controller.listarSolicitudes));

/**
 * GET /api/certificados/solicitudes/:id
 * Obtiene una solicitud por su id_solicitud.
 * Respuesta: 200 con la solicitud, o 404 si no existe.
 */
router.get('/solicitudes/:id', wrap(controller.obtenerSolicitud));

/**
 * PATCH /api/certificados/solicitudes/:id/rechazar
 * Rechaza una solicitud PENDIENTE (transición PENDIENTE → RECHAZADA).
 * Body: { motivo: string }  (obligatorio)
 * Respuesta: 200 con la solicitud actualizada.
 * Errores: 400 (falta motivo), 409 (la solicitud ya no está PENDIENTE).
 */
router.patch('/solicitudes/:id/rechazar', wrap(controller.rechazarSolicitud));

/**
 * POST /api/certificados/solicitudes/:id/emitir
 * Aprueba una solicitud PENDIENTE y emite el certificado digital:
 * genera el par de llaves RSA-2048 (vía /crypto), guarda la llave privada
 * cifrada (AES-256-GCM) en la bóveda, y crea el certificado con vigencia
 * de 2 años. Transición de la solicitud: PENDIENTE → APROBADA.
 * Respuesta: 201 con el certificado creado (estado VIGENTE).
 * Errores: 409 si la solicitud ya no está PENDIENTE.
 */
router.post('/solicitudes/:id/emitir', wrap(controller.emitir));

// ─── Mantenimiento ───────────────────────────────────────────────────────

/**
 * POST /api/certificados/expirar-vencidos
 * Tarea de mantenimiento: recorre los certificados VIGENTE cuya
 * fecha_expiracion ya pasó y los marca EXPIRADO. Pensada para correrse
 * periódicamente (cron), pero se puede invocar manualmente.
 * Respuesta: 200 con { total_expirados, certificados }.
 */
router.post('/expirar-vencidos', wrap(controller.expirarVencidos));

// ─── Consulta ────────────────────────────────────────────────────────────

/**
 * GET /api/certificados/serial/:serial
 * Busca un certificado por su número de serie (numero_serie).
 * Respuesta: 200 con el certificado, o 404 si no existe.
 */
router.get('/serial/:serial', wrap(controller.obtenerPorSerial));

/**
 * GET /api/certificados
 * Lista certificados digitales.
 * Query opcional: ?id_contribuyente=<id> para filtrar por contribuyente.
 * Respuesta: 200, arreglo de certificados.
 */
router.get('/', wrap(controller.listar));

/**
 * GET /api/certificados/:id
 * Obtiene un certificado por su id_certificado.
 * Respuesta: 200 con el certificado, o 404 si no existe.
 */
router.get('/:id', wrap(controller.obtener));

/**
 * GET /api/certificados/:id/estado
 * Consulta el estado actual de un certificado. Si está VIGENTE pero su
 * fecha_expiracion ya pasó, lo expira automáticamente antes de responder.
 * Respuesta: 200 con { id_certificado, numero_serie, estado }.
 */
router.get('/:id/estado', wrap(controller.consultarEstado));

/**
 * GET /api/certificados/:id/historial
 * Historial de cambios de estado de un certificado (tabla historial_estados).
 * Respuesta: 200, arreglo de eventos (estado_anterior, estado_nuevo, motivo, fecha).
 */
router.get('/:id/historial', wrap(controller.historial));

// ─── Renovación y revocación ─────────────────────────────────────────────

/**
 * POST /api/certificados/:id/renovar
 * Renueva un certificado VIGENTE: genera un par de llaves RSA nuevo (vía
 * /crypto), emite un certificado nuevo (VIGENTE) y marca el anterior como
 * RENOVADO. Transición: VIGENTE → RENOVADO (del certificado anterior).
 * Body: { motivo?: string }
 * Respuesta: 201 con el certificado nuevo.
 * Errores: 409 si el certificado no está VIGENTE.
 * Nota: no valida el PIN del contribuyente — eso lo hace la capa de arriba
 * en /api/documentos/certificados/:id/renovar, que sí exige PIN antes de
 * llamar aquí.
 */
router.post('/:id/renovar', wrap(controller.renovar));

/**
 * PATCH /api/certificados/:id/revocar
 * Revoca un certificado VIGENTE de forma permanente e irreversible.
 * Transición: VIGENTE → REVOCADO.
 * Body: { motivo: string }  (obligatorio)
 * Respuesta: 200 con el certificado actualizado.
 * Errores: 400 (falta motivo), 409 (el certificado no está VIGENTE).
 * Nota: igual que /renovar, no valida PIN por sí solo — ver
 * /api/documentos/certificados/:id/revocar para la versión con PIN.
 */
router.patch('/:id/revocar', wrap(controller.revocar));

/**
 * PATCH /api/certificados/:id/expirar
 * Marca manualmente un certificado como EXPIRADO (transición VIGENTE →
 * EXPIRADO). Si ya está en un estado terminal, lo devuelve sin cambios.
 * Respuesta: 200 con el certificado actualizado.
 */
router.patch('/:id/expirar', wrap(controller.expirar));

module.exports = router;
