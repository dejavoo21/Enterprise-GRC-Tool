BEGIN;
ALTER TABLE risks
  ADD COLUMN IF NOT EXISTS methodology_id TEXT,
  ADD COLUMN IF NOT EXISTS methodology_version INTEGER,
  ADD COLUMN IF NOT EXISTS inherent_score INTEGER,
  ADD COLUMN IF NOT EXISTS inherent_rating TEXT,
  ADD COLUMN IF NOT EXISTS residual_score INTEGER,
  ADD COLUMN IF NOT EXISTS residual_rating TEXT,
  ADD COLUMN IF NOT EXISTS target_likelihood INTEGER,
  ADD COLUMN IF NOT EXISTS target_impact INTEGER,
  ADD COLUMN IF NOT EXISTS target_score INTEGER,
  ADD COLUMN IF NOT EXISTS target_rating TEXT,
  ADD COLUMN IF NOT EXISTS methodology_outside_appetite BOOLEAN;
CREATE UNIQUE INDEX IF NOT EXISTS uq_methodology_scope_version ON risk_methodologies(id, workspace_id, version);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='risks'::regclass AND conname='risk_methodology_scope_fk') THEN
    ALTER TABLE risks ADD CONSTRAINT risk_methodology_scope_fk FOREIGN KEY(methodology_id,workspace_id,methodology_version) REFERENCES risk_methodologies(id,workspace_id,version);
    ALTER TABLE risks ADD CONSTRAINT risk_methodology_pair CHECK ((methodology_id IS NULL) = (methodology_version IS NULL));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_risks_methodology_scope ON risks(workspace_id,methodology_id,methodology_version);
CREATE INDEX IF NOT EXISTS idx_risks_residual_rating ON risks(workspace_id,residual_rating);

CREATE OR REPLACE FUNCTION laflo_legacy_risk_config() RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
SELECT '{"scoringMethod":"multiplication","likelihoodLevels":[{"value":1},{"value":2},{"value":3},{"value":4},{"value":5}],"impactLevels":[{"value":1},{"value":2},{"value":3},{"value":4},{"value":5}],"ratingBands":[{"label":"Low","minScore":1,"maxScore":5},{"label":"Medium","minScore":6,"maxScore":11},{"label":"High","minScore":12,"maxScore":19},{"label":"Critical","minScore":20,"maxScore":25}],"appetiteMaxScore":11,"targetRequired":false}'::jsonb;
$$;
CREATE OR REPLACE FUNCTION laflo_risk_rating(config JSONB, score NUMERIC) RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE answer TEXT; matches INTEGER;
BEGIN
  SELECT COUNT(*), MIN(b->>'label') INTO matches, answer FROM jsonb_array_elements(config->'ratingBands') b
    WHERE score BETWEEN (b->>'minScore')::NUMERIC AND (b->>'maxScore')::NUMERIC;
  IF matches <> 1 THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Rating band not found or overlapping for methodology'; END IF;
  RETURN answer;
END $$;
CREATE OR REPLACE FUNCTION laflo_axis_score(config JSONB, likelihood INTEGER, impact INTEGER) RETURNS INTEGER LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF config->>'scoringMethod' <> 'multiplication' THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Unsupported scoring method'; END IF;
  IF likelihood IS NULL OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(config->'likelihoodLevels') l WHERE (l->>'value')::INTEGER=likelihood)
    THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Invalid likelihood for methodology'; END IF;
  IF impact IS NULL OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(config->'impactLevels') i WHERE (i->>'value')::INTEGER=impact)
    THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Invalid impact for methodology'; END IF;
  RETURN likelihood * impact;
END $$;

