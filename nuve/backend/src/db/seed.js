require('dotenv').config();
const bcrypt = require('bcryptjs');
const db     = require('./pool');

const products = [
  { name:'Linen Overshirt',   description:'Relaxed fit, breathable linen in natural ecru.',    price:189, category:'clothing',     emoji:'👔', tag:'New'         },
  { name:'Wide Leg Trouser',  description:'High-rise silhouette with a fluid drape.',          price:145, category:'clothing',     emoji:'👖', tag:'Best Seller' },
  { name:'Canvas Tote',       description:'Sturdy natural canvas with leather handles.',       price: 68, category:'accessories', emoji:'👜', tag:null           },
  { name:'Merino Crewneck',   description:'Ultra-soft merino wool, minimal branding.',         price:220, category:'clothing',     emoji:'🧶', tag:'New'         },
  { name:'Leather Derby',     description:'Full-grain leather, Goodyear welted sole.',         price:295, category:'footwear',    emoji:'👞', tag:null           },
  { name:'Silk Scarf',        description:'100% mulberry silk, 90×90cm square.',              price: 95, category:'accessories', emoji:'🧣', tag:'Limited'      },
  { name:'Technical Sneaker', description:'Recycled upper, sustainable foam sole.',            price:175, category:'footwear',    emoji:'👟', tag:'New'         },
  { name:'Woven Belt',        description:'Braided leather in dark cognac.',                   price: 55, category:'accessories', emoji:'⌚', tag:null           },
  { name:'Organic Tee',       description:'GOTS-certified organic cotton, unisex cut.',        price: 65, category:'clothing',     emoji:'👕', tag:null           },
];

async function seed() {
  // Admin user
  const adminEmail    = process.env.ADMIN_EMAIL    || 'admin@nuve.store';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const hash = await bcrypt.hash(adminPassword, 12);
  await db.query(
    `INSERT INTO users (name, email, password, role) VALUES ('Admin','${ adminEmail}',$2,'admin')
     ON CONFLICT (email) DO UPDATE SET role='admin', password=$2`,
    [adminEmail, hash]
  );
  console.log(`✅ Admin: ${adminEmail} / ${adminPassword}`);

  // Products
  for (const p of products) {
    await db.query(
      `INSERT INTO products (name,description,price,category,emoji,tag)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
      [p.name,p.description,p.price,p.category,p.emoji,p.tag]
    );
  }
  console.log(`✅ ${products.length} products seeded.`);
  process.exit(0);
}

seed().catch(err => { console.error('Seed error:', err); process.exit(1); });
