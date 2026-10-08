CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS repositories (
  id serial PRIMARY KEY,
  owner text NOT NULL,
  name text NOT NULL,
  url text NOT NULL UNIQUE,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repository_analyses (
  id serial PRIMARY KEY,
  repository_id integer NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  health_score integer NOT NULL CHECK (health_score BETWEEN 0 AND 100),
  result jsonb NOT NULL,
  summary_embedding vector(1024),
  created_at timestamptz NOT NULL DEFAULT now()
);
