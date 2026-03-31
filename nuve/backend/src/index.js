require('dotenv').config();
const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const path      = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

app.use('/api/auth',      rateLimit({ windowMs:15*60*1000, max:30 }));
app.use('/api/search/ai', rateLimit({ windowMs:60*1000,    max:10 }));
app.use('/api',           rateLimit({ windowMs:60*1000,    max:300 }));

app.use(express.json({ limit:'10kb' }));

// API routes
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/search',   require('./routes/search'));

app.get('/health', (_, res) => res.json({ ok:true, ts: new Date().toISOString() }));

// Serve frontend (SPA)
const FRONTEND = path.join(__dirname, '../../frontend');
app.use(express.static(FRONTEND));
app.get('*', (_, res) => res.sendFile(path.join(FRONTEND, 'index.html')));

app.use(require('./middleware/errorHandler'));

app.listen(PORT, () => {
  console.log(`\n🛍️  NUVÉ running → http://localhost:${PORT}`);
  console.log(`   Env: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
