<!--
SYNC IMPACT REPORT
==================
Version change: N/A (initial ratification) → 1.0.0
Modified principles: N/A — first fill
Added sections:
  - Core Principles (6 principles: Clean Architecture, TypeScript Standards,
    Security, Testing, Performance, API Design Consistency)
  - Quality Gates
  - Governance
Removed sections: N/A
Templates requiring updates:
  ✅ .specify/templates/plan-template.md — Constitution Check uses
       "[Gates determined based on constitution file]"; 6 named principles
       now make those gates concrete; no structural edit required
  ✅ .specify/templates/spec-template.md — FR MUST/SHOULD language aligns
       with constitution; no edit required
  ✅ .specify/templates/tasks-template.md — Security, testing, and performance
       phases already present; no edit required
  ✅ .specify/templates/commands/ — directory absent; no command templates to update
Follow-up TODOs: None — all placeholders resolved
-->

# Sales CRM Constitution

## Core Principles

### I. Clean Architecture (NON-NEGOTIABLE)

The codebase MUST be organized into four strictly layered zones: **Domain**
(entities, value objects, repository interfaces), **Application** (use cases,
DTOs), **Infrastructure** (Prisma repositories, external services, JWT adapters),
and **Presentation** (Express routes, React Native screens/components).

- Inner layers MUST NOT import from outer layers; dependency arrows point inward only.
- The Domain layer MUST have zero dependencies on Node.js, Express, Prisma,
  or any third-party library.
- All data access MUST go through repository interfaces defined in Domain;
  direct Prisma calls outside Infrastructure are forbidden.
- Use cases in the Application layer MUST contain pure business logic and
  remain framework-agnostic.
- React Native UI MUST depend on Application layer interfaces, never directly
  on repositories or infrastructure services.

**Rationale**: Enforces testability and long-term maintainability by making
the core business logic replaceable and independently verifiable without
spinning up a database or HTTP server.

### II. TypeScript Standards (NON-NEGOTIABLE)

TypeScript strict mode MUST be enabled (`"strict": true` in `tsconfig.json`)
across all packages — backend and mobile.

- `any` is forbidden; use `unknown` and narrow with type guards.
- All exported functions and class methods MUST declare explicit return types.
- Interfaces MUST be preferred over type aliases for object shapes shared
  across layer boundaries.
- `const enum` MUST be used for enumerated values to eliminate runtime overhead.
- Loose equality (`==`) is forbidden; strict equality (`===`) is required.
- Utility types (`Partial`, `Required`, `Readonly`, `Pick`, `Omit`) MUST be
  used instead of redefining existing shapes.
- ESLint with `@typescript-eslint/recommended` MUST run in CI with zero errors
  allowed to merge.

**Rationale**: Strict typing catches contract violations between layers at
compile time, preventing an entire class of runtime bugs in a distributed
CRM codebase.

### III. Security (NON-NEGOTIABLE)

Authentication and data protection rules are non-negotiable for a system
handling sales PII and commercial opportunity data.

- JWT access tokens MUST expire in ≤ 15 minutes; refresh tokens MUST be
  rotated on every use and invalidated on logout.
- Refresh tokens MUST be stored server-side (database) and hashed; plain
  tokens MUST NOT persist.
- All user-supplied input MUST be validated and sanitized at the API boundary
  via Express middleware before reaching any use case.
- Parameterized queries via Prisma MUST be used exclusively; raw SQL strings
  are forbidden.
- Passwords MUST be hashed with bcrypt at a minimum cost factor of 12.
- Sensitive values (tokens, passwords, PII fields) MUST NOT appear in
  application logs or error messages.
- CORS MUST allowlist only known origins; wildcard (`*`) is forbidden in
  production.
- Rate limiting MUST be applied to all authentication endpoints (login,
  token refresh, password reset).
- OWASP Top 10 MUST be reviewed against every new endpoint before merge.

**Rationale**: CRM data is a high-value target; a single auth bypass or
injection vulnerability exposes the entire customer and deal pipeline.

### IV. Testing (NON-NEGOTIABLE)

- Minimum **80% code coverage** (lines + branches) enforced by Jest in CI;
  PRs that drop coverage below 80% MUST NOT merge.
- TDD is mandatory for new features: tests MUST be written and confirmed
  failing before implementation begins (Red-Green-Refactor).
- **Unit tests** MUST cover all use cases and domain entity logic using real
  in-memory implementations — no framework mocks for Domain or Application layers.
- **Integration tests** MUST cover all Prisma repository implementations
  against a real test database (seeded, isolated per test run).
- **API contract tests** MUST cover all Express route handlers, verifying
  request/response shapes and HTTP status codes.
