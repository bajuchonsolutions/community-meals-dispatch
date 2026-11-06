-- Community Meals Dispatch — seed data for testing
-- Run in the D1 dashboard Query tab (or: wrangler d1 execute community-meals-db --remote --file=./seed.sql)
-- Safe to re-run: uses INSERT OR IGNORE so it won't duplicate if you run twice.

-- Sample meals
INSERT OR IGNORE INTO meals (id, name, description, image_key) VALUES
  (1, 'Vegetable Lasagna', 'Hearty vegetarian lasagna with seasonal vegetables. Serves 6.', NULL),
  (2, 'Chicken Rice Bowl', 'Grilled chicken with jasmine rice and steamed broccoli. Serves 4.', NULL),
  (3, 'Lentil Soup', 'Warm lentil soup with carrots and celery. Serves 8.', NULL),
  (4, 'Turkey Sandwiches', 'Turkey and cheese sandwiches on whole wheat. Serves 10.', NULL),
  (5, 'Pasta Primavera', 'Penne pasta with fresh garden vegetables and olive oil. Serves 6.', NULL);

-- Sample dispatch schedules (references meal IDs above)
INSERT OR IGNORE INTO schedules (id, meal_id, route_name, driver, status, scheduled_for) VALUES
  (1, 1, 'North Route - Maple St', 'Sarah K.', 'scheduled', '2026-11-07T11:00:00Z'),
  (2, 2, 'East Route - Oak Ave', 'Marcus T.', 'scheduled', '2026-11-07T12:00:00Z'),
  (3, 3, 'Downtown - Senior Center', 'Sarah K.', 'en_route', '2026-11-06T17:00:00Z'),
  (4, 4, 'West Route - Pine Dr', 'Dana R.', 'delivered', '2026-11-06T10:00:00Z'),
  (5, 5, 'South Route - Elm St', 'Marcus T.', 'scheduled', '2026-11-08T11:30:00Z');

-- Sample orders (references meal IDs above)
INSERT OR IGNORE INTO orders (id, meal_id, recipient, quantity, status) VALUES
  (1, 1, 'Community Center A', 2, 'pending'),
  (2, 2, 'Shelter on Oak Ave', 4, 'confirmed'),
  (3, 3, 'Senior Living - Maple', 8, 'dispatched'),
  (4, 4, 'After-School Program', 10, 'delivered'),
  (5, 5, 'Family Services Hub', 3, 'pending');

-- Verify the data
SELECT 'meals' AS table_name, COUNT(*) AS count FROM meals
UNION ALL
SELECT 'schedules', COUNT(*) FROM schedules
UNION ALL
SELECT 'orders', COUNT(*) FROM orders;
