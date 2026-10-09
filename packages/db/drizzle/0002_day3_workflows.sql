CREATE TABLE IF NOT EXISTS watchlist (
  id serial PRIMARY KEY,
  repository_id integer NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS watchlist_repository_unique ON watchlist(repository_id);

CREATE TABLE IF NOT EXISTS repository_snapshots (
  id serial PRIMARY KEY,
  repository_id integer NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS repository_snapshots_repository_created_idx
  ON repository_snapshots(repository_id, created_at);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id serial PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('daily_health', 'quick_assessment', 'weekly_report')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  input jsonb NOT NULL,
  output jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id serial PRIMARY KEY,
  run_id integer NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  attempt integer NOT NULL DEFAULT 0,
  output jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS workflow_steps_run_key_unique ON workflow_steps(run_id, key);
