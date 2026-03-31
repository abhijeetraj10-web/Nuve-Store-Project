require('dotenv').config();
const db = require('./pool');

async function migrate() {
  console.log('Running migrations...');
  await db.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS users (
      id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name       VARCHAR(255)        NOT NULL,
      email      VARCHAR(255) UNIQUE NOT NULL,
      password   VARCHAR(255)        NOT NULL,
      role       VARCHAR(50)         NOT NULL DEFAULT 'customer',
      created_at TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ         NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name        VARCHAR(255)  NOT NULL,
      description TEXT,
      price       NUMERIC(10,2) NOT NULL,
      category    VARCHAR(100)  NOT NULL,
      emoji       VARCHAR(10),
      tag         VARCHAR(50),
      stock       INTEGER       NOT NULL DEFAULT 100,
      active      BOOLEAN       NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id        UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status         VARCHAR(50)   NOT NULL DEFAULT 'pending',
      payment_status VARCHAR(50)   NOT NULL DEFAULT 'unpaid',
      payment_ref    VARCHAR(255),
      total          NUMERIC(10,2) NOT NULL,
      notes          TEXT,
      created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      order_id   UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id UUID          NOT NULL REFERENCES products(id),
      quantity   INTEGER       NOT NULL,
      unit_price NUMERIC(10,2) NOT NULL
    );

    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_users_upd    ON users;
    DROP TRIGGER IF EXISTS trg_products_upd ON products;
    DROP TRIGGER IF EXISTS trg_orders_upd   ON orders;

    CREATE TRIGGER trg_users_upd    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    CREATE TRIGGER trg_products_upd BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    CREATE TRIGGER trg_orders_upd   BEFORE UPDATE ON orders   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_orders_user_id    ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  `);
  console.log('✅ Migrations complete.');
  process.exit(0);
}

migrate().catch(err => { console.error('Migration failed:', err); process.exit(1); });
