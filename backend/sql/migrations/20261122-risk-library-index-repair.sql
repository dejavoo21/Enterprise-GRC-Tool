DO $$
DECLARE
  existing_index RECORD;
  index_columns TEXT[];
  index_predicate TEXT;
BEGIN
  IF to_regclass('public.risks') IS NULL THEN
    RAISE EXCEPTION 'Risk Library repair requires public.risks';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='risks' AND column_name='workspace_id' AND data_type='text') THEN
    RAISE EXCEPTION 'Risk Library repair requires risks.workspace_id TEXT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='risks' AND column_name='library_risk_id' AND data_type='text') THEN
    RAISE EXCEPTION 'Risk Library repair requires risks.library_risk_id TEXT';
  END IF;

  SELECT i.indrelid, i.indkey, i.indpred, i.indisvalid
    INTO existing_index
    FROM pg_index i
    JOIN pg_class index_class ON index_class.oid=i.indexrelid
    JOIN pg_namespace namespace ON namespace.oid=index_class.relnamespace
   WHERE namespace.nspname='public' AND index_class.relname='idx_risks_workspace_library_source';

  IF FOUND THEN
    SELECT array_agg(attribute.attname ORDER BY key_position.ordinality)
      INTO index_columns
      FROM unnest(existing_index.indkey::smallint[]) WITH ORDINALITY AS key_position(attnum, ordinality)
      JOIN pg_attribute attribute ON attribute.attrelid=existing_index.indrelid AND attribute.attnum=key_position.attnum;
    SELECT regexp_replace(pg_get_expr(existing_index.indpred, existing_index.indrelid), '[()[:space:]]', '', 'g') INTO index_predicate;
    IF existing_index.indrelid <> 'public.risks'::regclass
       OR index_columns <> ARRAY['workspace_id','library_risk_id']::TEXT[]
       OR lower(index_predicate) <> 'library_risk_idisnotnull'
       OR NOT existing_index.indisvalid THEN
      RAISE EXCEPTION 'Existing idx_risks_workspace_library_source has an incompatible signature';
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_risks_workspace_library_source
  ON risks (workspace_id, library_risk_id)
  WHERE library_risk_id IS NOT NULL;
