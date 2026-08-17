const express = require('express');
const router = express.Router();
const controller = require('./controller');

router.get('/', controller.listar);
router.get('/:id', controller.obtener);
router.post('/', controller.crear);

module.exports = router;