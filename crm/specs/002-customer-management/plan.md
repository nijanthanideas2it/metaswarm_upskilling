# Implementation Plan: Customer Management

**Branch**: `002-customer-management` | **Date**: 2026-06-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-customer-management/spec.md`

## Summary

The Customer Management module allows Admins and Support Managers to create and
maintain customer profiles and organisation records within the ServiceDesk CRM.
Support Agents access customer data in read-only mode during ticket handling.
Customers can view and update their own profile. The module extends the User
identity record owned by the Authentication module (`001-user-auth`) with CRM
profile data and organisational context, enforces strict role-based access at
the use-case level, maintains a full audit trail of profile changes, and
integrates with the Ticket module via a stub service interface ready for
activation when tickets are built.

## Technical Context

**Language/Version**: Node.js 20 LTS, TypeScript 5.x (strict mode)

**Primary Dependencies**: Express 4.x, Prisma 5.x, zod (request validation)

**Storage**: PostgreSQL 16 (via Prisma ORM); ILIKE search with composite indexes

**Testing**: Jest + Supertest; ≥ 80% coverage (lines + branches)

**Target Platform**: Linux server (same Node.js process as Auth module)

**Project Type**: Web service (REST API) — backend only for this feature

**Performance Goals**: All list/search endpoints p95 ≤ 200 ms (constitution);
deactivation reflected in ≤ 5 s (spec SC-005)

**Constraints**: Pagination default 20 / max 100; no N+1 queries (Prisma
`include` / `select`); RBAC enforced at use-case layer; OWASP Top 10 reviewed
per endpoint; no raw SQL; all inputs zod-validated at API boundary

**Scale/Scope**: Single-organisation deployment; up to 10,000 customers;
up to 500 members per organisation; 500 concurrent users

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. Clean Architecture | ✅ Pass | Domain → Application → Infrastructure → Presentation; Ticket and Invitation integrations via Domain-layer interfaces only |
| II. TypeScript Standards | ✅ Pass | `strict: true`; no `any`; ESLint `@typescript-eslint/recommended` CI gate |
| III. Security | ✅ Pass | RBAC at use-case layer; zod validation at API boundary; no PII in logs; OWASP Top 10 per endpoint |
| IV. Testing | ✅ Pass | TDD; unit/integration/contract test pyramid; ≥ 80% coverage floor |
| V. Performance | ✅ Pass | Composite index `(name, email)`; `organizationId` indexed; `LIMIT/OFFSET` pagination on all lists; no N+1 |
| VI. API Design Consistency | ✅ Pass | `/api/v1/customers/*` and `/api/v1/organizations/*`; `{ data, meta, error }` envelope; camelCase; ISO 8601 |

**Post-Phase 1 re-check**: All gates remain green. No cross-module infrastructure
coupling; inter-module contracts expressed as Domain-layer interfaces only.

## Project Structure

### Documentation (this feature)

```text
specs/002-customer-management/
├── plan.md                  # This file
├── research.md              # Phase 0 — design decisions
├── data-model.md            # Phase 1 — Prisma schema & entity design
├── quickstart.md            # Phase 1 — local validation guide
├── contracts/
│   ├── customers.md         # Phase 1 — customer endpoint contracts
│   └── organizations.md     # Phase 1 — organization endpoint contracts
└── tasks.md                 # Phase 2 — task list (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── customer.entity.ts
│   │   │   └── organization.entity.ts
│   │   ├── repositories/
│   │   │   ├── customer.repository.interface.ts
│   │   │   └── organization.repository.interface.ts
│   │   └── services/
│   │       ├── ticket-summary.service.interface.ts
│   │       └── user-invitation.service.interface.ts
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── customers/
│   │   │   │   ├── create-customer.use-case.ts
│   │   │   │   ├── get-customer.use-case.ts
│   │   │   │   ├── list-customers.use-case.ts
│   │   │   │   ├── search-customers.use-case.ts
│   │   │   │   ├── update-customer.use-case.ts
│   │   │   │   ├── update-own-profile.use-case.ts
│   │   │   │   ├── deactivate-customer.use-case.ts
│   │   │   │   └── reactivate-customer.use-case.ts
│   │   │   └── organizations/
│   │   │       ├── create-organization.use-case.ts
│   │   │       ├── get-organization.use-case.ts
│   │   │       ├── list-organizations.use-case.ts
│   │   │       ├── update-organization.use-case.ts
│   │   │       ├── delete-organization.use-case.ts
│   │   │       └── manage-organization-members.use-case.ts
│   │   └── dto/
│   │       ├── create-customer.dto.ts
│   │       ├── update-customer.dto.ts
│   │       ├── list-customers-query.dto.ts
│   │       ├── create-organization.dto.ts
│   │       └── update-organization.dto.ts
│   ├── infrastructure/
│   │   ├── repositories/
│   │   │   ├── prisma-customer.repository.ts
│   │   │   └── prisma-organization.repository.ts
│   │   └── services/
│   │       ├── stub-ticket-summary.service.ts
│   │       └── auth-user-invitation.service.ts
│   └── presentation/
│       └── http/
│           ├── routes/
│           │   ├── customers.routes.ts
│           │   └── organizations.routes.ts
│           ├── controllers/
│           │   ├── customers.controller.ts
│           │   └── organizations.controller.ts
│           └── middleware/
│               └── require-role.middleware.ts
└── tests/
    ├── unit/
    │   └── use-cases/
    │       ├── customers/
    │       │   ├── create-customer.use-case.test.ts
    │       │   ├── get-customer.use-case.test.ts
    │       │   ├── list-customers.use-case.test.ts
    │       │   ├── search-customers.use-case.test.ts
    │       │   ├── update-customer.use-case.test.ts
    │       │   ├── update-own-profile.use-case.test.ts
    │       │   ├── deactivate-customer.use-case.test.ts
    │       │   └── reactivate-customer.use-case.test.ts
    │       └── organizations/
    │           ├── create-organization.use-case.test.ts
    │           ├── get-organization.use-case.test.ts
    │           ├── update-organization.use-case.test.ts
    │           ├── delete-organization.use-case.test.ts
    │           └── manage-organization-members.use-case.test.ts
    ├── integration/
    │   └── repositories/
    │       ├── prisma-customer.repository.test.ts
    │       └── prisma-organization.repository.test.ts
    └── contract/
        ├── customers.routes.test.ts
        └── organizations.routes.test.ts
```

**Structure Decision**: Backend-only REST API extending the existing `backend/`
workspace from `001-user-auth`. No new top-level package; all customer and
organisation source lives under `backend/src/` alongside the auth module,
sharing the same Express app and Prisma client instance.
