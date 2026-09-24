BEGIN;

ALTER TABLE risks
  ADD COLUMN IF NOT EXISTS cia_impacts JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE risks
SET cia_impacts = (
  SELECT jsonb_agg(value ORDER BY value)
  FROM (SELECT DISTINCT value FROM jsonb_array_elements_text(cia_impacts) AS values(value)) unique_values
)
WHERE jsonb_array_length(cia_impacts) > 1;

CREATE INDEX IF NOT EXISTS idx_risks_cia_impacts
  ON risks USING GIN (cia_impacts);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'risks_cia_impacts_valid'
  ) THEN
    ALTER TABLE risks ADD CONSTRAINT risks_cia_impacts_valid CHECK (
      jsonb_typeof(cia_impacts) = 'array'
      AND cia_impacts <@ '["Confidentiality", "Integrity", "Availability"]'::jsonb
    );
  END IF;
END $$;

COMMIT;
