-- Manual additive migration. No existing records are modified.
CREATE TABLE IF NOT EXISTS case_workspaces (
  case_id uuid PRIMARY KEY REFERENCES cases(id) ON DELETE RESTRICT,
  stage varchar(120) NOT NULL DEFAULT '',
  waiting_for varchar(500) NOT NULL DEFAULT '',
  check_date date,
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hearing_review_receipts (
  request_id uuid PRIMARY KEY,
  hearing_id uuid NOT NULL REFERENCES case_hearings(id) ON DELETE RESTRICT,
  payload_hash varchar(64) NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
