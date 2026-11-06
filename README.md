# Community Meals Dispatch

A Hono API on Cloudflare Workers for managing community meal orders, delivery
schedules, and dispatch records.

## Bindings

| Binding | Type | Resource | Purpose |
|---------|------|----------|---------|
| `DB` | D1 | `community-meals-db` | Meals, schedules, orders |
| `IMAGES` | R2 | `community-meals-images` | Meal photo storage |
| `CACHE` | KV | `community-meals-cache` | Read caching |

## Setup

```bash
npm install

# 1. Create the D1 database (note the database_id it prints)
npx wrangler d1 create community-meals-db

# 2. Create the R2 bucket
npx wrangler r2 bucket create community-meals-images

# 3. Create the KV namespace (note the id it prints)
npx wrangler kv namespace create CACHE

# 4. Paste the D1 database_id and KV id into wrangler.jsonc

# 5. Initialize the database schema
npm run db:init          # local
npm run db:init:remote   # remote (production)
```

## Develop

```bash
npm run dev
```

## Deploy

```bash
npm run deploy
```

## Set the API key secret

All `/api/*` endpoints require an `x-api-key` header. Set the secret:

```bash
npx wrangler secret put API_KEY
# paste a strong key, e.g.: cm-dispatch-7f3a9b2e1d8c
```

Or set it in the dashboard: your Worker → **Settings** → **Variables and Secrets** → **Add** → type `API_KEY` → paste your key → **Encrypt**.

Clients must send the header on every API request:

```bash
curl -H "x-api-key: YOUR_KEY" https://ablecraft.org/api/meals
```

Public routes (no key needed): `/`, `/health`, `/images/*`.

## Seed data (optional, for testing)

Run `seed.sql` in the D1 dashboard Query tab, or:

```bash
npm run db:seed:remote   # production DB
```

This adds 5 meals, 5 schedules, and 5 orders.

## Custom domain

`wrangler.jsonc` already declares a custom domain route for `ablecraft.org/*`.
On first deploy, Cloudflare provisions the route and an SSL certificate
automatically (the zone is already active on this account).

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/meals` | List meals (KV-cached 60s) |
| POST | `/api/meals` | Create a meal |
| GET | `/api/meals/:id` | Get a meal |
| POST | `/api/meals/:id/image` | Upload a meal photo to R2 |
| GET | `/images/*` | Serve an image from R2 |
| GET | `/api/schedules` | List dispatch schedules |
| POST | `/api/schedules` | Create a schedule |
| PATCH | `/api/schedules/:id` | Update schedule status/driver |
| GET | `/api/orders` | List orders |
| POST | `/api/orders` | Create an order |
| PATCH | `/api/orders/:id` | Update order status |
