# Implementation Plan: User Authentication

**Branch**: `001-user-auth` | **Date**: 2026-06-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-user-auth/spec.md`

## Summary

The User Authentication module provides secure identity verification for the
ServiceDesk CRM. It implements email/password login with short-lived JWT access
tokens (15-min TTL) and server-side-stored hashed refresh tokens (7-day TTL),
rolling token rotation, account lockout after 5 consecutive failed attempts,
and a single-use email-based password reset flow. Five use cases — Login,
Logout, RefreshToken, ForgotPassword, ResetPassword — are exposed as
versioned REST endpoints via Express, backed by PostgreSQL through Prisma,
and structured in strict Clean Architecture layers.

## Technical Context

**Language/Version**: Node.js 20 LTS, TypeScript 5.x (strict mode)

**Primary Dependencies**: Express 4.x, Prisma 5.x, jsonwebtoken, bcryptjs,
nodemailer, zod (request validation), express-rate-limit

**Storage**: PostgreSQL 16 (via Prisma ORM); no raw SQL

**Testing**: Jest + Supertest; 80% minimum coverage (lines + branches)

**Target Platform**: Linux server (Node.js REST API, containerised)

**Project Type**: Web service (REST API) — backend only for this feature

**Performance Goals**: Login p95 ≤ 200 ms; password reset email delivered
within 2 minutes (SC-002)

**Constraints**: JWT access tokens expire in 15 min; refresh tokens expire in
7 days; bcrypt cost factor ≥ 12; no raw SQL; no PII in logs; CORS allowlist
only; rate limiting on all auth endpoints; OWASP Top 10 reviewed per endpoint

**Scale/Scope**: Single-organisation deployment; up to 500 concurrent users;
4 roles (Admin, Support Manager, Support Agent, Customer)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. Clean Architecture | ✅ Pass | Domain → Application → Infrastructure → Presentation; no upward imports |
| II. TypeScript Standards | ✅ Pass | `strict: true`; no `any`; ESLint `@typescript-eslint/recommended` required |
| III. Security | ✅ Pass | JWT 15 min; refresh tokens hashed + DB-stored; bcrypt ≥ 12; rate limited; OWASP reviewed |
| IV. Testing | ✅ Pass | TDD; unit tests for use cases; integration for repositories; contract tests for routes; 80% floor |
| V. Performance | ✅ Pass | p95 ≤ 200 ms; no N+1 queries; auth endpoints are single-row lookups |
| VI. API Design Consistency | ✅ Pass | `/api/v1/auth/*`; `{ data, meta, error }` envelope; camelCase; ISO 8601 dates |

**Post-Phase 1 re-check**: All gates remain green. Repository pattern used for
all DB access; no Prisma client imported outside Infrastructure layer.

## Project Structure

### Documentation (this feature)

```text
specs/001-user-auth/
├── plan.md              # This file
├── research.md          # Phase 0 — technology decisions
├── data-model.md        # Phase 1 — Prisma schema & entity design
├── quickstart.md        # Phase 1 — local validation guide
├── contracts/
│   └── auth.md          # Phase 1 — REST endpoint contracts
└── tasks.md             # Phase 2 — task list (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   └── user.entity.ts
│   │   ├── repositories/
│   │   │   ├── user.repository.interface.ts
│   │   │   ├── auth-token.repository.interface.ts
│   │   │   └── password-reset.repository.interface.ts
│   │   └── value-objects/
│   │       └── email.value-object.ts
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── login.use-case.ts
│   │   │   ├── logout.use-case.ts
│   │   │   ├── refresh-token.use-case.ts
│   │   │   ├── forgot-password.use-case.ts
│   │   │   └── reset-password.use-case.ts
│   │   └── dto/
│   │       ├── login.dto.ts
│   │       ├── refresh-token.dto.ts
│   │       ├── forgot-password.dto.ts
│   │       └── reset-password.dto.ts
│   ├── infrastructure/
│   │   ├── repositories/
│   │   │   ├── prisma-user.repository.ts
│   │   │   ├── prisma-auth-token.repository.ts
│   │   │   └── prisma-password-reset.repository.ts
│   │   └── services/
│   │       ├── jwt.service.ts
│   │       ├── bcrypt.service.ts
│   │       └── nodemailer-email.service.ts
│   └── presentation/
│       └── http/
│           ├── routes/
│           │   └── auth.routes.ts
│           ├── controllers/
│           │   └── auth.controller.ts
│           └── middleware/
│               ├── validate-request.middleware.ts
│               └── rate-limit.middleware.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── tests/
    ├── unit/
    │   └── use-cases/
    │       ├── login.use-case.test.ts
    │       ├── logout.use-case.test.ts
    │       ├── refresh-token.use-case.test.ts
    │       ├── forgot-password.use-case.test.ts
    │       └── reset-password.use-case.test.ts
    ├── integration/
    │   └── repositories/
    │       ├── prisma-user.repository.test.ts
    │       ├── prisma-auth-token.repository.test.ts
    │       └── prisma-password-reset.repository.test.ts
    └── contract/
        └── auth.routes.test.ts
```

**Structure Decision**: Web service (Option 2 variant — backend only for this
module). The `backend/` directory hosts the Clean Architecture Node.js API.
React Native frontend (separate `mobile/` workspace) will consume these
endpoints and is out of scope for this feature.
