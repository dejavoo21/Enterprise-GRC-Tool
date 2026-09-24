BEGIN;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS risk_methodology_mode TEXT NOT NULL DEFAULT 'legacy'
  CHECK (risk_methodology_mode IN ('legacy','enforced'));
CREATE TABLE IF NOT EXISTS risk_methodology_mode_events (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  actor_id TEXT NOT NULL, previous_mode TEXT NOT NULL, next_mode TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION laflo_pin_risk_methodology() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE method risk_methodologies%ROWTYPE; config JSONB; changed BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Same lock as activation: creation sees exactly one complete policy version.
    PERFORM id FROM workspaces WHERE id=NEW.workspace_id FOR UPDATE;
    SELECT * INTO method FROM risk_methodologies WHERE workspace_id=NEW.workspace_id AND status='Active';
    IF NOT FOUND THEN
      IF (SELECT risk_methodology_mode FROM workspaces WHERE id=NEW.workspace_id) = 'enforced' THEN
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
    IF OLD.methodology_id IS NULL THEN
      PERFORM id FROM workspaces WHERE id=NEW.workspace_id FOR UPDATE;
      IF (SELECT risk_methodology_mode FROM workspaces WHERE id=NEW.workspace_id) = 'enforced' THEN
        RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Legacy risk scoring changes require an explicit migration workflow in enforced mode';
      END IF;
      config := laflo_legacy_risk_config();
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

COMMIT;
