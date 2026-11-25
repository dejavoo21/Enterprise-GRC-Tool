-- Backfill missing legacy asset identifiers before enforcing canonical Asset Operations constraints.
-- This migration changes only records with missing compatibility fields and must run under controlled migration authorization.

BEGIN;

UPDATE assets
       SET asset_tag = CONCAT('AST-LEGACY-', UPPER(REPLACE(id::text, '-', '')))
     WHERE asset_tag IS NULL
;

UPDATE assets
       SET qr_code_value = CONCAT('grc-asset://asset/', asset_tag)
     WHERE qr_code_value IS NULL
;

UPDATE assets
       SET barcode_value = asset_tag,
           barcode_type = COALESCE(barcode_type, 'code128'),
           asset_owner = COALESCE(asset_owner, owner),
           business_owner = COALESCE(business_owner, owner),
           classification = COALESCE(classification, data_classification, 'Internal'),
           lifecycle_status = COALESCE(lifecycle_status, status),
           risk_rating = COALESCE(risk_rating, criticality),
           compliance_status = COALESCE(compliance_status, 'Needs review')
     WHERE barcode_value IS NULL
        OR asset_owner IS NULL
        OR business_owner IS NULL
        OR classification IS NULL
        OR lifecycle_status IS NULL
        OR risk_rating IS NULL
        OR compliance_status IS NULL
;

ALTER TABLE assets
      ALTER COLUMN asset_tag SET NOT NULL
;

ALTER TABLE assets
      ALTER COLUMN qr_code_value SET NOT NULL
;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_asset_tag
      ON assets(asset_tag)
;

COMMIT;
