module.exports = function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} —`, err.message);
  if (err.code === '23505') return res.status(409).json({ error: 'Already exists' });
  if (err.code === '23503') return res.status(400).json({ error: 'Referenced record not found' });
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Internal server error' });
};
