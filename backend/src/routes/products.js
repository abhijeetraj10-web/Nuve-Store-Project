const router = require('express').Router();
const db     = require('../db/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', async (req, res, next) => {
  try {
    const { category, search, page=1, limit=20 } = req.query;
    const vals=[], where=['active=TRUE'];
    if (category) { vals.push(category); where.push(`category=$${vals.length}`); }
    if (search)   { vals.push(`%${search}%`); where.push(`(name ILIKE $${vals.length} OR description ILIKE $${vals.length})`); }
    const w = `WHERE ${where.join(' AND ')}`;
    const offset = (parseInt(page)-1)*parseInt(limit);
    const [{ rows:products },{ rows:count }] = await Promise.all([
      db.query(`SELECT id,name,description,price,category,emoji,tag,stock FROM products ${w} ORDER BY created_at DESC LIMIT $${vals.length+1} OFFSET $${vals.length+2}`, [...vals,parseInt(limit),offset]),
      db.query(`SELECT COUNT(*) FROM products ${w}`, vals),
    ]);
    res.json({ products, total:parseInt(count[0].count), page:parseInt(page), limit:parseInt(limit) });
  } catch(e) { next(e); }
});

router.get('/all', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(rows);
  } catch(e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM products WHERE id=$1 AND active=TRUE',[req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch(e) { next(e); }
});

router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { name,description,price,category,emoji,tag,stock=100 } = req.body;
    if (!name||!price||!category) return res.status(400).json({ error:'name,price,category required' });
    const { rows } = await db.query(
      `INSERT INTO products (name,description,price,category,emoji,tag,stock) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name,description,parseFloat(price),category,emoji,tag,stock]
    );
    res.status(201).json(rows[0]);
  } catch(e) { next(e); }
});

router.patch('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const allowed = ['name','description','price','category','emoji','tag','stock','active'];
    const sets=[], vals=[];
    for (const k of allowed) if (req.body[k]!==undefined) { sets.push(`${k}=$${sets.length+1}`); vals.push(req.body[k]); }
    if (!sets.length) return res.status(400).json({ error:'Nothing to update' });
    vals.push(req.params.id);
    const { rows } = await db.query(`UPDATE products SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
    if (!rows[0]) return res.status(404).json({ error:'Not found' });
    res.json(rows[0]);
  } catch(e) { next(e); }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await db.query('UPDATE products SET active=FALSE WHERE id=$1 RETURNING id',[req.params.id]);
    if (!rows[0]) return res.status(404).json({ error:'Not found' });
    res.json({ message:'Product deactivated' });
  } catch(e) { next(e); }
});

module.exports = router;
