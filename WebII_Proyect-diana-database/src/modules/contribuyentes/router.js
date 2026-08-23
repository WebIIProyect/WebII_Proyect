const express = require('express');
const router = express.Router();
const controller = require('./controller');
const wrap = require('../../utils/wrap');

/**
 * Módulo /api/contribuyentes — Integrante 1 (Base de Datos y Contribuyentes).
 * CRUD de contribuyentes: registro, consulta, edición de datos y cambio de
 * estado (aprobación/suspensión). No maneja PIN ni contraseña más allá de
 * hashearlos al registrar — la verificación de PIN vive en /crypto y el
 * login en /api/auth.
 */

/**
 * GET /api/contribuyentes
 * Lista todos los contribuyentes registrados.
 * Respuesta: 200, arreglo de contribuyentes (sin pin_hash ni password_hash).
 */
router.get('/', wrap(controller.listar));

/**
 * GET /api/contribuyentes/:id
 * Obtiene un contribuyente por su id_contribuyente.
 * Respuesta: 200 con el contribuyente, o 404 si no existe.
 */
router.get('/:id', wrap(controller.obtener));

/**
 * POST /api/contribuyentes
 * Registra un nuevo contribuyente. Queda en estado PENDIENTE hasta que se
 * apruebe manualmente (no hay panel de administrador todavía — se aprueba
 * con PATCH /:id/estado).
 * Body: {
 *   tipo_contribuyente: 'FISICO' | 'JURIDICO',
 *   identificacion: string,
 *   nombre_razon_social: string,
 *   correo: string,
 *   pin: string,       // 8-16 car., mayúscula+minúscula+número+símbolo
 *   password: string,
 *   id_rol: number,    // ver GET /api/roles
 *   telefono?: string, direccion?: string, actividad_economica?: string
 * }
 * Respuesta: 201 con el contribuyente creado (estado PENDIENTE).
 * Errores: 400 (campos faltantes/PIN inválido), 409 (identificación duplicada).
 */
router.post('/', wrap(controller.registrar));

/**
 * PUT /api/contribuyentes/:id
 * Edita los datos de perfil de un contribuyente (no toca pin ni password).
 * Body: { nombre_razon_social, correo, telefono, direccion, actividad_economica }
 * Respuesta: 200 con el contribuyente actualizado, o 404 si no existe.
 */
router.put('/:id', wrap(controller.editar));

/**
 * PATCH /api/contribuyentes/:id/estado
 * Cambia el estado del contribuyente (aprobar/suspender/rechazar cuenta).
 * Body: { estado: 'PENDIENTE' | 'ACTIVO' | 'SUSPENDIDO' | 'RECHAZADO' }
 * Respuesta: 200 con { id_contribuyente, estado }.
 * Nota: un contribuyente debe estar ACTIVO para poder iniciar sesión
 * (ver POST /api/auth/login).
 */
router.patch('/:id/estado', wrap(controller.cambiarEstado));

module.exports = router;
