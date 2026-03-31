const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const sign = u => jwt.sign(
  { id: u.id, email: u.email, role: u.role, name: u.name },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password min 8 chars' });
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      `INSERT INTO users (name,email,password) VALUES ($1,$2,$3)
       RETURNING id,name,email,role,created_at`,
      [name.trim(), email.toLowerCase().trim(), hash]
    );
    res.status(201).json({ user: rows[0], token: sign(rows[0]) });
  } catch(e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'All fields required' });
    const { rows } = await db.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase().trim()]);
    if (!rows[0] || !(await bcrypt.compare(password, rows[0].password)))
      return res.status(401).json({ error: 'Invalid email or password' });
    const { password: _, ...u } = rows[0];
    res.json({ user: u, token: sign(rows[0]) });
  } catch(e) { next(e); }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT id,name,email,role,created_at FROM users WHERE id=$1', [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch(e) { next(e); }
});

module.exports = router;
