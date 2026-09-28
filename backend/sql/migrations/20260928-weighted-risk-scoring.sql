BEGIN;

ALTER TABLE risks
  ALTER COLUMN inherent_likelihood DROP NOT NULL,
  ALTER COLUMN inherent_impact DROP NOT NULL,
  ALTER COLUMN residual_likelihood DROP NOT NULL,
  ALTER COLUMN residual_impact DROP NOT NULL,
  ALTER COLUMN inherent_score TYPE NUMERIC(12,4),
  ALTER COLUMN residual_score TYPE NUMERIC(12,4),
  ALTER COLUMN target_score TYPE NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS inherent_factors JSONB,
  ADD COLUMN IF NOT EXISTS residual_factors JSONB,
  ADD COLUMN IF NOT EXISTS target_factors JSONB;

ALTER TABLE risk_treatment_plans
  ADD COLUMN IF NOT EXISTS expected_residual_factors JSONB,
  ADD COLUMN IF NOT EXISTS target_factors JSONB;

CREATE OR REPLACE FUNCTION laflo_weighted_score(config JSONB, factor_values JSONB) RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE factor JSONB; raw NUMERIC; total NUMERIC := 0; enabled_count INTEGER := 0;
BEGIN
  IF config->>'scoringMethod' <> 'weighted' THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Weighted scoring configuration required'; END IF;
  IF factor_values IS NULL OR jsonb_typeof(factor_values) <> 'object' THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Weighted factor scores are required'; END IF;
  FOR factor IN SELECT item FROM jsonb_array_elements(config->'weightedFactors') AS factors(item) LOOP
    IF COALESCE((factor->>'enabled')::BOOLEAN, TRUE) THEN
      enabled_count := enabled_count + 1;
      IF NOT factor_values ? (factor->>'key') THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Missing weighted factor score: ' || (factor->>'label'); END IF;
      raw := (factor_values->>(factor->>'key'))::NUMERIC;
      IF raw < (factor->>'minScore')::NUMERIC OR raw > (factor->>'maxScore')::NUMERIC THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Weighted factor score outside configured range: ' || (factor->>'label');
      END IF;
      total := total + raw * (factor->>'weight')::NUMERIC / 100;
    END IF;
  END LOOP;
  IF enabled_count = 0 THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Weighted methodology has no enabled factors'; END IF;
  -- Weighted bands use one-decimal boundaries; persist the governed score at
  -- the same precision so every valid score maps to exactly one band.
  RETURN ROUND(total, 1);
END $$;

CREATE OR REPLACE FUNCTION laflo_validate_treatment_forecast() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE risk risks%ROWTYPE; config JSONB; weighted BOOLEAN;
BEGIN
  IF TG_OP='UPDATE' AND (NEW.risk_id IS DISTINCT FROM OLD.risk_id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id) THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Treatment risk and workspace cannot be changed';
  END IF;
  SELECT * INTO risk FROM risks WHERE id=NEW.risk_id AND workspace_id=NEW.workspace_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Treatment risk not found in workspace'; END IF;
  IF risk.methodology_id IS NULL THEN config := laflo_legacy_risk_config(); ELSE
    SELECT m.config INTO config FROM risk_methodologies m WHERE m.id=risk.methodology_id AND m.workspace_id=risk.workspace_id AND m.version=risk.methodology_version;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Pinned methodology not found'; END IF;
  END IF;
  weighted := config->>'scoringMethod' = 'weighted';
  IF weighted AND NEW.expected_residual_factors IS NOT NULL THEN
    NEW.expected_residual_score := laflo_weighted_score(config, NEW.expected_residual_factors);
  ELSIF weighted AND NEW.expected_residual_score IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Expected residual weighted factors are required';
  ELSIF NOT weighted AND NEW.expected_residual_score IS NOT NULL AND NEW.expected_residual_score <> trunc(NEW.expected_residual_score) THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Expected residual after treatment must be an integer';
  END IF;
  NEW.expected_residual_rating := CASE WHEN NEW.expected_residual_score IS NULL THEN NULL ELSE laflo_risk_rating(config,NEW.expected_residual_score) END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS treatment_methodology_guard ON risk_treatment_plans;
CREATE TRIGGER treatment_methodology_guard BEFORE INSERT OR UPDATE ON risk_treatment_plans FOR EACH ROW EXECUTE FUNCTION laflo_validate_treatment_forecast();

