const express = require('express');
const router = express.Router();
const controller = require('./controller');
const wrap = require('../../utils/wrap');

router.post('/solicitudes', wrap(controller.solicitar));
router.get('/solicitudes', wrap(controller.listarSolicitudes));
router.get('/solicitudes/:id', wrap(controller.obtenerSolicitud));
router.patch('/solicitudes/:id/rechazar', wrap(controller.rechazarSolicitud));
router.post('/solicitudes/:id/emitir', wrap(controller.emitir));

router.post('/expirar-vencidos', wrap(controller.expirarVencidos));
router.get('/serial/:serial', wrap(controller.obtenerPorSerial));

router.get('/', wrap(controller.listar));
router.get('/:id', wrap(controller.obtener));
router.get('/:id/estado', wrap(controller.consultarEstado));
router.get('/:id/historial', wrap(controller.historial));
router.post('/:id/renovar', wrap(controller.renovar));
router.patch('/:id/revocar', wrap(controller.revocar));
router.patch('/:id/expirar', wrap(controller.expirar));

module.exports = router;