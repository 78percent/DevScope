CREATE TABLE IF NOT EXISTS research_reports (
  id uuid PRIMARY KEY,
  topic text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'collecting', 'awaiting_review', 'generating', 'completed', 'failed', 'cancelled')),
  checkpoint jsonb,
  guidance text,
  report jsonb,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  reviewed_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_reports_created_idx ON research_reports(created_at);
