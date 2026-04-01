require('dotenv').config();
const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const path      = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

// Rate limiting
app.use('/api/auth',      rateLimit({ windowMs:15*60*1000, max:30,  message:{ error:'Too many attempts, try again later' } }));
app.use('/api/search/ai', rateLimit({ windowMs:60*1000,    max:10,  message:{ error:'AI search rate limit exceeded' } }));
app.use('/api',           rateLimit({ windowMs:60*1000,    max:300, message:{ error:'Too many requests' } }));

app.use(express.json({ limit:'10kb' }));

// ── API routes (must come BEFORE static/catch-all) ──
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/search',   require('./routes/search'));

// Catch-all for unknown /api/* routes — return JSON, not HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

app.get('/health', (_, res) => res.json({ ok:true, ts: new Date().toISOString() }));

// ── Serve frontend (SPA) ──
const FRONTEND = path.join(__dirname, '../../frontend');
app.use(express.static(FRONTEND));
app.get('*', (_, res) => res.sendFile(path.join(FRONTEND, 'index.html')));

// ── Global error handler (must be last) ──
app.use(require('./middleware/errorHandler'));

app.listen(PORT, () => {
  console.log(`\n🛍️  NUVÉ running → http://localhost:${PORT}`);
  console.log(`   Env: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;