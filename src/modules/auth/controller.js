const service = require('./service');

const login = async (req, res) => {
  const resultado = await service.login(req.body);
  res.json({ success: true, ...resultado });
};

module.exports = { login };
