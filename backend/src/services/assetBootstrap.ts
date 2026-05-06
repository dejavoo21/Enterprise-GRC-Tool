import { query } from '../db.js';

export async function ensureAssetOperationsSchema(): Promise<void> {
  await query(`
    ALTER TABLE assets
      ADD COLUMN IF NOT EXISTS asset_tag TEXT,
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS qr_code_value TEXT,
      ADD COLUMN IF NOT EXISTS last_known_latitude DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS last_known_longitude DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS last_known_location_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_known_location_address TEXT
  `);

  await query(`
    UPDATE assets
       SET asset_tag = CONCAT('AST-LEGACY-', UPPER(REPLACE(LEFT(id::text, 8), '-', '')))
     WHERE asset_tag IS NULL
  `);

  await query(`
    UPDATE assets
       SET qr_code_value = CONCAT('grc-asset://asset/', asset_tag)
     WHERE qr_code_value IS NULL
  `);

  await query(`
    ALTER TABLE assets
      ALTER COLUMN asset_tag SET NOT NULL
  `);

  await query(`
    ALTER TABLE assets
      ALTER COLUMN qr_code_value SET NOT NULL
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_asset_tag
      ON assets(asset_tag)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS asset_location_history (
      id UUID PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      address TEXT,
      captured_by_user_id UUID,
      captured_by_email TEXT,
      device TEXT,
      source TEXT,
      notes TEXT
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_asset_location_history_asset
      ON asset_location_history(workspace_id, asset_id, captured_at DESC)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS asset_lifecycle_events (
      id UUID PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      summary TEXT NOT NULL,
      notes TEXT,
      actor_user_id UUID,
      actor_email TEXT,
      device TEXT,
      ip_address TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_asset_lifecycle_events_asset
      ON asset_lifecycle_events(workspace_id, asset_id, created_at DESC)
  `);
}