- Test cases MUST be isolated: no shared mutable state, no test-order
  dependencies.
- Infrastructure adapters (Prisma client, JWT service, external APIs) MAY be
  mocked only in unit tests for Application layer use cases.

**Rationale**: An 80% floor with layered test types prevents regressions in
business-critical flows (lead qualification, opportunity stage transitions,
deal closures) where bugs have direct revenue impact.

### V. Performance

- API p95 response time MUST be ≤ 200 ms for standard CRUD endpoints under
  nominal load (≤ 500 concurrent users).
- All database columns used in `WHERE`, `ORDER BY`, or join conditions MUST
  have appropriate indexes defined in Prisma migrations.
- N+1 query patterns are forbidden; use Prisma `include`, `select`, or
  explicit batch operations.
- All list endpoints MUST implement cursor-based or offset pagination with a
  default page size of 20 and a hard cap of 100 items per request.
- React Native screens MUST NOT block the JS thread; expensive computations
  MUST be deferred with `InteractionManager.runAfterInteractions` or moved
  off-thread.
- Performance budgets MUST be validated in CI for critical paths (e.g., leads
  list, opportunity pipeline view) using load-test scripts.

**Rationale**: Sales reps use the CRM in real time during calls and meetings;
sluggish responses directly reduce adoption and data quality.

### VI. API Design Consistency

A uniform API surface reduces client-side complexity and accelerates mobile
development.

- Resources MUST use plural nouns (`/contacts`, `/opportunities`); HTTP verbs
  define actions.
- API versioning MUST be path-based: `/api/v1/...`; new breaking changes
  introduce `/api/v2/...`.
- All responses MUST conform to the envelope shape:
  `{ "data": <payload>, "meta": <pagination|context>, "error": null }` on
  success and `{ "data": null, "meta": null, "error": { "code", "message",
  "details" } }` on failure.
- HTTP status codes MUST be semantically correct: 200 OK, 201 Created,
  204 No Content, 400 Bad Request, 401 Unauthorized, 403 Forbidden,
  404 Not Found, 409 Conflict, 422 Unprocessable Entity, 500 Internal Error.
- Paginated list responses MUST include `{ "total", "page", "pageSize",
  "hasNextPage" }` in the `meta` field.
- All field names in API responses MUST use `camelCase`.
- All date/time values MUST be serialized as ISO 8601 UTC strings
  (e.g., `"2026-06-16T10:00:00Z"`).
- Query filter parameters MUST follow a consistent naming pattern:
  `filter[field]`, sort via `sort=field` / `sort=-field` (descending prefix).

**Rationale**: The React Native mobile client and any future integrations
depend on a predictable contract; inconsistency forces defensive parsing
code that becomes a maintenance liability.

## Quality Gates

Every pull request MUST clear all of the following gates before merge:

| Gate | Requirement |
|------|------------|
| TypeScript compile | `tsc --noEmit` exits 0; zero errors |
| Lint | ESLint exits 0; zero errors (warnings permitted but tracked) |
| Test coverage | Jest coverage report ≥ 80% lines and branches |
| Architecture guard | No Domain/Application imports from Infrastructure or Presentation |
| Security scan | OWASP dependency check; no critical CVEs in production dependencies |
| API contract | Contract tests pass for all modified endpoints |
| Performance | Load test p95 ≤ 200 ms for modified endpoints (CI smoke suite) |

Architecture violations (e.g., a use case file importing the Prisma client)
MUST block merge and require a design review, not just a linter suppression.

## Governance

- This constitution supersedes all other practices, style guides, and
  conventions in this repository. In case of conflict, the constitution wins.
- **Amendments** require: (1) a written proposal describing the change and
  motivation, (2) approval from at least one senior engineer, (3) a migration
  plan if existing code violates the new rule, and (4) a version bump per the
  semantic versioning policy below.
- **Versioning policy**:
  - MAJOR — backward-incompatible principle removals or redefinitions that
    require existing code to be restructured.
  - MINOR — new principle or section added, or materially expanded guidance
    that introduces new requirements.
  - PATCH — clarifications, wording improvements, or non-semantic refinements
    that do not change what is required.
- **Compliance reviews** occur at the start of each sprint; any open
  violations must be triaged and assigned before new feature work begins.
- **Exceptions** must be documented in the PR description with a written
  justification and a linked follow-up ticket to resolve the exception.
- The `.specify/memory/constitution.md` file is the authoritative source;
  runtime development guidance lives in `.specify/` tooling and CLAUDE.md.

**Version**: 1.0.0 | **Ratified**: 2026-06-16 | **Last Amended**: 2026-06-16
