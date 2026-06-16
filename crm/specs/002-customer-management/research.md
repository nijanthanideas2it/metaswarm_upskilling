# Research: Customer Management

**Feature**: 002-customer-management
**Date**: 2026-06-16
**Status**: Complete — all design decisions resolved

---

## Decision 1: Customer ↔ User Identity Relationship

**Decision**: The `Customer` table stores CRM profile data (`fullName`, `phone`,
`jobTitle`, `organizationId`) and holds a unique foreign key `userId` referencing
the `User` table owned by the Authentication module. A 1:1 relationship — one
User record, one Customer profile record.

**Rationale**:
- The Auth module owns identity (email, passwordHash, role, status). Duplicating
  those fields here would create two sources of truth and drift risk.
- A separate `Customer` table (profile extension pattern) keeps the Auth module
  independently deployable and testable without depending on CRM profile data.
- The `userId` FK enables a JOIN to surface email/role/status in customer
  profile API responses without coupling the domain models.

**Alternatives considered**:
- *Single unified User table with all CRM fields* — rejected: bloats the Auth
  model with concerns it shouldn't own; every auth test would need to seed CRM data.
- *Separate user store per module* — rejected: identity would diverge across
  modules; email changes would require synchronisation.

---

## Decision 2: Role-Based Access Control (RBAC) Enforcement Layer

**Decision**: RBAC is enforced at the **Application layer** (use case level).
Each use case accepts a `callerRole: Role` parameter (extracted from the JWT
by the controller) and throws a `ForbiddenError` if the role is not in the
permitted set. The `require-role.middleware.ts` in the Presentation layer handles
coarse route-level pre-checks; fine-grained per-operation rules live in use cases.

**Rationale**:
- Business rules about who can do what are business logic — they belong in
  the Application layer, not route guards (constitution Principle I).
- Use-case-level enforcement is independently testable in pure unit tests
  without spinning up an Express server.
- Two-layer defence: route middleware blocks obviously unauthorised callers
  early (HTTP 401 if no token, 403 if wrong role for the route group);
  use case enforces nuanced per-operation rules (e.g., Manager can update
  a customer but not deactivate them).

