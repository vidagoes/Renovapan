CREATE TABLE totp_enrollment (
  session_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash) ON DELETE CASCADE,
  encrypted_secret TEXT NOT NULL CHECK (encrypted_secret LIKE 'v1:%'),
  expires_at INTEGER NOT NULL
) STRICT;

DELETE FROM sessions;

CREATE TABLE quote_analytics (
  day TEXT PRIMARY KEY,
  clicks INTEGER NOT NULL CHECK (clicks >= 0),
  products INTEGER NOT NULL CHECK (products >= 0)
) STRICT;
