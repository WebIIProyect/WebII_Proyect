/**
 * index.js — módulo /crypto
 * Punto de entrada único del motor criptográfico (punto 7 del checklist).
 *
 * Este módulo NO tiene router.js ni controller.js (ver CLAUDE.md, sección 4):
 * no expone rutas HTTP propias. Quien lo consume (Integrante 4, desde /api)
 * lo hace con un solo import:
 *
 *   const crypto = require('../crypto'); // ajustar la ruta relativa real
 *   const { publicKey, privateKey } = crypto.rsa.generarParLlavesRSA();
 *
 * Está agrupado por archivo/responsabilidad (no aplanado) porque dos
 * archivos distintos tienen una función con el mismo nombre
 * (`guardarLlaveEnBoveda` existe tanto en `hsmService` como en `queries`,
 * con responsabilidades distintas) — aplanar todo en un solo objeto
 * causaría que uno pisara al otro.
 *
 * Ver `README.md` en esta misma carpeta para la guía de uso completa, con
 * los dos flujos (alta de certificado / solicitud de firma) resueltos paso
 * a paso.
 */

module.exports = {
  rsa: require('./rsaService.js'),
  hash: require('./hashService.js'),
  hsm: require('./hsmService.js'),
  firma: require('./firmaService.js'),
  validarFirma: require('./validarFirmaService.js'),
  pin: require('./pinService.js'),
  queries: require('./queries.js'),
};
