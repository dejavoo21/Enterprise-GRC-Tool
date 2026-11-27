# GitHub Issue #2 Independent Review

## Policy Rule Governance Follow-Up — 27 November 2026

GitHub Issue #2 was updated through the connected GitHub account with the verified offline Policy Rule correction sequence through application commit `9e544c4` and coordination commit `87c1e14`. The completed local workflow covers independently governed submission, return for revision, activation, rejection, revision, withdrawal, active archival and bounded immutable history. Exact application-tree validation passes: backend and frontend production builds; full frontend ESLint; 554 passed, 3 intentional environment-dependent skips and 0 failures across 117 server-free test files; all 67 ordered migration checksums; and whitespace checks. The four PostgreSQL integration files remain explicitly excluded because no disposable database is authorised.

No code was pushed and migration `20261127-governance-policy-rule-approval` remains unexecuted. The exact local candidate remains outside hosted CI and human review, and authenticated cross-user RBAC/segregation, PostgreSQL transition behavior and responsive browser acceptance remain unverified. The promotion classification therefore remains **No-Go**.

## Workflow Role Integrity Follow-Up — 27 November 2026

Application candidate `beb4c6f` closes a source-confirmed Enterprise Workflow defect: template configuration previously accepted arbitrary reviewer and escalation role labels, while assignment acknowledgement authorizes against canonical workspace role keys. A label such as `Risk Manager` could therefore create an assignment that no `grc` member could claim. The workflow builder now offers only the five canonical workspace roles, and backend validation independently rejects non-canonical stage and escalation roles.

Exact application-candidate offline validation passes: backend TypeScript build; frontend TypeScript/production build (236 modules); full frontend ESLint; 542 passed, 3 intentional environment-dependent skips and 0 failures across 117 server-free test files; all 66 ordered migration checksums; and whitespace checks. The focused workflow rules and notification subset passes 29/29. No schema, migration, production data, push, deployment or configuration changed. PostgreSQL persistence, existing-record compatibility and authenticated role-addressed acknowledgement remain unverified. This correction improves the candidate but does not alter the **No-Go** promotion classification or close the exact-SHA CI, human-review, repository-exposure, restore-rehearsal and runtime-acceptance gates.

## Exact-Candidate Offline Follow-Up — 27 November 2026

The current clean local candidate is `ea3d835e1a08224c367536744e012731aa351781`, which is 198 commits ahead of published review head `62da15f72238f5403ff266c01e9064f449ffdcde`. A stale Governance UI test contract was corrected in `ea3d835` so it now verifies canonical RACI Control capture and immutable SoA linked-record capture rather than the removed free-text Control ID path.

Exact-candidate offline validation passes: backend TypeScript build; frontend TypeScript/production build (236 modules); full frontend ESLint; 541 passed, 3 intentional environment-dependent skips and 0 failures across 117 server-free test files; and all 66 ordered migration checksums. Four PostgreSQL integration files were explicitly excluded because no disposable database is authorised. Whitespace checks pass and the worktree is clean.

This evidence closes the local offline-suite gap only. The candidate remains unpublished and is not covered by hosted CI or independent human review. Repository exposure intent, restore rehearsal and authenticated browser/RBAC/PostgreSQL acceptance also remain unresolved. The promotion classification therefore remains **No-Go**.

Review date: 27 November 2026
Repository: `dejavoo21/Enterprise-GRC-Tool`
Reviewed local head: `a721b86db15589cef47289a244b6a0468eb36c75`
Published review head: `62da15f72238f5403ff266c01e9064f449ffdcde`
Production application baseline: `9ebb92546e672a20bc33c76b5cd58dfbb6f01735`

## Decision

**No-Go for promotion of the current local candidate.** The repository contains substantial implemented and offline-validated work, but the exact local head is 174 commits ahead of the published review branch. Hosted CI, pull-request review and production acceptance therefore do not cover the latest candidate.

This review did not push, deploy, execute migrations, modify production data or change repository/Railway configuration.

## Evidence Matrix

