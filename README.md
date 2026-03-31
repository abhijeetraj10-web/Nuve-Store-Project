# NUVÉ Store — Full Stack on Render

One repo. One Render service. One database. Zero separate frontend hosting needed.

Express serves the API **and** the frontend from the same process — Render sees it as a single web service.

---

## Project Structure

```
nuve/
├── render.yaml              ← one-click deploy config
├── package.json             ← root scripts
├── .env.example
├── frontend/
│   └── index.html           ← full SPA (customer store + admin dashboard)
└── backend/
    └── src/
        ├── index.js         ← Express: API routes + serves frontend/
        ├── db/
        │   ├── pool.js
        │   ├── migrate.js
        │   └── seed.js
        ├── middleware/
        │   ├── auth.js
        │   └── errorHandler.js
        └── routes/
            ├── auth.js
            ├── products.js
            ├── orders.js
            └── search.js
```

---

## Deploy to Render (step-by-step)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "initial commit"
gh repo create nuve-store --public --push   # or push to an existing repo
```

### 2. Create the PostgreSQL database on Render
1. Go to [dashboard.render.com](https://dashboard.render.com) → **New → PostgreSQL**
2. Name: `nuve-db`  |  Plan: **Free**
3. Click **Create Database** and wait for it to be ready
4. Copy the **Internal Database URL** — you'll need it in step 3

### 3. Create the Web Service on Render
1. **New → Web Service** → connect your GitHub repo
2. Fill in:
   | Field | Value |
   |---|---|
   | Name | `nuve-store` |
   | Runtime | `Node` |
   | Build Command | `npm install` |
   | Start Command | `npm run db:migrate && npm run db:seed && npm start` |
   | Plan | Free |
3. Add **Environment Variables**:
   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | *(paste Internal Database URL from step 2)* |
   | `JWT_SECRET` | *(any long random string — use a password generator)* |
   | `ADMIN_EMAIL` | `admin@nuve.store` |
   | `ADMIN_PASSWORD` | *(your chosen admin password)* |
   | `ANTHROPIC_API_KEY` | *(optional — enables AI search)* |
4. Click **Create Web Service**

Render will install deps, run migrations, seed the DB, and start the server. Your store will be live at `https://nuve-store.onrender.com` (or similar).

---

### Alternative: one-click with render.yaml
If you keep `render.yaml` in the repo root, Render can auto-detect it:
1. Go to **New → Blueprint**
2. Select your repo
3. Render reads `render.yaml` and creates both the DB and the web service automatically
4. You'll still need to set `ADMIN_PASSWORD` and `ANTHROPIC_API_KEY` manually (they're marked `sync: false` for security)

---

## Admin Login

| Field | Value (default) |
|---|---|
| Email | `admin@nuve.store` (or `ADMIN_EMAIL` env var) |
| Password | whatever you set as `ADMIN_PASSWORD` |

Logging in as admin automatically redirects to the **Admin Dashboard** — no separate URL needed.

---

## Admin Dashboard Features

### Overview tab
- Revenue, total orders, pending count, orders this week
- Status breakdown (pending / confirmed / shipped / etc.)
- Recent 5 orders
- Top 5 products by revenue

### Orders tab
- All orders across all customer accounts
- Filter by order status or payment status
- Click **Manage** on any order to open the detail drawer:
  - See customer info, items, totals
  - Change order status: `pending → confirmed → processing → shipped → delivered → cancelled`
  - Change payment status: `unpaid → paid → refunded → failed`
  - Add a payment reference (e.g. Stripe payment ID)
  - Add internal notes
  - One-click **Mark Paid** and **Cancel Order** shortcuts

### Products tab
- Add new products with name, price, category, stock, emoji, tag, description
- Edit any existing product in place
- Activate / deactivate products (soft delete — data stays in DB)

### Customers tab
- All registered users
- Order count and total spend per customer

---

## API Reference

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/products           ?category=&search=&page=&limit=
GET    /api/products/all       (admin — includes inactive)
GET    /api/products/:id
POST   /api/products           (admin)
PATCH  /api/products/:id       (admin)
DELETE /api/products/:id       (admin — soft deactivate)

POST   /api/orders             (authenticated)
GET    /api/orders             (own orders; admin sees all + ?status=&payment_status=)
GET    /api/orders/stats       (admin)
GET    /api/orders/admin/users (admin)
GET    /api/orders/:id
PATCH  /api/orders/:id         (admin — status, payment_status, notes)

POST   /api/search/ai
```

---

## Local Development

```bash
# 1. Clone and install
npm install

# 2. Create a local Postgres DB
psql -U postgres -c "CREATE DATABASE nuve_store;"

# 3. Configure
cp .env.example .env
# Edit DATABASE_URL and JWT_SECRET

# 4. Migrate + seed
npm run db:migrate
npm run db:seed

# 5. Run
npm run dev
# → http://localhost:3000
```

---

## Adding Real Stripe Payments

The database has a `payment_ref` column and `payment_status` field ready to go.

1. Install Stripe: `npm install stripe`
2. Add `STRIPE_SECRET_KEY` to env vars
3. Create a `/api/checkout/session` route that creates a Stripe Checkout session
4. On Stripe webhook `payment_intent.succeeded`, call `PATCH /api/orders/:id` with `{ payment_status: 'paid', payment_ref: stripePaymentId }`

The admin dashboard will immediately reflect the updated payment status.
