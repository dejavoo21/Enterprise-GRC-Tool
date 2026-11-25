-- Preserve the distinction between an unassessed requirement and a recorded zero rating.
-- Existing values are retained because their assessment provenance cannot be inferred safely.

BEGIN;

ALTER TABLE regulatory_requirements
  ALTER COLUMN compliance_rating DROP DEFAULT,
  ALTER COLUMN compliance_rating DROP NOT NULL,
  ALTER COLUMN risk_rating DROP DEFAULT,
  ALTER COLUMN risk_rating DROP NOT NULL;

COMMIT;