CREATE OR REPLACE FUNCTION laflo_pin_risk_methodology() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE method risk_methodologies%ROWTYPE; config JSONB; changed BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Same lock as activation: creation sees exactly one complete policy version.
    PERFORM id FROM workspaces WHERE id=NEW.workspace_id FOR UPDATE;
    SELECT * INTO method FROM risk_methodologies WHERE workspace_id=NEW.workspace_id AND status='Active';
    IF NOT FOUND THEN
      IF current_setting('laflo.legacy_seed', true) IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Risk methodology must be configured before creating risks';
      END IF;
      NEW.methodology_id := NULL; NEW.methodology_version := NULL;
      config := laflo_legacy_risk_config();
    ELSE
      NEW.methodology_id := method.id; NEW.methodology_version := method.version; config := method.config;
    END IF;
    changed := TRUE;
  ELSE
    IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.methodology_id IS DISTINCT FROM OLD.methodology_id OR NEW.methodology_version IS DISTINCT FROM OLD.methodology_version THEN
      RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Risk methodology is pinned; explicit re-score workflow required';
    END IF;
    changed := ROW(NEW.inherent_likelihood,NEW.inherent_impact,NEW.residual_likelihood,NEW.residual_impact,NEW.target_likelihood,NEW.target_impact)
      IS DISTINCT FROM ROW(OLD.inherent_likelihood,OLD.inherent_impact,OLD.residual_likelihood,OLD.residual_impact,OLD.target_likelihood,OLD.target_impact);
    IF NOT changed THEN
      -- Non-scoring updates preserve historical values; client scores are never authoritative.
      NEW.inherent_score := OLD.inherent_score; NEW.inherent_rating := OLD.inherent_rating;
      NEW.residual_score := OLD.residual_score; NEW.residual_rating := OLD.residual_rating;
      NEW.target_score := OLD.target_score; NEW.target_rating := OLD.target_rating;
      NEW.methodology_outside_appetite := OLD.methodology_outside_appetite;
      RETURN NEW;
    END IF;
    IF OLD.methodology_id IS NULL THEN config := laflo_legacy_risk_config();
    ELSE
      SELECT * INTO method FROM risk_methodologies WHERE id=OLD.methodology_id AND workspace_id=OLD.workspace_id AND version=OLD.methodology_version;
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Pinned methodology not found'; END IF;
      config := method.config;
    END IF;
  END IF;
  NEW.inherent_score := laflo_axis_score(config,NEW.inherent_likelihood,NEW.inherent_impact);
  NEW.residual_score := laflo_axis_score(config,NEW.residual_likelihood,NEW.residual_impact);
  NEW.inherent_rating := laflo_risk_rating(config,NEW.inherent_score);
  NEW.residual_rating := laflo_risk_rating(config,NEW.residual_score);
  IF NEW.target_likelihood IS NULL AND NEW.target_impact IS NULL THEN
    IF (config->>'targetRequired')::BOOLEAN THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Target likelihood and impact required by methodology'; END IF;
    NEW.target_score := NULL; NEW.target_rating := NULL;
  ELSE
    NEW.target_score := laflo_axis_score(config,NEW.target_likelihood,NEW.target_impact);
    NEW.target_rating := laflo_risk_rating(config,NEW.target_score);
  END IF;
  NEW.methodology_outside_appetite := NEW.residual_score > (config->>'appetiteMaxScore')::INTEGER;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS risk_methodology_pin ON risks;
CREATE TRIGGER risk_methodology_pin BEFORE INSERT OR UPDATE ON risks FOR EACH ROW EXECUTE FUNCTION laflo_pin_risk_methodology();

CREATE OR REPLACE FUNCTION laflo_freeze_methodology() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.version IS DISTINCT FROM OLD.version THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Methodology version identity is immutable';
  END IF;
  IF OLD.status <> 'Draft' AND (NEW.config IS DISTINCT FROM OLD.config OR NEW.status='Draft') THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Published methodology configuration is immutable';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS methodology_immutable ON risk_methodologies;
CREATE TRIGGER methodology_immutable BEFORE UPDATE ON risk_methodologies FOR EACH ROW EXECUTE FUNCTION laflo_freeze_methodology();

-- Apply after the existing treatment-plan schema; no historical forecasts are changed.
ALTER TABLE risk_treatment_plans ADD COLUMN IF NOT EXISTS expected_residual_rating TEXT;
CREATE OR REPLACE FUNCTION laflo_validate_treatment_forecast() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE risk risks%ROWTYPE; config JSONB;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.risk_id IS DISTINCT FROM OLD.risk_id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
      RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Treatment risk and workspace cannot be changed';
    END IF;
    IF NEW.expected_residual_score IS NOT DISTINCT FROM OLD.expected_residual_score THEN
      NEW.expected_residual_rating := OLD.expected_residual_rating;
      RETURN NEW;
    END IF;
  END IF;
  SELECT * INTO risk FROM risks WHERE id=NEW.risk_id AND workspace_id=NEW.workspace_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Treatment risk not found in workspace'; END IF;
  IF NEW.expected_residual_score IS NULL THEN NEW.expected_residual_rating := NULL; RETURN NEW; END IF;
  IF risk.methodology_id IS NULL THEN config := laflo_legacy_risk_config();
  ELSE
    SELECT m.config INTO config FROM risk_methodologies m WHERE m.id=risk.methodology_id AND m.workspace_id=risk.workspace_id AND m.version=risk.methodology_version;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Pinned methodology not found'; END IF;
  END IF;
  IF NEW.expected_residual_score <> trunc(NEW.expected_residual_score) THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Expected residual after treatment must be an integer';
  END IF;
  NEW.expected_residual_rating := laflo_risk_rating(config,NEW.expected_residual_score);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS treatment_methodology_guard ON risk_treatment_plans;
CREATE TRIGGER treatment_methodology_guard BEFORE INSERT OR UPDATE ON risk_treatment_plans FOR EACH ROW EXECUTE FUNCTION laflo_validate_treatment_forecast();
COMMIT;
