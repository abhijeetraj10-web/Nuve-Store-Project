const router = require('express').Router();
const db     = require('../db/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');

const ORDER_STATUSES  = ['pending','confirmed','processing','shipped','delivered','cancelled'];
const PAYMENT_STATUSES = ['unpaid','paid','refunded','failed'];

// POST /api/orders — place order
router.post('/', authenticate, async (req, res, next) => {
  const client = await db.getClient();
  try {
    const { items } = req.body;
    if (!items?.length) return res.status(400).json({ error:'items required' });
    await client.query('BEGIN');

    const ids = items.map(i => i.productId);
    const { rows: prods } = await client.query(
      'SELECT id,name,price,stock FROM products WHERE id=ANY($1) AND active=TRUE', [ids]
    );
    if (prods.length !== ids.length)
      throw Object.assign(new Error('One or more products unavailable'), { status:400 });

    const pmap = Object.fromEntries(prods.map(p => [p.id,p]));
    let total = 0;
    for (const item of items) {
      const p = pmap[item.productId];
      if (!p) throw Object.assign(new Error(`Product not found: ${item.productId}`), { status:400 });
      if (p.stock < item.quantity)
        throw Object.assign(new Error(`Insufficient stock for "${p.name}"`), { status:409 });
      total += parseFloat(p.price) * item.quantity;
    }

    const { rows:[order] } = await client.query(
      `INSERT INTO orders (user_id,total) VALUES ($1,$2) RETURNING *`,
      [req.user.id, total.toFixed(2)]
    );
    for (const item of items) {
      const p = pmap[item.productId];
      await client.query(
        'INSERT INTO order_items (order_id,product_id,quantity,unit_price) VALUES ($1,$2,$3,$4)',
        [order.id, item.productId, item.quantity, p.price]
      );
      await client.query('UPDATE products SET stock=stock-$1 WHERE id=$2', [item.quantity, item.productId]);
    }
    await client.query('COMMIT');

    const { rows: fullItems } = await db.query(
      `SELECT oi.*,p.name,p.emoji FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=$1`,
      [order.id]
    );
    res.status(201).json({ ...order, items: fullItems });
  } catch(e) { await client.query('ROLLBACK'); next(e); }
  finally { client.release(); }
});

// GET /api/orders — user's own; admin sees all + filters
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page=1, limit=20, status, payment_status, user_id } = req.query;
    const isAdmin = req.user.role === 'admin';
    const vals=[], where=[];

    if (!isAdmin) { vals.push(req.user.id); where.push(`o.user_id=$${vals.length}`); }
    else if (user_id) { vals.push(user_id); where.push(`o.user_id=$${vals.length}`); }

    if (status)         { vals.push(status);         where.push(`o.status=$${vals.length}`); }
    if (payment_status) { vals.push(payment_status); where.push(`o.payment_status=$${vals.length}`); }

    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (parseInt(page)-1)*parseInt(limit);

    const { rows } = await db.query(
      `SELECT o.*, u.name as customer_name, u.email as customer_email
       FROM orders o JOIN users u ON u.id=o.user_id
       ${w} ORDER BY o.created_at DESC
       LIMIT $${vals.length+1} OFFSET $${vals.length+2}`,
      [...vals, parseInt(limit), offset]
    );
    const { rows:[{count}] } = await db.query(`SELECT COUNT(*) FROM orders o ${w}`, vals);
    res.json({ orders: rows, total: parseInt(count) });
  } catch(e) { next(e); }
});

// GET /api/orders/stats — admin dashboard stats
router.get('/stats', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const [revenue, statusBreakdown, recent, topProducts] = await Promise.all([
      db.query(`SELECT
        COUNT(*) as total_orders,
        SUM(total) FILTER (WHERE payment_status='paid') as total_revenue,
        COUNT(*) FILTER (WHERE payment_status='paid') as paid_orders,
        COUNT(*) FILTER (WHERE status='pending') as pending_orders,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as orders_this_week
        FROM orders`),
      db.query(`SELECT status, COUNT(*) as count FROM orders GROUP BY status ORDER BY count DESC`),
      db.query(`SELECT o.id,o.total,o.status,o.payment_status,o.created_at,u.name,u.email
        FROM orders o JOIN users u ON u.id=o.user_id
        ORDER BY o.created_at DESC LIMIT 5`),
      db.query(`SELECT p.name,p.emoji,SUM(oi.quantity) as units_sold,SUM(oi.quantity*oi.unit_price) as revenue
        FROM order_items oi JOIN products p ON p.id=oi.product_id
        GROUP BY p.id ORDER BY revenue DESC LIMIT 5`),
    ]);
    res.json({
      summary:      revenue.rows[0],
      by_status:    statusBreakdown.rows,
      recent_orders: recent.rows,
      top_products:  topProducts.rows,
    });
  } catch(e) { next(e); }
});

// GET /api/orders/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { rows:[order] } = await db.query(
      `SELECT o.*,u.name as customer_name,u.email as customer_email
       FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=$1`, [req.params.id]
    );
    if (!order) return res.status(404).json({ error:'Not found' });
    if (order.user_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ error:'Forbidden' });
    const { rows:items } = await db.query(
      `SELECT oi.*,p.name,p.emoji,p.category FROM order_items oi
       JOIN products p ON p.id=oi.product_id WHERE oi.order_id=$1`, [order.id]
    );
    res.json({ ...order, items });
  } catch(e) { next(e); }
});

// PATCH /api/orders/:id — admin: update status, payment_status, notes
router.patch('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { status, payment_status, payment_ref, notes } = req.body;
    const sets=[], vals=[];

    if (status) {
      if (!ORDER_STATUSES.includes(status))
        return res.status(400).json({ error:`status must be: ${ORDER_STATUSES.join(', ')}` });
      sets.push(`status=$${sets.length+1}`); vals.push(status);
    }
    if (payment_status) {
      if (!PAYMENT_STATUSES.includes(payment_status))
        return res.status(400).json({ error:`payment_status must be: ${PAYMENT_STATUSES.join(', ')}` });
      sets.push(`payment_status=$${sets.length+1}`); vals.push(payment_status);
    }
    if (payment_ref !== undefined) { sets.push(`payment_ref=$${sets.length+1}`); vals.push(payment_ref); }
    if (notes       !== undefined) { sets.push(`notes=$${sets.length+1}`);       vals.push(notes); }

    if (!sets.length) return res.status(400).json({ error:'Nothing to update' });
    vals.push(req.params.id);
    const { rows } = await db.query(
      `UPDATE orders SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals
    );
    if (!rows[0]) return res.status(404).json({ error:'Not found' });
    res.json(rows[0]);
  } catch(e) { next(e); }
});

// GET /api/orders/admin/users — list all users (admin)
router.get('/admin/users', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id,u.name,u.email,u.role,u.created_at,
        COUNT(o.id) as order_count,
        SUM(o.total) FILTER (WHERE o.payment_status='paid') as total_spent
       FROM users u LEFT JOIN orders o ON o.user_id=u.id
       GROUP BY u.id ORDER BY u.created_at DESC`
    );
    res.json(rows);
  } catch(e) { next(e); }
});

module.exports = router;
