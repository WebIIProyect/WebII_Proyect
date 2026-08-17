const express = require('express');
const router = express.Router();
const controller = require('./controller');

router.post('/', controller.solicitar);
router.post('/confirmar', controller.confirmar);

module.exports = router;