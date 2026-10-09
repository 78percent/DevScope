CREATE UNIQUE INDEX IF NOT EXISTS repositories_owner_name_unique ON repositories(owner, name);

CREATE TABLE IF NOT EXISTS repo_embeddings (
  id serial PRIMARY KEY,
  repository_id integer NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('repository', 'readme', 'hacker_news')),
  title text NOT NULL,
  content text NOT NULL,
  source_url text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(1024) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS repo_embeddings_embedding_hnsw
  ON repo_embeddings USING hnsw (embedding vector_cosine_ops);
