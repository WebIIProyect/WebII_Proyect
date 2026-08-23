
 //Punto de entrada único del motor criptográfico

module.exports = {
  rsa: require('./rsaService.js'),
  hash: require('./hashService.js'),
  hsm: require('./hsmService.js'),
  firma: require('./firmaService.js'),
  validarFirma: require('./validarFirmaService.js'),
  pin: require('./pinService.js'),
  queries: require('./queries.js'),
};