| Capability | Implemented | Offline validated | Browser/runtime verified | Production accepted | Evidence and limitation |
| --- | --- | --- | --- | --- | --- |
| Risk dashboards | Yes | Yes | Partial on deployed baseline only | No | Production baseline `9ebb925` was inspected read-only; multi-viewport reference comparison and later local corrections remain unverified. |
| Risk Register, Library, methodology and treatment | Yes | Yes | Partial on deployed baseline | No | Source, focused tests and status records exist; latest local behavior is not deployed or runtime accepted. |
| Risk Operations | Yes | Yes | Partial on deployed baseline only | No | Deployed queues were inspected read-only; later routing and workflow corrections remain local. |
| Controls and Evidence | Yes | Yes | No for latest candidate | No | Server-free tests cover provenance, independent review and workspace validation. Durable private binary storage is intentionally unavailable. |
| Supplier and Contract Management | Yes | Yes | No for latest candidate | No | Canonical lifecycle, questionnaires and incidents are implemented offline; PostgreSQL/RBAC/browser acceptance remains outstanding. |
| Asset Management | Yes | Yes | No for latest candidate | No | Canonical asset lifecycle and relationship integration are present; runtime persistence and visual acceptance remain outstanding. |
| Privacy and Data Governance | Partial | Partial | No | No | DPIA and classification lifecycles exist; additional canonical-link work is currently uncommitted and excluded from this review. No telemetry/DLP claim is made. |
| AI Governance and Data Protection | Partial | Yes for implemented lifecycle | No | No | Inventory/review governance is implemented; live AI monitoring, endpoint telemetry and automated blocking are not configured. |
| Business Continuity | Yes | Yes | No for latest candidate | No | BIA, plan, exercise and corrective-action workflows are implemented; database/runtime acceptance remains outstanding. |
| Regulatory Compliance, RACI and SoA | Yes | Yes | No for latest candidate | No | Governed lifecycle and applicability/responsibility records exist; authenticated PostgreSQL and responsive acceptance remain outstanding. |
| Audit and Corrective Actions | Yes | Yes | No for latest candidate | No | Independent evidence-backed closure is implemented and migration adoption was reconciled; latest application behavior is undeployed. |
| Enterprise workflows and approvals | Yes | Yes | No for latest candidate | No | Dynamic source-module permissions, workspace link validation and activity recording were statically verified. Runtime RBAC acceptance remains outstanding. |
| Reporting and analytics | Partial | Yes for implemented reports | No for latest candidate | No | Governed report generation exists; external distribution and unsupported exports remain intentionally unavailable. |
| Migration architecture | Yes | Yes and production reconciled | Production schema verified | Accepted for completed migration event only | The 66-entry production reconciliation completed previously. This does not establish acceptance of the later application candidate. |

## Findings

### P0 - The latest candidate is outside the independent-review and hosted-CI boundary

- Local head `a721b86` is 174 commits ahead of published branch `62da15f`.
- Pull request #1 contains 407 files and 715 commits, has no human review, and targets the older published head.
- Hosted run `45882337430` passed on `62da15f`, not on the current local head.

**Reproduce:** compare `git rev-list --left-right --count origin/codex/enterprise-integration...HEAD`, the PR head SHA and the hosted run head SHA.

**Required correction:** form a bounded candidate, publish it only with explicit authorization, run hosted CI on that exact SHA, and obtain independent review before any `main` or deployment decision.

### Accepted residual risk - Public repository and historical metadata

- GitHub repository metadata was rechecked through the connected account on 27 November 2026 and reports `visibility: public`.
- Historical tracked release/status documents included production service identifiers, a database identity, catalog fingerprints, and local backup filename/checksum metadata. Commit `13fd065` removes the identified values from the current tree and replaces the reconciliation-test identity with an explicit synthetic UUID; historical copies remain in Git history.
- The current-tree zero-match gate covers all known operational values, and 21/21 migration manifest/reconciliation tests pass after the redaction.
- A focused working-tree credential scan found no confirmed live secret; matches were placeholders, fixtures, local defaults or runtime token handling.
- On 27 November 2026 the owner approved continued public visibility and accepted the residual risk of the identified historical operational metadata remaining accessible. This approval does not authorize a history rewrite, repository-setting change, push, deployment or production operation.

**Reproduce:** inspect repository visibility and Git history for the previously recorded production service identifier, database identity, catalog fingerprints and backup metadata.

**Disposition:** no history remediation is currently required. Any future decision to make the repository private or rewrite history remains a separate consequential change requiring explicit authorization.

### P1 - Recovery evidence is incomplete

- The production backup is checksum verified.
- A full restore has not been tested.

