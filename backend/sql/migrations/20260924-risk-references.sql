BEGIN;
CREATE SEQUENCE IF NOT EXISTS risk_reference_sequence;
ALTER TABLE risks ADD COLUMN IF NOT EXISTS risk_ref TEXT;

-- Assign once, independently of list order, workspace changes or scoring policy.
WITH missing AS (
  SELECT id FROM risks WHERE risk_ref IS NULL ORDER BY created_at, id
), assigned AS MATERIALIZED (
  SELECT id, nextval('risk_reference_sequence') AS n FROM missing
)
UPDATE risks r SET risk_ref = 'RSK-' || lpad(a.n::text, greatest(4, length(a.n::text)), '0')
FROM assigned a WHERE r.id = a.id;
ALTER TABLE risks ALTER COLUMN risk_ref SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS risks_reference_unique ON risks(risk_ref);

CREATE OR REPLACE FUNCTION laflo_risk_reference() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE n BIGINT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    n := nextval('risk_reference_sequence');
    NEW.risk_ref := 'RSK-' || lpad(n::text, greatest(4, length(n::text)), '0');
  ELSIF NEW.risk_ref IS DISTINCT FROM OLD.risk_ref THEN
    RAISE EXCEPTION 'Risk reference is immutable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS risk_reference_guard ON risks;
CREATE TRIGGER risk_reference_guard BEFORE INSERT OR UPDATE ON risks
FOR EACH ROW EXECUTE FUNCTION laflo_risk_reference();
COMMIT;
