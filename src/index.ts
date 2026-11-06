import { Hono } from "hono";

// Bindings for D1, R2, and KV
export type Bindings = {
  DB: D1Database;
  IMAGES: R2Bucket;
  CACHE: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Simple KV cache wrapper. `key` is the cache key, `ttl` seconds, `loader`
// produces the value when the cache misses.
async function cached<T>(
  cache: KVNamespace,
  key: string,
  ttl: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = await cache.get(key, "json");
  if (hit) return hit as T;
  const value = await loader();
  // Fire-and-forget; don't block the response on cache writes.
  ctx_waitUntil(cache.put(key, JSON.stringify(value), { expirationTtl: ttl }));
  return value;
}

// Hono's execution context isn't directly exposed here, so we use a module-level
// promise that resolves when a request is in flight. In practice, use
// `c.executionCtx.waitUntil(...)` inside handlers (see usage below).
let _waitUntil: ((p: Promise<unknown>) => void) | null = null;
function ctx_waitUntil(p: Promise<unknown>) {
  if (_waitUntil) _waitUntil(p);
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
app.get("/", (c) => c.json({ ok: true, service: "community-meals-dispatch" }));

app.get("/health", (c) => c.json({ status: "ok" }));

// ---------------------------------------------------------------------------
// Meals (catalog) — D1 + R2 image + KV cache
// ---------------------------------------------------------------------------

// List all meals (cached for 60s in KV)
app.get("/api/meals", async (c) => {
  const meals = await cached(
    c.env.CACHE,
    "meals:all",
    60,
    () =>
      c.env.DB.prepare("SELECT * FROM meals ORDER BY created_at DESC").all<{
        id: number;
        name: string;
        description: string | null;
        image_key: string | null;
        created_at: string;
      }>(),
  );
  return c.json(meals.results ?? []);
});

// Get a single meal
app.get("/api/meals/:id", async (c) => {
  const id = c.req.param("id");
  const meal = await cached(c.env.CACHE, `meal:${id}`, 60, () =>
    c.env.DB.prepare("SELECT * FROM meals WHERE id = ?").bind(id).first(),
  );
  if (!meal) return c.json({ error: "Meal not found" }, 404);
  return c.json(meal);
});

// Create a meal
app.post("/api/meals", async (c) => {
  const body = await c.req.json<{ name: string; description?: string; image_key?: string }>();
  if (!body.name) return c.json({ error: "name is required" }, 400);
  const result = await c.env.DB.prepare(
    "INSERT INTO meals (name, description, image_key) VALUES (?, ?, ?) RETURNING *",
  )
    .bind(body.name, body.description ?? null, body.image_key ?? null)
    .first();
  await c.env.CACHE.delete("meals:all");
  return c.json(result, 201);
});

// ---------------------------------------------------------------------------
// Meal images — upload to R2, serve from R2
// ---------------------------------------------------------------------------

// Upload an image for a meal (multipart/form-data, field name "file")
app.post("/api/meals/:id/image", async (c) => {
  const id = c.req.param("id");
  const meal = await c.env.DB.prepare("SELECT id FROM meals WHERE id = ?").bind(id).first();
  if (!meal) return c.json({ error: "Meal not found" }, 404);

  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: "file field is required" }, 400);

  const key = `meals/${id}/${file.name}`;
  await c.env.IMAGES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  await c.env.DB.prepare("UPDATE meals SET image_key = ? WHERE id = ?").bind(key, id).run();
  await c.env.CACHE.delete("meals:all");
  await c.env.CACHE.delete(`meal:${id}`);
  return c.json({ ok: true, key }, 201);
});

// Serve a meal image directly from R2
app.get("/images/*", async (c) => {
  const key = c.req.path.replace(/^\//, ""); // "images/meals/1/photo.jpg"
  const object = await c.env.IMAGES.get(key);
  if (!object) return c.notFound();
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  return new Response(object.body, { headers });
});

// ---------------------------------------------------------------------------
// Schedules (dispatch / delivery)
// ---------------------------------------------------------------------------

app.get("/api/schedules", async (c) => {
  const status = c.req.query("status");
  const stmt = status
    ? c.env.DB.prepare(
        "SELECT s.*, m.name AS meal_name FROM schedules s JOIN meals m ON m.id = s.meal_id WHERE s.status = ? ORDER BY s.scheduled_for",
      ).bind(status)
    : c.env.DB.prepare(
        "SELECT s.*, m.name AS meal_name FROM schedules s JOIN meals m ON m.id = s.meal_id ORDER BY s.scheduled_for",
      );
  const result = await stmt.all();
  return c.json(result.results ?? []);
});

app.post("/api/schedules", async (c) => {
  const body = await c.req.json<{
    meal_id: number;
    route_name: string;
    driver?: string;
    scheduled_for: string;
  }>();
  if (!body.meal_id || !body.route_name || !body.scheduled_for)
    return c.json({ error: "meal_id, route_name, scheduled_for are required" }, 400);
  const result = await c.env.DB.prepare(
    "INSERT INTO schedules (meal_id, route_name, driver, scheduled_for) VALUES (?, ?, ?, ?) RETURNING *",
  )
    .bind(body.meal_id, body.route_name, body.driver ?? null, body.scheduled_for)
    .first();
  return c.json(result, 201);
});

// Update schedule status (e.g. en_route -> delivered)
app.patch("/api/schedules/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ status?: string; driver?: string }>();
  const result = await c.env.DB.prepare(
    "UPDATE schedules SET status = COALESCE(?, status), driver = COALESCE(?, driver) WHERE id = ? RETURNING *",
  )
    .bind(body.status ?? null, body.driver ?? null, id)
    .first();
  if (!result) return c.json({ error: "Schedule not found" }, 404);
  return c.json(result);
});

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

app.get("/api/orders", async (c) => {
  const status = c.req.query("status");
  const stmt = status
    ? c.env.DB.prepare(
        "SELECT o.*, m.name AS meal_name FROM orders o JOIN meals m ON m.id = o.meal_id WHERE o.status = ? ORDER BY o.created_at DESC",
      ).bind(status)
    : c.env.DB.prepare(
        "SELECT o.*, m.name AS meal_name FROM orders o JOIN meals m ON m.id = o.meal_id ORDER BY o.created_at DESC",
      );
  const result = await stmt.all();
  return c.json(result.results ?? []);
});

app.post("/api/orders", async (c) => {
  const body = await c.req.json<{
    meal_id: number;
    recipient: string;
    quantity?: number;
  }>();
  if (!body.meal_id || !body.recipient)
    return c.json({ error: "meal_id and recipient are required" }, 400);
  const result = await c.env.DB.prepare(
    "INSERT INTO orders (meal_id, recipient, quantity) VALUES (?, ?, ?) RETURNING *",
  )
    .bind(body.meal_id, body.recipient, body.quantity ?? 1)
    .first();
  return c.json(result, 201);
});

app.patch("/api/orders/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ status?: string }>();
  const result = await c.env.DB.prepare(
    "UPDATE orders SET status = COALESCE(?, status) WHERE id = ? RETURNING *",
  )
    .bind(body.status ?? null, id)
    .first();
  if (!result) return c.json({ error: "Order not found" }, 404);
  return c.json(result);
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default {
  fetch(req: Request, env: Bindings, ctx: ExecutionContext) {
    _waitUntil = (p) => ctx.waitUntil(p);
    return app.fetch(req, env);
  },
};
