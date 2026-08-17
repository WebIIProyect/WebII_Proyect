require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

// Rutas del módulo de contribuyentes
const contribuyentesRouter = require('./modules/contribuyentes/router');
app.use('/api/contribuyentes', contribuyentesRouter);
app.use('/api/recuperacion-pin', require('./modules/recuperacion_pin/router'));
app.use('/api/roles', require('./modules/roles/router'));

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ mensaje: 'API de Firma Digital y Contribuyentes funcionando' });
});

// Middleware centralizado de manejo de errores
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});