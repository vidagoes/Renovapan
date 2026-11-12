
CREATE TABLE owner (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  totp_secret TEXT,
  last_totp INTEGER NOT NULL DEFAULT -1
) STRICT;

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES owner(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
) STRICT;

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  description TEXT NOT NULL,
  specs TEXT NOT NULL CHECK (json_valid(specs)),
  images TEXT NOT NULL CHECK (json_valid(images)),
  video TEXT NOT NULL,
  lead_time TEXT NOT NULL,
  price_cents INTEGER CHECK (price_cents >= 0),
  show_price INTEGER NOT NULL CHECK (show_price IN (0, 1)),
  featured INTEGER NOT NULL CHECK (featured IN (0, 1)),
  visibility TEXT NOT NULL CHECK (visibility IN ('draft', 'published', 'hidden', 'archived')),
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  color TEXT NOT NULL,
  color_key TEXT NOT NULL,
  hex TEXT NOT NULL,
  images TEXT NOT NULL CHECK (json_valid(images)),
  ready INTEGER NOT NULL DEFAULT 0 CHECK (ready BETWEEN 0 AND 1000000),
  pending INTEGER NOT NULL DEFAULT 0 CHECK (pending BETWEEN 0 AND 1000000),
  UNIQUE (product_id, color_key)
) STRICT;

CREATE TABLE media (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  body BLOB NOT NULL CHECK (length(body) BETWEEN 1 AND 5242880)
) STRICT;

CREATE TABLE deals (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL REFERENCES variants(id),
  condition TEXT NOT NULL CHECK (condition IN ('ready', 'pending')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL CHECK (status IN ('reserved', 'sold', 'cancelled')),
  amount_cents INTEGER CHECK (amount_cents >= 0),
  business_date TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE movements (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL REFERENCES variants(id),
  deal_id TEXT REFERENCES deals(id),
  kind TEXT NOT NULL CHECK (kind IN ('adjust', 'restore', 'sell', 'reserve', 'cancel', 'confirm')),
  ready_before INTEGER NOT NULL CHECK (ready_before >= 0),
  ready_after INTEGER NOT NULL CHECK (ready_after >= 0),
  pending_before INTEGER NOT NULL CHECK (pending_before >= 0),
  pending_after INTEGER NOT NULL CHECK (pending_after >= 0),
  reason TEXT NOT NULL,
  actor TEXT NOT NULL,
  happened_at TEXT NOT NULL
) STRICT;

CREATE TABLE requests (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  result TEXT NOT NULL CHECK (json_valid(result))
) STRICT;

CREATE TABLE analytics (
  day TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('view', 'whatsapp')),
  product_id TEXT NOT NULL DEFAULT '',
  total INTEGER NOT NULL CHECK (total >= 0),
  PRIMARY KEY (day, event, product_id)
) STRICT;

CREATE INDEX movements_date ON movements(happened_at DESC);
CREATE INDEX deals_status_date ON deals(status, business_date);
CREATE INDEX sessions_expiry ON sessions(expires_at);