CREATE OR REPLACE FUNCTION laflo_pin_risk_methodology() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE method risk_methodologies%ROWTYPE; config JSONB; changed BOOLEAN; weighted BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM id FROM workspaces WHERE id=NEW.workspace_id FOR UPDATE;
    SELECT * INTO method FROM risk_methodologies WHERE workspace_id=NEW.workspace_id AND status='Active';
    IF NOT FOUND THEN
      IF (SELECT risk_methodology_mode FROM workspaces WHERE id=NEW.workspace_id) = 'enforced' THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Risk methodology must be configured before creating risks'; END IF;
      NEW.methodology_id := NULL; NEW.methodology_version := NULL; config := laflo_legacy_risk_config();
    ELSE NEW.methodology_id := method.id; NEW.methodology_version := method.version; config := method.config; END IF;
    changed := TRUE;
  ELSE
    IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.methodology_id IS DISTINCT FROM OLD.methodology_id OR NEW.methodology_version IS DISTINCT FROM OLD.methodology_version THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Risk methodology is pinned; explicit re-score workflow required'; END IF;
    changed := ROW(NEW.inherent_likelihood,NEW.inherent_impact,NEW.residual_likelihood,NEW.residual_impact,NEW.target_likelihood,NEW.target_impact,NEW.inherent_factors,NEW.residual_factors,NEW.target_factors)
      IS DISTINCT FROM ROW(OLD.inherent_likelihood,OLD.inherent_impact,OLD.residual_likelihood,OLD.residual_impact,OLD.target_likelihood,OLD.target_impact,OLD.inherent_factors,OLD.residual_factors,OLD.target_factors);
    IF NOT changed THEN
      NEW.inherent_score:=OLD.inherent_score; NEW.inherent_rating:=OLD.inherent_rating; NEW.residual_score:=OLD.residual_score; NEW.residual_rating:=OLD.residual_rating;
      NEW.target_score:=OLD.target_score; NEW.target_rating:=OLD.target_rating; NEW.methodology_outside_appetite:=OLD.methodology_outside_appetite; RETURN NEW;
    END IF;
    IF OLD.methodology_id IS NULL THEN
      PERFORM id FROM workspaces WHERE id=NEW.workspace_id FOR UPDATE;
      IF (SELECT risk_methodology_mode FROM workspaces WHERE id=NEW.workspace_id) = 'enforced' THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Legacy risk scoring changes require an explicit migration workflow in enforced mode';
      END IF;
      config := laflo_legacy_risk_config();
    ELSE
      SELECT * INTO method FROM risk_methodologies WHERE id=OLD.methodology_id AND workspace_id=OLD.workspace_id AND version=OLD.methodology_version;
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Pinned methodology not found'; END IF; config := method.config;
    END IF;
  END IF;
  weighted := config->>'scoringMethod' = 'weighted';
  IF weighted THEN
    NEW.inherent_score:=laflo_weighted_score(config,NEW.inherent_factors); NEW.residual_score:=laflo_weighted_score(config,NEW.residual_factors);
    IF NEW.target_factors IS NULL THEN
      IF (config->>'targetRequired')::BOOLEAN THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Target weighted factors required by methodology'; END IF;
      NEW.target_score:=NULL; NEW.target_rating:=NULL;
    ELSE NEW.target_score:=laflo_weighted_score(config,NEW.target_factors); NEW.target_rating:=laflo_risk_rating(config,NEW.target_score); END IF;
  ELSE
    NEW.inherent_score:=laflo_axis_score(config,NEW.inherent_likelihood,NEW.inherent_impact); NEW.residual_score:=laflo_axis_score(config,NEW.residual_likelihood,NEW.residual_impact);
    IF NEW.target_likelihood IS NULL AND NEW.target_impact IS NULL THEN
      IF (config->>'targetRequired')::BOOLEAN THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Target likelihood and impact required by methodology'; END IF;
      NEW.target_score:=NULL; NEW.target_rating:=NULL;
    ELSE NEW.target_score:=laflo_axis_score(config,NEW.target_likelihood,NEW.target_impact); NEW.target_rating:=laflo_risk_rating(config,NEW.target_score); END IF;
  END IF;
  NEW.inherent_rating:=laflo_risk_rating(config,NEW.inherent_score); NEW.residual_rating:=laflo_risk_rating(config,NEW.residual_score);
  NEW.methodology_outside_appetite:=NEW.residual_score > (config->>'appetiteMaxScore')::NUMERIC;
  RETURN NEW;
END $$;

-- No existing row is updated or recalculated. Factor snapshots are populated only by explicit future writes.
COMMIT;
