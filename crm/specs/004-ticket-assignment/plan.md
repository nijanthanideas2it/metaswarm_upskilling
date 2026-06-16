# Implementation Plan: Ticket Assignment

**Branch**: `004-ticket-assignment` | **Date**: 2026-06-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-ticket-assignment/spec.md`

## Summary

The Ticket Assignment module adds team-based routing, a rules-based auto-
assignment engine, agent availability management, and a workload visibility
dashboard on top of the basic manual assignment built into `003-ticket-management`.
Rules are evaluated in-process at ticket creation time (synchronous, no external
engine), team members are selected by fewest-open-tickets with join-date
tiebreaker, and availability schedules convert agent local times to UTC for
storage and comparison. The workload dashboard is served on-demand via polling.

## Technical Context

**Language/Version**: Node.js 20 LTS, TypeScript 5.x (strict mode)

**Primary Dependencies**: Express 4.x, Prisma 5.x, zod (request validation),
`luxon` or `date-fns-tz` (timezone conversion for availability schedules)

**Storage**: PostgreSQL 16 (via Prisma ORM)

**Testing**: Jest + Supertest; ≥ 80% coverage (lines + branches)

**Target Platform**: Linux server (same Node.js process as preceding modules)

**Project Type**: Web service (REST API) — backend only for this feature

**Performance Goals**: Auto-assignment completes within 5 s of ticket creation;
workload dashboard loads in ≤ 3 s for up to 500 agents; all CRUD endpoints
p95 ≤ 200 ms

**Constraints**: Constitution p95 ≤ 200 ms; no N+1 queries; RBAC at use-case
layer; OWASP Top 10 per endpoint; rules engine is synchronous (v1);
availability propagation ≤ 30 s after status change

**Scale/Scope**: Single-org deployment; up to 500 agents; up to 50 active
assignment rules; up to 20 teams

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. Clean Architecture | ✅ Pass | `AssignmentRulesEngine` lives in Application layer; Prisma repos in Infrastructure; no cross-layer imports |
| II. TypeScript Standards | ✅ Pass | `strict: true`; const enums for rule condition fields and availability statuses |
| III. Security | ✅ Pass | RBAC at use-case layer; zod at boundary; rule conditions validated on create/update; OWASP reviewed |
| IV. Testing | ✅ Pass | TDD; rules engine unit-tested with mock repo; availability scheduling unit-tested with fixed clock |
| V. Performance | ✅ Pass | Rules loaded once per evaluation (single query); team member selection uses aggregation query; no N+1 |
| VI. API Design Consistency | ✅ Pass | `/api/v1/teams/*`, `/api/v1/assignment-rules/*`, `/api/v1/workload`; uniform envelope |

**Post-Phase 1 re-check**: All gates remain green. Rules engine is a pure
Application-layer class with no Prisma imports — fully unit-testable.

## Project Structure

### Documentation (this feature)

```text
specs/004-ticket-assignment/
├── plan.md                      # This file
├── research.md                  # Phase 0 — design decisions
├── data-model.md                # Phase 1 — Prisma schema
├── quickstart.md                # Phase 1 — validation guide
├── contracts/
│   ├── teams.md                 # Team CRUD + membership endpoints
│   ├── assignment-rules.md      # Assignment rule CRUD + reorder
│   └── workload.md              # Agent workload dashboard endpoint
└── tasks.md                     # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── support-team.entity.ts
│   │   │   └── assignment-rule.entity.ts
│   │   ├── repositories/
│   │   │   ├── support-team.repository.interface.ts
│   │   │   ├── assignment-rule.repository.interface.ts
│   │   │   └── agent-availability.repository.interface.ts
│   │   └── value-objects/
│   │       └── availability-schedule.value-object.ts
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── teams/
│   │   │   │   ├── create-team.use-case.ts
│   │   │   │   ├── get-team.use-case.ts
│   │   │   │   ├── list-teams.use-case.ts
│   │   │   │   ├── update-team.use-case.ts
│   │   │   │   ├── deactivate-team.use-case.ts
│   │   │   │   └── manage-team-members.use-case.ts
│   │   │   ├── rules/
│   │   │   │   ├── create-assignment-rule.use-case.ts
│   │   │   │   ├── update-assignment-rule.use-case.ts
│   │   │   │   ├── delete-assignment-rule.use-case.ts
│   │   │   │   ├── activate-assignment-rule.use-case.ts
│   │   │   │   ├── deactivate-assignment-rule.use-case.ts
│   │   │   │   └── reorder-assignment-rules.use-case.ts
│   │   │   ├── availability/
│   │   │   │   ├── set-availability-status.use-case.ts
│   │   │   │   └── set-availability-schedule.use-case.ts
│   │   │   └── workload/
│   │   │       └── get-workload-summary.use-case.ts
│   │   └── services/
│   │       └── assignment-rules-engine.service.ts
│   ├── infrastructure/
│   │   ├── repositories/
│   │   │   ├── prisma-support-team.repository.ts
│   │   │   ├── prisma-assignment-rule.repository.ts
│   │   │   └── prisma-agent-availability.repository.ts
│   │   └── hooks/
│   │       └── ticket-created.hook.ts
│   └── presentation/
│       └── http/
│           ├── routes/
│           │   ├── teams.routes.ts
│           │   ├── assignment-rules.routes.ts
│           │   ├── agent-availability.routes.ts
│           │   └── workload.routes.ts
│           └── controllers/
│               ├── teams.controller.ts
│               ├── assignment-rules.controller.ts
│               ├── agent-availability.controller.ts
│               └── workload.controller.ts
└── tests/
    ├── unit/
    │   └── use-cases/
    │       ├── rules/
    │       │   └── assignment-rules-engine.test.ts
    │       ├── availability/
    │       │   └── set-availability-status.test.ts
    │       └── teams/
    │           └── manage-team-members.use-case.test.ts
    ├── integration/
    │   └── repositories/
    │       ├── prisma-support-team.repository.test.ts
    │       └── prisma-assignment-rule.repository.test.ts
    └── contract/
        ├── teams.routes.test.ts
        ├── assignment-rules.routes.test.ts
        └── workload.routes.test.ts
```

**Structure Decision**: Backend-only REST API extending the `backend/` workspace.
The rules engine is invoked via a post-ticket-creation hook that the `003-ticket-
management` module calls when `CreateTicketUseCase` completes successfully. This
avoids direct cross-module coupling: the hook is registered at app startup via
dependency injection, not hard-coded in 003.
