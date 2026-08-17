const express = require('express');
const router = express.Router();
const controller = require('./controller');
const wrap = require('../../utils/wrap');

router.get('/', wrap(controller.listar));


router.get('/:id', wrap(controller.obtener));

router.post('/', wrap(controller.registrar));


router.put('/:id', wrap(controller.editar));


router.patch('/:id/estado', wrap(controller.cambiarEstado));

module.exports = router;