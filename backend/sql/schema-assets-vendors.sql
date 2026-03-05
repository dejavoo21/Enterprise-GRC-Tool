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
  name                TEXT NOT NULL,
  description         TEXT,
  type                TEXT NOT NULL CHECK (type IN ('application','infrastructure','database','saas','endpoint','data_store','other')),
  owner               TEXT NOT NULL,
  business_unit       TEXT,
  criticality         TEXT NOT NULL CHECK (criticality IN ('low','medium','high','critical')),
  data_classification TEXT,
  status              TEXT NOT NULL CHECK (status IN ('active','planned','retired')),
  linked_vendor_id    UUID REFERENCES vendors(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
