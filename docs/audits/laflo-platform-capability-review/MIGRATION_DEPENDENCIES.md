# Migration Dependencies

## Ordered graph

```text
Legacy baseline
  workspaces ─┬─> risk methodologies ─> version pinning ─> tenant rollout
              ├─> risk reports/evidence ─> risk actions
              └─> risk library
  risks ─> CIA ─> treatment lifecycle ─> treatment plans ─> treatment/control links
  controls ────────────────────────────────────────────────┘
  evidence ─> risk report/evidence workflows
  governance_documents + review_tasks
      ─> governance compatibility ─> governance constraints

Manifest chain
  CIA -> lifecycle -> plans -> control links -> methodologies -> pinning
  -> rollout -> references -> report/evidence -> actions -> library
  -> weighted scoring -> governance compatibility -> governance constraints
```

The linear manifest is deliberately stricter than filename sorting. It supplies a deterministic release order while documenting baseline prerequisites that are not yet managed by the manifest.

## Key findings

1. `20260927-risk-library.sql` was absent from the old hard-coded runner even though later migrations were present. Runtime `ensureRiskLibrarySchema` concealed this gap.
2. The old runner executed `ensureRiskIntelligenceSchema` and `ensureRiskTreatmentSchema` before consulting its ledger. Schema could therefore change without a ledger entry.
3. Application startup invokes at least 17 untracked `ensure*Schema` functions. Their order is coded in `index.ts`, not represented as migration dependencies.
4. Legacy schema files overlap runtime DDL for core risk, framework scope, assets, authentication, regulatory, and governance objects.
5. `schema-core-grc.sql`, `schema-frameworks.sql`, and `schema-governance-review.sql` contain indexes without `IF NOT EXISTS`; they are not safely replayable as complete files.
6. The Risk Ref migration contains a data backfill. Its lock duration, collision behavior, and production volume effects are not verified offline.
7. Functions and triggers used for methodology pinning and weighted scoring depend on compatible columns and constraints created by earlier migrations.
8. Governance constraints correctly depend on the compatibility migration, but unknown deployed data may still violate new constraints.

## Schema inconsistencies and conflicts

- Schema ownership is split between SQL files and TypeScript repositories, making the authoritative definition ambiguous.
- The existing ledger historically stored only a migration name and timestamp. It cannot prove which SQL content was applied.
- Migration names were stored with `.sql`, while stable manifest IDs omit the suffix. The runner normalizes legacy names for comparison.
- Several relationship concepts use JSON arrays while others use join tables. This is a data-model concern for future Relationship Intelligence, not a reason to rewrite history.
- `CREATE TABLE IF NOT EXISTS` can hide incompatible existing columns; it is not drift detection.
- No static evidence proves production has the same constraints, indexes, functions, triggers, or migration sequence as the repository.
- Runtime DDL can make a partially migrated database appear healthy while leaving its history unreproducible.

## Cycles and destructive operations

No direct cycle was identified in the 14-file manifest. The static destructive scan found no `DROP TABLE`, `DROP COLUMN`, or `TRUNCATE` in those files. Trigger and constraint drops are compatibility replacements and require controlled runtime review. The standalone cleanup utility drops workspace foreign-key constraints and is explicitly outside the manifest.

## Index readiness

The future canonical relationship model requires tenant-leading indexes for forward and reverse traversal, uniqueness on active relationships, and indexed provenance/event history. Existing module-specific links do not provide one consistent cross-domain traversal index. Index effectiveness and missing-index claims require PostgreSQL query-plan validation and remain unverified.