**Risk:** backup integrity does not prove recoverability or recovery time.

**Required correction:** conduct an authorised restore rehearsal in an approved isolated environment before the next consequential production change. No infrastructure was created by this review.

### P1 - The current pull request is too broad for effective independent acceptance

- PR #1 spans 407 files and 715 commits.
- It has zero reviewer decisions.

**Required correction:** split or present bounded review batches with module-specific evidence and explicit acceptance criteria. Preserve migration provenance and do not rewrite shared history.

### P1 - Browser, responsive, RBAC and PostgreSQL application acceptance is incomplete

- Status records consistently distinguish offline validation from runtime proof.
- Latest local module implementations are not deployed.
- Multi-viewport authenticated comparison, negative RBAC flows and PostgreSQL persistence checks remain incomplete for the latest candidate.

**Required correction:** after exact-SHA CI and independent review, request controlled deployment authorization and execute the documented authenticated acceptance matrix without modifying genuine business records.

### P2 - Backup/configuration artifacts were not blocked by repository hygiene rules

- `backend/pg_hba.conf.backup` was tracked but unused and contained a generic PostgreSQL sample configuration.
- Follow-up inspection found a second unused tracked variant, `backend/pg_hba.conf.new`, containing permissive local `trust` rules.
- `.gitignore` did not exclude common backup/dump artifacts.

**Offline correction:** commits `7ca6f71` and `4e36108` remove both unused files from the current tree and ignore `*.backup`, `*.dump`, `*.bak` and `pg_hba.conf.*`. A resulting-index check confirms zero tracked matching artifacts. This does not remove historical copies from Git; history rewriting remains outside the authorised scope.

## Authorization Review

Static inspection found that enterprise workflow creation, submission and decisions resolve the workflow source module and apply the corresponding `create`, `edit` or `approve` permission. Source records, evidence and assignees are checked against the authenticated workspace. No permission bypass was established by this review.

This is static evidence only. It is not equivalent to authenticated runtime or PostgreSQL integration testing.

## Smallest Safe Next Batch

1. Obtain explicit authorization to publish the bounded exact candidate, then run hosted CI on that exact SHA.
2. Obtain an independent human review before any `main` or deployment decision.
3. Request authorization to push only that exact SHA to the review branch.
4. Require hosted CI, secret scanning and an independent reviewer decision on the exact SHA.
5. Only then request a separate `main` and Railway deployment decision for authenticated browser/RBAC/runtime acceptance.

## Verification Classification

- **Verified through static analysis:** Git/PR/CI SHA boundaries, repository visibility, tracked operational metadata, dynamic workflow permissions, workspace validation, tracked backup artifact.
- **Verified through offline tests:** prior module-specific results recorded in project status; hosted CI on `62da15f` only.
- **Verified through production/runtime checks:** prior migration reconciliation and limited read-only dashboard inspection on `9ebb925` only.
- **Not verified:** exact local head hosted CI, latest-candidate browser/RBAC/PostgreSQL behavior, full responsive visual acceptance, backup restoration, production acceptance of later application work.

## AI-Assisted Follow-Up - Policy Rule Decision Independence

Issue #2 authorised an AI-assisted review of the exact published candidate and offline corrections for confirmed defects. This review identified a segregation-of-duties bypass in the governed Policy Rule lifecycle: after rejection, a different editor could revise and submit a rule while the decision guard continued to compare only the original creator. The revising/submitting user could therefore decide the subsequent review.

Commit `927155e` (`Enforce independent policy rule decisions`) corrects the defect by recording the current revision author and rejecting a pending-review decision by either the current revision author or the submitting user. An independent reviewer remains permitted. The correction changes no schema or migration.

Validation: 11/11 focused Policy Rule and Governance Document authorization tests pass; backend TypeScript build passes; all 117 permitted server-free backend test files pass in four bounded batches; whitespace and added-line credential checks pass. The four PostgreSQL-dependent integration files remain excluded under the no-database constraint.

Classification: verified through static analysis and server-free tests only. Authenticated RBAC, PostgreSQL transaction behavior and browser workflow acceptance remain unverified. This AI-assisted review is not an independent human approval. Commit `927155e` is local and unpushed; the published review candidate remains `8ea6c7d7d949b750b7ae584e5ef038af8e7b6e2a`.
