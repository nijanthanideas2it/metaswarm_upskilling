# Implementation Plan: Reporting Dashboard

**Branch**: `007-reporting-dashboard` | **Date**: 2026-06-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-reporting-dashboard/spec.md`

## Summary

The Reporting Dashboard module is a read-only analytics layer that aggregates
data from modules 001–006 to produce six report types (operations overview,
ticket volume, agent performance, resolution time, escalation, and customer
activity) plus CSV/PDF exports. Queries use a combination of Prisma `groupBy`
for simple counts and `$queryRaw` parametrised SQL for complex aggregations
(CTEs, `date_trunc`, windowed metrics); a 60-second in-memory TTL cache covers
the operations overview to meet the ≤5 s load target. The only owned entity is
`ReportThresholdConfig` (single-row upsert), which stores configurable resolution
time thresholds per priority level used to highlight at-risk agents and tickets.

## Technical Context

**Language/Version**: Node.js 20 LTS, TypeScript 5.x (strict mode)

**Primary Dependencies**: Express 4.x, Prisma 5.x, zod (request validation),
`csv-stringify` (streaming CSV generation), `pdfkit` (server-side PDF generation)

**Storage**: PostgreSQL 16 (via Prisma ORM); no separate analytics store in v1

**Testing**: Jest + Supertest; ≥ 80% coverage (lines + branches)

**Target Platform**: Linux server (same Node.js process as preceding modules)

**Project Type**: Web service (REST API) — backend only for this feature;
frontend polling is handled by the existing React Native client

**Performance Goals**: Operations overview ≤ 5 s (served from 60 s TTL cache);
any date-range report ≤ 10 s for 10,000 tickets; all threshold CRUD endpoints
p95 ≤ 200 ms; CSV/PDF export ≤ 60 s (408 on timeout)

**Constraints**: Constitution p95 ≤ 200 ms on non-export endpoints; no N+1
queries; parameterised queries only (no string interpolation in raw SQL); RBAC
enforced in route middleware before use case invocation; customers denied access
to all report endpoints; agents restricted to personal summary only; OWASP Top 10
reviewed per endpoint

**Scale/Scope**: Single-org deployment; up to 10,000 tickets per 12-month window;
up to 50 agents in performance report; date range bounded at 365 days

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. Clean Architecture | ✅ Pass | `PrismaReportingQueryRepository` in Infrastructure; use cases in Application; no Prisma imports in Domain; cache lives in Infrastructure/cache |
| II. TypeScript Standards | ✅ Pass | `strict: true`; `const enum` for `ReportType`, `ExportFormat`, `EscalationType`; no `any`; explicit return types on all use-case `execute()` methods |
| III. Security | ✅ Pass | All raw SQL uses `$queryRaw` with Prisma tagged-template (parameterised); role gate middleware fires before use-case invocation; zod validates all query params including date range ≤ 365 days; OWASP reviewed on each route |
| IV. Testing | ✅ Pass | TDD; cache unit-tested with mocked clock; gap-filler unit-tested with known series; repository integration tests against real DB; contract tests for all 11 endpoints |
| V. Performance | ✅ Pass | Operations overview served from 60 s in-memory cache; all aggregations use single CTEs (no N+1); date-range columns indexed in modules 003/005; export streamed row-by-row (csv-stringify) |
| VI. API Design Consistency | ✅ Pass | `/api/v1/reports/*` plural; uniform `{ data, meta, error }` envelope; pagination on volume trend and customer report; export endpoints return binary stream with correct `Content-Disposition` |

**Post-Phase 1 re-check**: All gates remain green. `GetOperationsOverviewUseCase`
is pure Application-layer logic referencing only the `IReportingQueryRepository`
interface — cache is injected via `IOperationsOverviewCache` interface, keeping
the use case unit-testable without the in-memory implementation.

## Project Structure

### Documentation (this feature)

```text
specs/007-reporting-dashboard/
├── plan.md                          # This file
├── research.md                      # Phase 0 — design decisions
├── data-model.md                    # Phase 1 — entity + query specs
├── quickstart.md                    # Phase 1 — validation guide
├── contracts/
│   ├── reports.md                   # All report GET + threshold endpoints
│   └── exports.md                   # CSV and PDF export endpoints
└── tasks.md                         # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   └── report-threshold-config.entity.ts
│   │   ├── repositories/
│   │   │   ├── report-threshold-config.repository.interface.ts
│   │   │   └── reporting-query.repository.interface.ts
│   │   └── value-objects/
│   │       ├── date-range.value-object.ts
│   │       └── report-filters.value-object.ts
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── overview/
│   │   │   │   └── get-operations-overview.use-case.ts
│   │   │   ├── volume/
│   │   │   │   └── get-ticket-volume-report.use-case.ts
│   │   │   ├── performance/
│   │   │   │   ├── get-agent-performance-report.use-case.ts
│   │   │   │   └── get-personal-performance-summary.use-case.ts
│   │   │   ├── resolution/
│   │   │   │   └── get-resolution-time-report.use-case.ts
│   │   │   ├── escalation/
│   │   │   │   └── get-escalation-report.use-case.ts
│   │   │   ├── customer/
│   │   │   │   └── get-customer-activity-report.use-case.ts
│   │   │   ├── threshold/
│   │   │   │   ├── get-report-thresholds.use-case.ts
│   │   │   │   └── update-report-thresholds.use-case.ts
│   │   │   └── export/
│   │   │       ├── export-csv.use-case.ts
│   │   │       └── export-pdf.use-case.ts
│   │   └── services/
│   │       ├── report-threshold-highlighter.service.ts
│   │       └── time-series-gap-filler.service.ts
│   ├── infrastructure/
│   │   ├── repositories/
│   │   │   ├── prisma-report-threshold-config.repository.ts
│   │   │   └── prisma-reporting-query.repository.ts
│   │   ├── cache/
│   │   │   └── operations-overview.cache.ts
│   │   └── export/
│   │       ├── csv-report-generator.service.ts
│   │       └── pdf-report-generator.service.ts
│   └── presentation/
│       └── http/
│           ├── routes/
│           │   └── reports.routes.ts
│           └── controllers/
│               └── reports.controller.ts
└── tests/
    ├── unit/
    │   ├── use-cases/
    │   │   ├── overview/
    │   │   │   └── get-operations-overview.use-case.test.ts
    │   │   ├── volume/
    │   │   │   └── get-ticket-volume-report.use-case.test.ts
    │   │   ├── performance/
    │   │   │   ├── get-agent-performance-report.use-case.test.ts
    │   │   │   └── get-personal-performance-summary.use-case.test.ts
    │   │   ├── resolution/
    │   │   │   └── get-resolution-time-report.use-case.test.ts
    │   │   ├── escalation/
    │   │   │   └── get-escalation-report.use-case.test.ts
    │   │   ├── customer/
    │   │   │   └── get-customer-activity-report.use-case.test.ts
    │   │   └── threshold/
    │   │       └── update-report-thresholds.use-case.test.ts
    │   └── services/
    │       ├── report-threshold-highlighter.service.test.ts
    │       └── time-series-gap-filler.service.test.ts
    ├── integration/
    │   └── repositories/
    │       ├── prisma-reporting-query.repository.test.ts
    │       └── prisma-report-threshold-config.repository.test.ts
    └── contract/
        ├── reports.overview.routes.test.ts
        ├── reports.volume.routes.test.ts
        ├── reports.performance.routes.test.ts
        ├── reports.resolution.routes.test.ts
        ├── reports.escalation.routes.test.ts
        ├── reports.customer.routes.test.ts
        ├── reports.threshold.routes.test.ts
        └── reports.export.routes.test.ts
```

**Structure Decision**: Backend-only REST API extending the existing `backend/`
workspace. All six report types and the threshold configuration are served by a
single `reports.routes.ts` router mounted at `/api/v1/reports`, keeping the
cross-cutting concerns (auth middleware, role gate) in one place. Export
endpoints (`/exports/csv` and `/exports/pdf`) share the same router file but are
documented separately in `contracts/exports.md` because their response type
(binary stream) differs from the standard JSON envelope. The module introduces no
schema migrations to existing tables — only a new `ReportThresholdConfig` table
is added.
