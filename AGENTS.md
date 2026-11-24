# LAFLO Enterprise GRC Working Instructions

This file is the persistent operating context for development in this repository. Read it together with `docs/development/LAFLO_PROJECT_STATUS.md`, `docs/development/LAFLO_TASK_QUEUE.md`, and the current Git/worktree state before each task.

## Delivery Standard

- Reuse existing routes, repositories, services, components, permissions, schemas, and design patterns before adding parallel implementations.
- Implement approved work rather than repeatedly producing plans or audits.
- A feature is not complete until its required frontend, backend, persistence, workspace scope, RBAC, audit history, and focused tests are addressed.
- Treat earlier prompts and documents as requirements or evidence, not proof that code was implemented, committed, pushed, migrated, or deployed.
- Prefer narrowly scoped, independently validated changes and explicit file staging.

## UI/UX Delivery Standard

- Read `docs/design/LAFLO_UI_UX_STANDARD.md` before creating or materially changing a frontend module.
- Preserve the accepted Risk Intelligence and Risk Operations visual direction: light enterprise surfaces, blue/indigo accents, compact icon-led metrics, refined cards, clear hierarchy, professional tables, and restrained status colour.
- Reuse the existing theme tokens and shared components before adding CSS or components. Extend the current component system rather than creating a parallel library.
- Every changed module must provide functional navigation and actions, accessible labelled controls, visible keyboard focus, responsive layouts, and truthful loading, empty, error, unavailable, and success states.
- Do not add decorative or placeholder controls. A visible action must work, be disabled with an explanation, or be omitted.
- Avoid page-level horizontal overflow, unnecessary nested scrolling, excessive empty space, inconsistent card geometry, and permanently open empty detail panels.
- Treat UI/UX as part of completion. Compilation and static CSS review prove implementation only; visual verification requires browser rendering at the required viewports, and production acceptance requires separately authorised production evidence.
- Preserve business logic, workspace isolation, RBAC, audit history, relationships, scoring, persisted data, and approved workflows while modernising presentation.

## Repository Safety

- Inspect `git status`, the current branch, relevant history, and all worktrees before editing.
- Preserve unrelated tracked and untracked work. Never reset, discard, stash, overwrite, mass-format, or clean changes that are outside the current scope.
- The primary checkout may be dirty. Use an existing suitable clean worktree, or create an isolated worktree when needed.
- Do not use `git add .` or `git add -A`. Stage only explicitly reviewed files or hunks.
- Do not force-push, rewrite history, or amend commits unless the user explicitly requests it.

## Development Constraints

- Do not start local frontend, backend, development, or preview servers.
- Do not provision or start PostgreSQL, Docker, disposable databases, hosted test environments, or additional paid infrastructure.
- Permitted validation includes TypeScript compilation, production builds, ESLint, static checks, server-free unit tests, mocked authorization tests, migration-manifest validation, whitespace checks, and focused secret scans.
- Never describe static or mocked validation as PostgreSQL integration or runtime verification.
- Do not fabricate controls, evidence, relationships, owners, scores, production records, or provider results. Use truthful unavailable states.

## Production Controls

Explicit user authorization is required before any of the following:

- Pushes or remote branch updates.
- Railway deployments, restarts, or configuration changes.
- Production database writes, migrations, attestations, identity registration, or data changes.
- Destructive or irreversible operations.
- New external services, credentials, permissions, or costs.

A drafted requirement, general instruction to continue, or prior approval for a different release is not authorization for a new production operation.

## Task Loop

1. Read this file, the project status, the task queue, and current Git/worktree state.
2. Select the highest-priority approved task whose dependencies are satisfied.
3. State the concrete implementation objective and its offline proof command.
4. Implement in a safe worktree, preserving existing behavior and tenant isolation.
5. Run the narrowest relevant validation, then the repository-safe build/lint checks.
6. Review the scoped diff and whitespace.
7. Update both development registers with exact files, commit SHA when committed, validation evidence, deployment state, and remaining limitations.
8. Request authorization only when a genuine external or production gate is reached.

## Source Of Truth

- Git and current source code establish implementation state.
- `origin/main` establishes the pushed GitHub baseline after a fetch.
- Railway deployment state must be verified independently; a pushed commit is not automatically deployed.
- Migration files and the deterministic manifest establish intended schema, not proof of execution.
- The two development registers are living coordination aids and must be corrected when newer evidence supersedes them.
