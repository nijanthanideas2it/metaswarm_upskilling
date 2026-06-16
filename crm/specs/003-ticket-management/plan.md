# Implementation Plan: Ticket Management

**Branch**: `003-ticket-management` | **Date**: 2026-06-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-ticket-management/spec.md`

## Summary

The Ticket Management module is the operational core of the ServiceDesk CRM.
It owns the full ticket lifecycle — creation, status transitions, assignment,
commenting, file attachments, and automatic closure — and exposes the concrete
`ITicketSummaryService` implementation that `002-customer-management` stubs
in its v1 build. The module enforces a strict status state machine, role-based
visibility of internal notes, atomic concurrent self-assignment, and an append-
only activity log for every state change. File attachments bypass the Node.js
process via S3 presigned URLs.

## Technical Context

**Language/Version**: Node.js 20 LTS, TypeScript 5.x (strict mode)

**Primary Dependencies**: Express 4.x, Prisma 5.x, zod (request validation),
AWS SDK v3 / S3-compatible client (presigned URLs for attachments)

**Storage**: PostgreSQL 16 (via Prisma ORM); PostgreSQL sequence for atomic
ticket reference number generation

**Testing**: Jest + Supertest; ≥ 80% coverage (lines + branches)

**Target Platform**: Linux server (same Node.js process as 001 and 002)

**Project Type**: Web service (REST API) — backend only for this feature

**Performance Goals**: All CRUD endpoints p95 ≤ 200 ms; attachment presigned
URL generation ≤ 200 ms; file upload (client → S3) ≤ 30 s (external)

**Constraints**: Constitution p95 ≤ 200 ms; pagination default 20 / max 100;
no N+1 queries; RBAC at use-case layer; OWASP Top 10 per endpoint; no raw SQL;
zod validation at API boundary; file size ≤ 10 MB, ≤ 5 files per comment

**Scale/Scope**: Single-org deployment; up to 10,000 tickets; 500 concurrent
users; up to 5 attachments × 10 MB = 50 MB per comment submission

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. Clean Architecture | ✅ Pass | Status state machine in Domain; use cases in Application; Prisma + S3 in Infrastructure; routes in Presentation |
| II. TypeScript Standards | ✅ Pass | `strict: true`; no `any`; const enums for status/priority/event types |
| III. Security | ✅ Pass | RBAC at use-case layer; zod at boundary; internal notes filtered before customer response; S3 presigned URLs (no server-side streaming); OWASP reviewed |
| IV. Testing | ✅ Pass | TDD; unit tests for state machine and use cases; integration tests for repos; contract tests for all routes; ≥ 80% floor |
| V. Performance | ✅ Pass | Indexed on status, priority, customerId, assignedAgentId, categoryId; LIMIT/OFFSET pagination; Prisma `include` for relations; no N+1 |
| VI. API Design Consistency | ✅ Pass | `/api/v1/tickets/*`; `{ data, meta, error }` envelope; camelCase; ISO 8601 dates; correct HTTP status codes |

**Post-Phase 1 re-check**: All gates remain green. S3 integration is behind
`IFileStorageService` interface — no infrastructure import in use cases.

## Project Structure

### Documentation (this feature)

```text
specs/003-ticket-management/
├── plan.md                      # This file
├── research.md                  # Phase 0 — design decisions
├── data-model.md                # Phase 1 — Prisma schema
├── quickstart.md                # Phase 1 — validation guide
├── contracts/
│   ├── tickets.md               # Ticket CRUD + lifecycle endpoints
│   ├── comments.md              # Comment + attachment endpoints
│   └── categories.md            # Ticket category management
└── tasks.md                     # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── ticket.entity.ts
│   │   │   ├── ticket-comment.entity.ts
│   │   │   └── ticket-category.entity.ts
│   │   ├── repositories/
│   │   │   ├── ticket.repository.interface.ts
│   │   │   ├── ticket-comment.repository.interface.ts
│   │   │   └── ticket-category.repository.interface.ts
│   │   ├── services/
│   │   │   └── file-storage.service.interface.ts
│   │   └── state-machine/
│   │       └── ticket-status.state-machine.ts
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── tickets/
│   │   │   │   ├── create-ticket.use-case.ts
│   │   │   │   ├── get-ticket.use-case.ts
│   │   │   │   ├── list-tickets.use-case.ts
│   │   │   │   ├── update-ticket.use-case.ts
│   │   │   │   ├── assign-ticket.use-case.ts
│   │   │   │   ├── self-assign-ticket.use-case.ts
│   │   │   │   ├── cancel-ticket.use-case.ts
│   │   │   │   ├── resolve-ticket.use-case.ts
│   │   │   │   ├── close-ticket.use-case.ts
│   │   │   │   └── auto-close-tickets.use-case.ts
│   │   │   ├── comments/
│   │   │   │   ├── add-comment.use-case.ts
│   │   │   │   └── list-comments.use-case.ts
│   │   │   └── categories/
│   │   │       ├── create-category.use-case.ts
│   │   │       ├── update-category.use-case.ts
│   │   │       └── deactivate-category.use-case.ts
│   │   └── dto/
│   │       ├── create-ticket.dto.ts
│   │       ├── update-ticket.dto.ts
│   │       ├── add-comment.dto.ts
│   │       └── list-tickets-query.dto.ts
│   ├── infrastructure/
│   │   ├── repositories/
│   │   │   ├── prisma-ticket.repository.ts
│   │   │   ├── prisma-ticket-comment.repository.ts
│   │   │   └── prisma-ticket-category.repository.ts
│   │   └── services/
│   │       └── s3-file-storage.service.ts
│   └── presentation/
│       └── http/
│           ├── routes/
│           │   ├── tickets.routes.ts
│           │   ├── ticket-comments.routes.ts
│           │   └── ticket-categories.routes.ts
│           └── controllers/
│               ├── tickets.controller.ts
│               ├── ticket-comments.controller.ts
│               └── ticket-categories.controller.ts
└── tests/
    ├── unit/
    │   └── use-cases/
    │       ├── tickets/
    │       │   ├── create-ticket.use-case.test.ts
    │       │   ├── assign-ticket.use-case.test.ts
    │       │   ├── self-assign-ticket.use-case.test.ts
    │       │   ├── cancel-ticket.use-case.test.ts
    │       │   ├── resolve-ticket.use-case.test.ts
    │       │   ├── close-ticket.use-case.test.ts
    │       │   └── auto-close-tickets.use-case.test.ts
    │       ├── comments/
    │       │   └── add-comment.use-case.test.ts
    │       └── state-machine/
    │           └── ticket-status.state-machine.test.ts
    ├── integration/
    │   └── repositories/
    │       ├── prisma-ticket.repository.test.ts
    │       ├── prisma-ticket-comment.repository.test.ts
    │       └── prisma-ticket-category.repository.test.ts
    └── contract/
        ├── tickets.routes.test.ts
        ├── ticket-comments.routes.test.ts
        └── ticket-categories.routes.test.ts
```

**Structure Decision**: Backend-only REST API extending `backend/` workspace
from `001-user-auth` and `002-customer-management`. Shares the same Express
app, Prisma client, and PostgreSQL database. This feature adds the ticket-
related domain, application, and infrastructure layers.
