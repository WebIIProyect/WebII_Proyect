const express = require('express');
const router = express.Router();
const controller = require('./controller');

/**
 * Módulo /api/roles — Integrante 1 (Base de Datos y Contribuyentes).
 * Catálogo de roles del sistema (ADMINISTRADOR, CONTRIBUYENTE, ...). El
 * registro de contribuyentes (POST /api/contribuyentes) requiere un
 * id_rol válido, que se obtiene de aquí.
 */

/**
 * GET /api/roles
 * Lista todos los roles disponibles.
 * Respuesta: 200, arreglo de { id_rol, nombre_rol, descripcion, activo, fecha_creacion }.
 */
router.get('/', controller.listar);

/**
 * GET /api/roles/:id
 * Obtiene un rol por su id_rol.
 * Respuesta: 200 con el rol, o 404 si no existe.
 */
router.get('/:id', controller.obtener);

/**
 * POST /api/roles
 * Crea un rol nuevo.
 * Body: { nombre_rol: string, descripcion?: string }
 * Respuesta: 201 con el rol creado. Error: 400 si falta nombre_rol.
 */
router.post('/', controller.crear);

module.exports = router;
