const express = require('express');
const router = express.Router();
const controller = require('./controller');
const wrap = require('../../utils/wrap');

/**
 * Módulo /api/documentos — capa de integración que conecta /crypto
 * (Integrante 3) con /certificate (Integrante 2) y /contribuyentes
 * (Integrante 1) para exponer las operaciones que el frontend necesita
 * como endpoints HTTP: firmar, validar, y las acciones sensibles de la
 * cuenta (cambiar PIN/contraseña, renovar/revocar certificado) que exigen
 * el PIN de firma como autorización.
 */

/**
 * POST /api/documentos/firmar
 * Firma un XML de factura con la llave privada del contribuyente
 * (Flujo B del módulo /crypto): verifica el PIN, descifra la llave
 * temporalmente en memoria, firma con XMLDSig, destruye la llave de
 * memoria, y registra la transacción en transacciones_firma.
 * Body: { identificacion: string, pin: string, xmlFactura: string }
 * Respuesta: 200 con { success: true, xmlFirmado, hashDocumento, serialCertificado }.
 * Errores: 400 (faltan campos, o no hay certificado VIGENTE), 401 (PIN
 * incorrecto), 404 (no existe ese contribuyente).
 */
router.post('/firmar', wrap(controller.firmar));

/**
 * POST /api/documentos/validar
 * Valida la firma XMLDSig de un documento ya firmado: extrae la llave
 * pública embebida, la cruza contra los certificados emitidos por el
 * sistema (no confía en la llave que trae el propio XML) y valida la
 * firma contra la llave que sí consta en la base de datos.
 * Body: { xmlFirmado: string }
 * Respuesta: 200 con { esValida, signerId, signerName, algorithm,
 *   certificateStatus, signatureDate } si es válida, o
 *   { esValida: false, motivo } si no.
 */
router.post('/validar', wrap(controller.validar));

/**
 * GET /api/documentos/certificados/:idContribuyente
 * Lista los certificados digitales de un contribuyente (delega en
 * /api/certificados internamente). Usada por Mi Cuenta para mostrar el
 * certificado vigente.
 * Respuesta: 200, arreglo de certificados.
 */
router.get('/certificados/:idContribuyente', wrap(controller.certificadosDeContribuyente));

/**
 * GET /api/documentos/historial/:idContribuyente
 * Historial de operaciones de firma de un contribuyente (tabla
 * transacciones_firma de /crypto), más recientes primero.
 * Respuesta: 200, arreglo de { hash_documento, serial_certificado,
 *   resultado, detalle_error, fecha_hora }.
 */
router.get('/historial/:idContribuyente', wrap(controller.historialDeFirmas));

/**
 * PATCH /api/documentos/pin/:idContribuyente
 * Cambia el PIN de firma. Verifica el PIN actual, valida la política del
 * nuevo (8-16 car., mayúscula+minúscula+número+símbolo) y actualiza el hash.
 * Body: { currentPin: string, newPin: string }
 * Respuesta: 200 con { success: true }.
 * Errores: 400 (política de PIN inválida), 401 (PIN actual incorrecto).
 */
router.patch('/pin/:idContribuyente', wrap(controller.cambiarPin));

/**
 * PATCH /api/documentos/password/:idContribuyente
 * Cambia la contraseña de acceso (distinta del PIN de firma — es la que
 * usa POST /api/auth/login). Verifica la contraseña actual antes de
 * reemplazar el hash.
 * Body: { currentPassword: string, newPassword: string }  (newPassword: mín. 8 car.)
 * Respuesta: 200 con { success: true }.
 * Errores: 400 (contraseña nueva muy corta), 401 (contraseña actual incorrecta).
 */
router.patch('/password/:idContribuyente', wrap(controller.cambiarPassword));

/**
 * POST /api/documentos/certificados/:idCertificado/renovar
 * Renueva un certificado VIGENTE — igual que POST
 * /api/certificados/:id/renovar, pero exige el PIN del contribuyente
 * antes de autorizar la operación (genera un par de llaves RSA nuevo).
 * Body: { idContribuyente: number, pin: string, motivo?: string }
 * Respuesta: 201 con el certificado nuevo.
 * Errores: 401 (PIN incorrecto), 409 (el certificado no está VIGENTE).
 */
router.post('/certificados/:idCertificado/renovar', wrap(controller.renovarCertificado));

/**
 * POST /api/documentos/certificados/:idCertificado/revocar
 * Revoca un certificado VIGENTE — igual que PATCH
 * /api/certificados/:id/revocar, pero exige el PIN del contribuyente
 * antes de autorizar la operación irreversible.
 * Body: { idContribuyente: number, pin: string, motivo: string }
 * Respuesta: 200 con el certificado actualizado.
 * Errores: 401 (PIN incorrecto), 409 (el certificado no está VIGENTE).
 */
router.post('/certificados/:idCertificado/revocar', wrap(controller.revocarCertificado));

module.exports = router;
