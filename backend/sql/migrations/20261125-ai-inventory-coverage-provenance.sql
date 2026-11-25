ALTER TABLE ai_inventory
  ADD COLUMN IF NOT EXISTS inventory_coverage_recorded BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN ai_inventory.inventory_coverage_recorded IS
  'True only when inventory coverage was explicitly supplied through a reviewed write; legacy derived values remain unverified.';
