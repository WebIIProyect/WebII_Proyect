require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

const ROOT_DIR = path.join(__dirname, '..');

// Límite por defecto de Express (100kb) es insuficiente para el XML de una
// factura electrónica firmada; se sube a un tamaño razonable para documentos.
app.use(express.json({ limit: '10mb' }));

// Archivos estáticos del frontend (pages/, multimedia/, styles.css)
app.use(express.static(path.join(ROOT_DIR, 'pages')));
app.use('/multimedia', express.static(path.join(ROOT_DIR, 'multimedia')));
app.get('/styles.css', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'styles.css'));
});

// Rutas del módulo de contribuyentes
const contribuyentesRouter = require('./modules/contribuyentes/router');
app.use('/api/contribuyentes', contribuyentesRouter);
app.use('/api/recuperacion-pin', require('./modules/recuperacion_pin/router'));
app.use('/api/roles', require('./modules/roles/router'));
app.use('/api/certificados', require('./modules/certificate/router'));
app.use('/api/auth', require('./modules/auth/router'));
app.use('/api/documentos', require('./modules/documentos/router'));

// Fallback: cualquier otra ruta que no sea /api/* intenta resolverse como página HTML
app.get('/:page', (req, res, next) => {
  if (req.params.page.startsWith('api')) return next();
  let page = req.params.page;
  if (!page.endsWith('.html')) page += '.html';
  res.sendFile(path.join(ROOT_DIR, 'pages', page), (err) => {
    if (err) next();
  });
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