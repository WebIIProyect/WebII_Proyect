const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// 1. Ruta específica para servir el CSS desde la raíz
app.get('/styles.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'styles.css'));
});

// 2. Permitir que Express lea la carpeta "multimedia" para las imágenes
app.use('/multimedia', express.static(path.join(__dirname, 'multimedia')));

// 3. Permitir que Express lea el resto de archivos estáticos desde "pages"
app.use(express.static(path.join(__dirname, 'pages')));

// 4. Ruta principal (Carga el index.html desde la carpeta pages)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'index.html'));
});

// 5. Ruta dinámica para tus demás páginas HTML
app.get('/:page', (req, res, next) => {
    let page = req.params.page;
    if (!page.endsWith('.html')) {
        page += '.html';
    }
    
    const filePath = path.join(__dirname, 'pages', page);
    res.sendFile(filePath, (err) => {
        if (err) {
            next(); // Si no existe, continúa a la siguiente ruta
        }
    });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});