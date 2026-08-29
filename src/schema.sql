-- SquadQueue database schema. Run once with `npm run migrate`.
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS), so running
-- this against an existing database only adds what's missing.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  provider TEXT NOT NULL DEFAULT 'local',
  provider_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_id)
);

-- Email verification. DEFAULT true on the ALTER so any account that already
-- existed before this feature shipped is grandfathered in as verified;
-- the signup route explicitly passes false for new local-signup accounts.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users (verification_token);

-- Forgot-password flow. Same shape as email verification above: a random
-- token + expiry, emailed as a link, cleared once used (or once a new one
-- is issued).
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users (reset_token);

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

-- Every player starts at 100 reputation; it moves up/down as other players
-- thumbs-up / thumbs-down them (see reputation_votes below).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reputation INTEGER NOT NULL DEFAULT 100;

-- Game genre tags (survival, cozy, farming, etc.) — a second matching
-- dimension alongside specific game titles.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS genres JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Each person's own minimum acceptable match %. 0 means "no preference set".
-- Purely a personal display filter: candidates below it are still fully
-- visible and messageable, just flagged with a warning symbol in the UI.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS min_match_pct INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender_pair ON messages (sender_id, receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_pair ON messages (receiver_id, sender_id, created_at);

-- One row per (voter, target) pair caps each person to a single active vote
-- on any given user (enforced by the primary key, not just app logic) while
-- still letting them change their mind: casting a new vote UPDATEs the row,
-- and re-clicking the same thumb DELETEs it (see src/routes/reputation.js).
CREATE TABLE IF NOT EXISTS reputation_votes (
  voter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value SMALLINT NOT NULL CHECK (value IN (1, -1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (voter_id, target_id),
  CHECK (voter_id <> target_id)
);

CREATE INDEX IF NOT EXISTS idx_reputation_votes_target ON reputation_votes (target_id);

-- Blocking is mutual: if A blocks B, neither sees the other in the lobby and
-- neither can message the other, regardless of which direction the block row
-- points. We still store direction (who blocked whom) so a person can see
-- and manage their own block list / unblock someone later.
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks (blocked_id);
