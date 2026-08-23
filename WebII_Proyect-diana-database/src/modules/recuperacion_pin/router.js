const express = require('express');
const router = express.Router();
const controller = require('./controller');

/**
 * Módulo /api/recuperacion-pin — Integrante 1 (Base de Datos y Contribuyentes).
 * Flujo de recuperación de PIN de firma vía token temporal (15 minutos de
 * validez). En un sistema real el token se envía por correo; aquí se
 * devuelve directo en la respuesta para poder probarlo sin servicio de mail.
 */

/**
 * POST /api/recuperacion-pin
 * Inicia una solicitud de recuperación para un contribuyente existente.
 * Body: { identificacion: string }
 * Respuesta: 201 con { id_recuperacion, token, fecha_expiracion, ... }.
 * Errores: 400 (falta identificacion), 404 (no existe ese contribuyente).
 */
router.post('/', controller.solicitar);

/**
 * POST /api/recuperacion-pin/confirmar
 * Confirma la recuperación con el token recibido y define el PIN nuevo.
 * Body: { token: string, nuevo_pin: string }
 * Respuesta: 200 con { mensaje: 'PIN actualizado correctamente' }.
 * Errores: 400 (faltan campos, o token inválido/expirado/ya usado).
 */
router.post('/confirmar', controller.confirmar);

module.exports = router;
