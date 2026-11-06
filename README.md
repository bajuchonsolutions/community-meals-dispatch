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
