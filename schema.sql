-- Community Meals Dispatch — D1 schema
-- Run locally:  npm run db:init
-- Run on remote: npm run db:init:remote

-- Meals catalog
CREATE TABLE IF NOT EXISTS meals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT,
  image_key   TEXT,            -- R2 object key for the meal photo
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Dispatch / delivery schedules
CREATE TABLE IF NOT EXISTS schedules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_id     INTEGER NOT NULL,
  route_name  TEXT NOT NULL,
  driver      TEXT,
  status      TEXT NOT NULL DEFAULT 'scheduled',  -- scheduled | en_route | delivered | cancelled
  scheduled_for TEXT NOT NULL,                    -- ISO 8601 datetime
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (meal_id) REFERENCES meals(id)
);

-- Meal orders
CREATE TABLE IF NOT EXISTS orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_id     INTEGER NOT NULL,
  recipient   TEXT NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'pending',    -- pending | confirmed | dispatched | delivered
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (meal_id) REFERENCES meals(id)
);

CREATE INDEX IF NOT EXISTS idx_schedules_meal ON schedules(meal_id);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);
CREATE INDEX IF NOT EXISTS idx_orders_meal ON orders(meal_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
