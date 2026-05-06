-- Enable UUID extension for PostgreSQL
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         TEXT NOT NULL DEFAULT 'ws-001',
  name                 TEXT NOT NULL,
  category             TEXT NOT NULL,
  owner                TEXT NOT NULL,
  risk_level           TEXT NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
  status               TEXT NOT NULL CHECK (status IN ('active','onboarding','offboarded')),
  next_review_date     DATE,
  has_dpa              BOOLEAN DEFAULT FALSE,
  regions              TEXT[] DEFAULT '{}',
  data_types_processed TEXT[] DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create assets table
CREATE TABLE IF NOT EXISTS assets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        TEXT NOT NULL DEFAULT 'ws-001',
  asset_tag           TEXT UNIQUE,
  name                TEXT NOT NULL,
  description         TEXT,
  type                TEXT NOT NULL CHECK (type IN ('application','infrastructure','database','saas','endpoint','data_store','other')),
  owner               TEXT NOT NULL,
  business_unit       TEXT,
  criticality         TEXT NOT NULL CHECK (criticality IN ('low','medium','high','critical')),
  data_classification TEXT,
  status              TEXT NOT NULL CHECK (status IN ('active','planned','retired')),
  notes               TEXT,
  qr_code_value       TEXT,
  last_known_latitude DOUBLE PRECISION,
  last_known_longitude DOUBLE PRECISION,
  last_known_location_at TIMESTAMPTZ,
  last_known_location_address TEXT,
  linked_vendor_id    UUID REFERENCES vendors(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_location_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        TEXT NOT NULL DEFAULT 'ws-001',
  asset_id            UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  latitude            DOUBLE PRECISION NOT NULL,
  longitude           DOUBLE PRECISION NOT NULL,
  captured_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  address             TEXT,
  captured_by_user_id UUID,
  captured_by_email   TEXT,
  device              TEXT,
  source              TEXT,
  notes               TEXT
);

CREATE TABLE IF NOT EXISTS asset_lifecycle_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        TEXT NOT NULL DEFAULT 'ws-001',
  asset_id            UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  event_type          TEXT NOT NULL,
  summary             TEXT NOT NULL,
  notes               TEXT,
  actor_user_id       UUID,
  actor_email         TEXT,
  device              TEXT,
  ip_address          TEXT,
  latitude            DOUBLE PRECISION,
  longitude           DOUBLE PRECISION,
  address             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_vendors_workspace_id ON vendors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_vendors_risk_level ON vendors(risk_level);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);

CREATE INDEX IF NOT EXISTS idx_assets_workspace_id ON assets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_criticality ON assets(criticality);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_linked_vendor_id ON assets(linked_vendor_id);
CREATE INDEX IF NOT EXISTS idx_assets_asset_tag ON assets(asset_tag);
CREATE INDEX IF NOT EXISTS idx_asset_location_history_asset ON asset_location_history(workspace_id, asset_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_lifecycle_events_asset ON asset_lifecycle_events(workspace_id, asset_id, created_at DESC);
