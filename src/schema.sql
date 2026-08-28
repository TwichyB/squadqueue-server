-- SquadQueue database schema. Run once with `npm run migrate`.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  provider TEXT NOT NULL DEFAULT 'local',
  provider_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_id)
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'unspecified',
  goal JSONB NOT NULL DEFAULT '["friends"]'::jsonb,
  games JSONB NOT NULL DEFAULT '[]'::jsonb,
  days JSONB NOT NULL DEFAULT '[]'::jsonb,
  times JSONB NOT NULL DEFAULT '[]'::jsonb,
  styles JSONB NOT NULL DEFAULT '[]'::jsonb,
  good_to_know TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender_pair ON messages (sender_id, receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_pair ON messages (receiver_id, sender_id, created_at);