**Alternatives considered**:
- *Route-level-only RBAC* — rejected: route guards are coarse; per-operation
  nuances (e.g., Customer can update own profile but not another customer's)
  cannot be expressed cleanly in route middleware alone.
- *Database-level row security (PostgreSQL RLS)* — deferred: adds operational
  complexity for v1; use-case enforcement achieves equivalent correctness.

---

## Decision 3: Customer Search Implementation

**Decision**: PostgreSQL `ILIKE` search on `fullName` and `email` columns using
Prisma's `OR` filter, with a composite GiST index on `(lower(fullName),
lower(email))` defined in the Prisma migration. LIMIT/OFFSET pagination applies
to all search results.

**Rationale**:
- For 10,000 records, `ILIKE` with a GiST trigram index (pg_trgm extension)
  delivers sub-100 ms queries — well within the 200 ms p95 budget (spec SC-002).
- Prisma supports raw index definitions in migration files, so the trigram
  index can be added without leaving the ORM boundary.
- Search requires a minimum of 2 characters (spec Assumption) to avoid full-table
  scans on very short queries.

**Alternatives considered**:
- *Full-text search with `tsvector` / `tsquery`* — deferred to v2: better for
  multi-word phrase search on large datasets (> 100k records); GiST trigram is
  simpler and adequate for v1.
- *Elasticsearch* — deferred: adds a separate infrastructure dependency that is
  not warranted for 10,000 records.

---

## Decision 4: Ticket Activity Summary Integration

**Decision**: Define `ITicketSummaryService` in the Domain layer with the
method `getCustomerSummary(customerId: string): Promise<TicketSummary>`.
In v1, `StubTicketSummaryService` (Infrastructure) returns zeros for all
counts. When the Ticket module (`003-ticket-management`) is built, it registers
a concrete implementation that queries real ticket data.

**Rationale**:
- Follows constitution Principle I: cross-module communication via Domain
  interfaces, not direct infrastructure calls.
- Allows the Customer Management module to be shipped and used before the
  Ticket module exists; the profile page displays a "No tickets yet" state.
- Dependency injection at the composition root swaps the stub for the real
  implementation without touching use case code.

**Alternatives considered**:
- *Null/omit ticket summary until Ticket module exists* — partial option; using
  an interface with a stub is equally simple and leaves the integration slot
  ready to activate.
- *Direct Prisma query from Customer module into ticket tables* — rejected:
  cross-module DB coupling violates Clean Architecture; ticket schema changes
  would break the customer module.

---

## Decision 5: Invitation Email on Customer Creation

**Decision**: Define `IUserInvitationService` in the Domain layer with the
method `sendInvitation(userId: string, email: string): Promise<void>`. The
`CreateCustomerUseCase` calls this after successfully persisting the Customer
record. In the Infrastructure layer, `AuthUserInvitationService` delegates
to the Auth module's internal invitation flow (function call, not HTTP).

**Rationale**:
- Keeps the invitation concern in the Auth module (which owns it) while
  allowing the Customer module to trigger it without an HTTP round-trip.
- The Domain interface makes the dependency explicit and mockable in unit tests.

**Alternatives considered**:
- *HTTP call to /api/v1/auth/invite* — rejected for v1: adds network latency
  and error surface for an in-process call; internal function call is simpler.
- *Emit a domain event (invitation-requested) handled asynchronously* — deferred
  to v2 when an event bus is introduced for notification decoupling.

---

## Decision 6: Audit Trail Implementation

**Decision**: Each update use case computes a field-level diff between the
pre-update and post-update state, then writes `CustomerProfileAuditEntry`
records within the **same Prisma transaction** as the customer update.

**Rationale**:
- Single transaction guarantees that no update escapes the audit trail
  (spec SC-004: 100% capture). If the audit write fails, the update rolls back.
- Field-level granularity ("fullName changed from X to Y") is more useful
  than row-level snapshots for support team accountability.
- Keeping audit writes in the Application layer (use cases) rather than a
  database trigger preserves testability and keeps logic in TypeScript.

**Alternatives considered**:
- *PostgreSQL triggers for audit* — rejected: audit logic moves out of the
  application layer, making it invisible to unit tests and harder to evolve.
- *Event-sourced audit log* — deferred: appropriate if full history replay
  is needed; a separate audit table is simpler for v1 read requirements.

---

## Decision 7: Organisation Deletion Guard

**Decision**: The `DeleteOrganisationUseCase` first queries for any customers
with `organizationId = <targetId>`. If any exist, it throws a `ConflictError`
and the controller returns HTTP 409 with a message listing the constraint.
Deletion only proceeds when zero members remain.

**Rationale**:
- Spec Assumption: "Deletion of an organisation is blocked while it still has
  customers." Making this an application-layer guard (not just a DB FK
  constraint) surfaces a clear, user-readable error rather than a generic
  DB constraint violation.
- The FK constraint is also kept on the DB schema as a defence-in-depth
  safety net in case the guard is bypassed.

**Alternatives considered**:
- *Cascade-disassociate members on deletion* — rejected: silently orphaning
  customer records from their organisation would confuse the support team.
- *Soft-delete organisations* — deferred: adds complexity without clear v1
  benefit; deactivation of individual customers already covers the access
  use case.

---

## Summary: All Design Decisions Resolved

| Question | Resolution |
|----------|-----------|
| Customer ↔ User identity | 1:1 `userId` FK; profile extension pattern |
| RBAC enforcement layer | Application layer (use cases) + route-level pre-check |
| Customer search | PostgreSQL ILIKE + GiST trigram index; LIMIT/OFFSET |
| Ticket summary integration | `ITicketSummaryService` interface; stub in v1 |
| Invitation on creation | `IUserInvitationService` interface; in-process call |
| Audit trail | Field-level diff in same Prisma transaction as update |
| Organisation deletion guard | App-layer `ConflictError`; DB FK as safety net |
