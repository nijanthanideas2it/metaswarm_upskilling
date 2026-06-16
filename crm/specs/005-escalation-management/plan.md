# Implementation Plan: Escalation Management

**Branch**: `005-escalation-management` | **Date**: 2026-06-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-escalation-management/spec.md`

## Summary

The Escalation Management module adds policy-driven, automated ticket escalation
on top of the ticket and assignment infrastructure from modules 003 and 004. A
scheduled `node-cron` job fires every 15 minutes, invoking
`EvaluateEscalationPoliciesUseCase` which loads all active policies, matches
them against open tickets by scope, evaluates unfired tiers' time conditions in
the application layer, and emits structured notification events to the Notifications
module. Manual escalation is available to agents (own tickets only) and
managers/admins (any ticket); de-escalation is restricted to managers and admins
and requires a resolution note. All escalation and de-escalation events are
persisted as immutable audit records and written to the ticket activity log within
the same Prisma transaction.

## Technical Context

**Language/Version**: Node.js 20 LTS, TypeScript 5.x (strict mode)

**Primary Dependencies**: Express 4.x, Prisma 5.x, zod (request validation),
`node-cron` (scheduled job), `date-fns` (duration arithmetic in evaluation logic)

**Storage**: PostgreSQL 16 (via Prisma ORM); PostgreSQL integer array (`Int[]`)
used for `TicketPolicyEscalationState.firedTierOrdinals`

**Testing**: Jest + Supertest; ≥ 80% coverage (lines + branches)

**Target Platform**: Linux server (same Node.js process as preceding modules)

**Project Type**: Web service (REST API) + background scheduler — backend only
for this feature

**Performance Goals**: Evaluation cycle ≤ 15 min interval; escalation actions
execute within 5 min of threshold detection; escalated ticket queue loads in
≤ 3 s for 500 escalated tickets; audit log queries ≤ 5 s over 12 months of
history; all CRUD endpoints p95 ≤ 200 ms

**Constraints**: Constitution p95 ≤ 200 ms; no N+1 queries; RBAC enforced in
use-case layer; OWASP Top 10 per endpoint; scheduler is thin wrapper only —
evaluation logic lives entirely in the use case; notifications delegated to
Notifications module (not sent directly); deactivated-user targets skipped and
skip logged

**Scale/Scope**: Single-org deployment; up to 50 active escalation policies; up
to 5 tiers per policy; up to 500 concurrently escalated tickets

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. Clean Architecture | ✅ Pass | `EvaluateEscalationPoliciesUseCase` in Application layer; `EscalationEvaluationJob` in Infrastructure as thin cron wrapper; Prisma repos in Infrastructure; zero cross-layer imports |
| II. TypeScript Standards | ✅ Pass | `strict: true`; `const enum` for `TriggerCondition`, `ActionType`, `EscalationEventType`; no `any`; explicit return types on all use cases and repo interfaces |
| III. Security | ✅ Pass | RBAC in use-case layer (agent ownership check, manager/admin gates); zod validation at all HTTP boundaries; parameterized queries only via Prisma; OWASP reviewed per endpoint |
| IV. Testing | ✅ Pass | TDD; evaluation logic unit-tested with mock clock and in-memory repos; integration tests against real DB; API contract tests for all routes; ≥ 80% coverage |
| V. Performance | ✅ Pass | Policies loaded once per evaluation run (single query); per-policy ticket match via scoped DB query; no N+1; `isEscalated` + `escalatedAt` updated within the EscalationEvent creation transaction; dedicated composite indexes on all filter/sort columns |
| VI. API Design Consistency | ✅ Pass | `/api/v1/escalation-policies/*`, `/api/v1/tickets/:id/escalation/*`, `/api/v1/escalation-audit`; uniform `{ data, meta, error }` envelope; plural nouns |

**Post-Phase 1 re-check**: All gates remain green. `EvaluateEscalationPoliciesUseCase`
is a pure Application-layer class — receives injected repos and `NotificationService`
interface, no direct Prisma imports, fully unit-testable. Cron job is a three-line
Infrastructure wrapper that calls the use case.

## Project Structure

### Documentation (this feature)

```text
specs/005-escalation-management/
├── plan.md                          # This file
├── research.md                      # Phase 0 — design decisions
├── data-model.md                    # Phase 1 — Prisma schema delta + new entities
├── quickstart.md                    # Phase 1 — validation guide
├── contracts/
│   ├── escalation-policies.md       # Policy + tier + action CRUD
│   ├── ticket-escalation.md         # Manual escalate, de-escalate, ticket state
│   └── escalation-audit.md          # System-wide audit log + per-ticket history
└── tasks.md                         # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── escalation-policy.entity.ts
│   │   │   ├── escalation-tier.entity.ts
│   │   │   ├── escalation-action.entity.ts
│   │   │   ├── escalation-event.entity.ts
│   │   │   ├── escalation-event-target.entity.ts
│   │   │   ├── ticket-policy-escalation-state.entity.ts
│   │   │   └── de-escalation-event.entity.ts
│   │   ├── repositories/
│   │   │   ├── escalation-policy.repository.interface.ts
│   │   │   ├── escalation-event.repository.interface.ts
│   │   │   └── ticket-policy-escalation-state.repository.interface.ts
│   │   └── value-objects/
│   │       └── escalation-scope.value-object.ts
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── escalation-policies/
│   │   │   │   ├── create-escalation-policy.use-case.ts
│   │   │   │   ├── get-escalation-policy.use-case.ts
│   │   │   │   ├── list-escalation-policies.use-case.ts
│   │   │   │   ├── update-escalation-policy.use-case.ts
│   │   │   │   ├── activate-escalation-policy.use-case.ts
│   │   │   │   ├── deactivate-escalation-policy.use-case.ts
│   │   │   │   └── delete-escalation-policy.use-case.ts
│   │   │   ├── tiers/
│   │   │   │   ├── add-escalation-tier.use-case.ts
│   │   │   │   ├── update-escalation-tier.use-case.ts
│   │   │   │   └── remove-escalation-tier.use-case.ts
│   │   │   ├── ticket-escalation/
│   │   │   │   ├── manual-escalate-ticket.use-case.ts
│   │   │   │   └── de-escalate-ticket.use-case.ts
│   │   │   ├── evaluation/
│   │   │   │   └── evaluate-escalation-policies.use-case.ts
│   │   │   └── audit/
│   │   │       └── get-escalation-audit-log.use-case.ts
│   │   └── services/
│   │       └── notification.service.interface.ts
│   ├── infrastructure/
│   │   ├── repositories/
│   │   │   ├── prisma-escalation-policy.repository.ts
│   │   │   ├── prisma-escalation-event.repository.ts
│   │   │   └── prisma-ticket-policy-escalation-state.repository.ts
│   │   └── jobs/
│   │       └── escalation-evaluation.job.ts
│   └── presentation/
│       └── http/
│           ├── routes/
│           │   ├── escalation-policies.routes.ts
│           │   ├── ticket-escalation.routes.ts
│           │   └── escalation-audit.routes.ts
│           └── controllers/
│               ├── escalation-policies.controller.ts
│               ├── ticket-escalation.controller.ts
│               └── escalation-audit.controller.ts
└── tests/
    ├── unit/
    │   └── use-cases/
    │       ├── evaluation/
    │       │   └── evaluate-escalation-policies.test.ts
    │       ├── ticket-escalation/
    │       │   ├── manual-escalate-ticket.test.ts
    │       │   └── de-escalate-ticket.test.ts
    │       └── escalation-policies/
    │           └── create-escalation-policy.test.ts
    ├── integration/
    │   └── repositories/
    │       ├── prisma-escalation-policy.repository.test.ts
    │       ├── prisma-escalation-event.repository.test.ts
    │       └── prisma-ticket-policy-escalation-state.repository.test.ts
    └── contract/
        ├── escalation-policies.routes.test.ts
        ├── ticket-escalation.routes.test.ts
        └── escalation-audit.routes.test.ts
```

**Structure Decision**: Backend-only REST API + background scheduler extending
the existing `backend/` workspace. The scheduler (`EscalationEvaluationJob`) is
a thin Infrastructure wrapper registered at app startup via dependency injection;
it holds no evaluation logic — all logic lives in `EvaluateEscalationPoliciesUseCase`.
The `Ticket.isEscalated` boolean field already exists from module 003; this module
adds a migration that appends `escalatedAt DateTime?` to the same model and
defines five new escalation-specific models. No modification to module 003 or 004
source files is required — escalation writes back to the Ticket table through the
existing `ITicketRepository` interface, accessing only the fields it owns
(`isEscalated`, `escalatedAt`, `priority`).
