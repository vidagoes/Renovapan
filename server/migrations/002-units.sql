
ALTER TABLE products ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 1000000);
ALTER TABLE products ADD COLUMN public_price_cents INTEGER CHECK (public_price_cents >= 0);
UPDATE products SET public_price_cents = price_cents WHERE show_price = 1;

CREATE TABLE units (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  variant_id TEXT NOT NULL REFERENCES variants(id),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  technical TEXT NOT NULL CHECK (technical IN ('waiting','repair','testing','ready')),
  commercial TEXT NOT NULL CHECK (commercial IN ('free','reserved','sold','archived')),
  acquired_on TEXT,
  technical_description TEXT NOT NULL,
  notes TEXT NOT NULL,
  images TEXT NOT NULL CHECK (json_valid(images)),
  video TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  updated_at TEXT NOT NULL
) STRICT;

ALTER TABLE deals ADD COLUMN unit_id TEXT REFERENCES units(id);
CREATE UNIQUE INDEX active_unit_deal ON deals(unit_id)
WHERE unit_id IS NOT NULL AND status IN ('reserved','sold');

CREATE TABLE legacy_stock (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL REFERENCES variants(id),
  condition TEXT NOT NULL CHECK (condition IN ('ready','pending')),
  legacy_deal_id TEXT REFERENCES deals(id),
  original INTEGER NOT NULL CHECK (original > 0),
  remaining INTEGER NOT NULL CHECK (remaining BETWEEN 0 AND original)
) STRICT;
INSERT INTO legacy_stock
SELECT id || ':ready', id, 'ready', NULL, ready, ready FROM variants WHERE ready > 0
UNION ALL
SELECT id || ':pending', id, 'pending', NULL, pending, pending FROM variants WHERE pending > 0
UNION ALL
SELECT id, variant_id, condition, id, quantity, quantity FROM deals WHERE status = 'reserved';

ALTER TABLE variants DROP COLUMN ready;
ALTER TABLE variants DROP COLUMN pending;

CREATE INDEX units_variant_status ON units(variant_id, commercial, technical);
CREATE VIEW variant_stock AS
SELECT v.id,
  COUNT(u.id) FILTER (WHERE u.technical = 'ready') AS ready,
  COUNT(u.id) FILTER (WHERE u.technical <> 'ready') AS pending
FROM variants v LEFT JOIN units u ON u.variant_id = v.id AND u.commercial = 'free'
GROUP BY v.id;

CREATE VIEW public_unit_photos AS
SELECT u.variant_id, json_extract(photo.value, '$.id') AS media_id,
  json_extract(photo.value, '$.kind') AS kind
FROM units u JOIN variants v ON v.id = u.variant_id JOIN products p ON p.id = v.product_id
JOIN json_each(u.images) photo
WHERE p.visibility = 'published' AND json_extract(photo.value, '$.public') = 1
AND (u.commercial = 'free' OR json_extract(photo.value, '$.kind') = 'reference');

CREATE TABLE audit_events (
  id INTEGER PRIMARY KEY,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  before_json TEXT CHECK (before_json IS NULL OR json_valid(before_json)),
  after_json TEXT CHECK (after_json IS NULL OR json_valid(after_json)),
  reason TEXT NOT NULL,
  actor TEXT NOT NULL,
  happened_at TEXT NOT NULL
) STRICT;
CREATE INDEX audit_entity ON audit_events(entity, entity_id, id DESC);

CREATE TABLE unit_expenses (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id),
  category TEXT NOT NULL CHECK (category IN ('acquisition','parts','paint','electrical','mechanical','labor','transport','other')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  business_date TEXT NOT NULL,
  notes TEXT NOT NULL,
  reversed_at TEXT
) STRICT;
CREATE INDEX expenses_unit ON unit_expenses(unit_id, business_date);

CREATE TABLE demands (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES products(id),
  name TEXT NOT NULL,
  brand_model TEXT NOT NULL,
  color TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
  business_date TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('normal','high')),
  status TEXT NOT NULL CHECK (status IN ('open','checking','resolved','closed')),
  notes TEXT NOT NULL,
  contact TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX demands_product_date ON demands(product_id, business_date);

ALTER TABLE analytics RENAME TO analytics_v1;
CREATE TABLE analytics (
  day TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('view','whatsapp','visit')),
  product_id TEXT NOT NULL DEFAULT '',
  total INTEGER NOT NULL CHECK (total >= 0),
  PRIMARY KEY (day, event, product_id)
) STRICT;
INSERT INTO analytics SELECT * FROM analytics_v1;
DROP TABLE analytics_v1;
