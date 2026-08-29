-- Neon(Postgres) 테이블 — weflow 본 사이트와 같은 구조
-- 최초 1회: node --env-file=.env.local scripts/migrate.js --schema

CREATE TABLE IF NOT EXISTS bookings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status     text NOT NULL DEFAULT 'pending',
  name       text NOT NULL,
  phone      text NOT NULL,
  type       text NOT NULL,
  industry   text DEFAULT '',
  note       text DEFAULT '',
  date       text NOT NULL,
  time       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inquiries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status     text NOT NULL DEFAULT 'pending',
  name       text NOT NULL,
  phone      text NOT NULL,
  type       text NOT NULL,
  industry   text DEFAULT '',
  note       text DEFAULT '',
  source     text DEFAULT 'web',
  agree      boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS page_views (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  text NOT NULL,
  path        text NOT NULL,
  referrer    text DEFAULT '',
  source      text DEFAULT 'direct',
  medium      text DEFAULT '',
  campaign    text DEFAULT '',
  device      text DEFAULT 'desktop',
  duration_ms integer,
  max_scroll  integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS page_views_created_at_idx ON page_views (created_at);
