const router = require('express').Router();
const db     = require('../db/pool');

router.post('/ai', async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query?.trim()) return res.status(400).json({ error:'query required' });

    const { rows:products } = await db.query(
      'SELECT id,name,description,price,category FROM products WHERE active=TRUE ORDER BY name'
    );
    const catalog = products.map(p => `[${p.id}] ${p.name} (${p.category}, $${p.price}): ${p.description}`).join('\n');

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{ 'Content-Type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01' },
      body: JSON.stringify({
        model:'claude-sonnet-4-20250514', max_tokens:500,
        system:`You are a shopping assistant for NUVÉ. Reply ONLY with raw JSON: {"message":"short recommendation","productIds":["uuid",...]}.
Catalog:\n${catalog}`,
        messages:[{ role:'user', content:query }],
      }),
    });
    const data = await r.json();
    const text = data.content?.[0]?.text || '{}';
    let parsed;
    try { parsed = JSON.parse(text.replace(/```json|```/g,'').trim()); }
    catch { parsed = { message: text, productIds:[] }; }

    const matched = products.filter(p => parsed.productIds?.includes(p.id));
    res.json({ message: parsed.message, products: matched });
  } catch(e) { next(e); }
});

module.exports = router;
