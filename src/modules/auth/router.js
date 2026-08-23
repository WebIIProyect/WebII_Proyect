const express = require('express');
const router = express.Router();
const controller = require('./controller');
const wrap = require('../../utils/wrap');

/**
 * Módulo /api/auth — sesión de acceso de contribuyentes (integración
 * frontend/backend). No confundir con el PIN de firma (/crypto): esto
 * autentica la CONTRASEÑA de acceso y entrega un JWT para la sesión del
 * portal; el PIN sigue siendo obligatorio, aparte, para firmar documentos.
 */

/**
 * POST /api/auth/login
 * Inicia sesión con correo + contraseña de acceso.
 * Body: { correo: string, password: string }
 * Respuesta: 200 con { success: true, token, contribuyente: {...} }
 *   (token JWT válido 2h; contribuyente sin hashes de pin/password).
 * Errores: 401 (credenciales inválidas), 403 (cuenta no está ACTIVO
 * — ver PATCH /api/contribuyentes/:id/estado).
 */
router.post('/login', wrap(controller.login));

module.exports = router;
