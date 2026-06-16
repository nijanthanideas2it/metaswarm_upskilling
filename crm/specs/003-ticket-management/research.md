# Research: Ticket Management

**Feature**: 003-ticket-management
**Date**: 2026-06-16
**Status**: Complete — all design decisions resolved

---

## Decision 1: Unique Ticket Reference Number Generation

**Decision**: Use a PostgreSQL sequence (`ticket_reference_seq`) that atomically
increments on each insert. The sequence value is formatted as `TKT-NNNNN`
(zero-padded to 5 digits) within the `CreateTicketUseCase` before persistence.
The sequence is defined in a Prisma raw migration and called via a Prisma
`$queryRaw` in the repository.

**Rationale**: PostgreSQL sequences are the only truly atomic counter under
concurrent inserts — no application-level locking, no UUID gaps, no duplicates.
A single `nextval()` call returns a unique integer even under the highest
concurrency. Spec SC-008 requires zero duplicate reference numbers for the
lifetime of the system; sequences deliver this guarantee.

**Alternatives considered**:
- *UUID as reference* — rejected: UUIDs are not human-readable and make ticket
  reference communication impractical.
- *MAX(id)+1* — rejected: race condition under concurrent inserts produces
  duplicates.
- *Application-level atomic counter in Redis* — deferred: adds infrastructure;
  PostgreSQL sequence achieves the same with no additional dependency.

---

## Decision 2: Status Transition Enforcement

**Decision**: Define a `TicketStatusStateMachine` in the Domain layer — a typed
map of `Record<TicketStatus, TicketStatus[]>` where the value array lists valid
next states. Each status-changing use case calls `stateMachine.canTransition(from, to)`
and throws `InvalidTransitionError` if the transition is illegal.

Valid transitions:
```
OPEN        → [IN_PROGRESS, CANCELLED]
IN_PROGRESS → [PENDING, RESOLVED, OPEN]
PENDING     → [IN_PROGRESS]
RESOLVED    → [CLOSED, IN_PROGRESS]
CLOSED      → []
CANCELLED   → []
```

**Rationale**: Encoding transitions in the Domain layer makes them the single
source of truth, independently testable without infrastructure, and enforced
regardless of which use case triggers the change. A DB-level `CHECK` constraint
is added as defence-in-depth but is not the primary gate.

**Alternatives considered**:
- *Route-level validation* — rejected: duplicates logic across controllers and
  breaks the Clean Architecture boundary.
- *Database triggers* — rejected: moves business logic out of the application
  layer; untestable in unit tests without a DB.

---

## Decision 3: File Attachment Strategy (S3 Presigned URLs)

**Decision**: Two-phase attachment flow:
1. Client calls `POST /api/v1/tickets/:id/comments/:commentId/attachments/presigned-url`
   — backend validates file metadata (name, type, size) and returns an S3
   presigned PUT URL with a 15-minute TTL.
2. Client uploads directly to S3 using the presigned URL.
3. Client calls `POST /api/v1/tickets/:id/comments/:commentId/attachments/confirm`
   — backend verifies the S3 object exists and creates the `TicketAttachment`
   record with the storage key.

**Rationale**: S3 presigned URLs prevent large files from passing through the
Node.js process, avoiding memory pressure and blocking the event loop. The
backend only handles metadata and confirmation — well within the p95 ≤ 200 ms
budget. File validation (size, type, count) happens at the presigned-URL
request stage, not at upload time.

**Alternatives considered**:
- *Multipart upload through Node.js (multer)* — rejected: streams up to 50 MB
  (5 files × 10 MB) through the process, risking OOM under concurrent uploads.
- *Upload-then-scan flow* — deferred: malware scanning is a v2 security
  enhancement; v1 validates file type by MIME type and extension only.

---

## Decision 4: Concurrent Self-Assignment Race Condition

**Decision**: `SelfAssignTicketUseCase` uses a Prisma `updateMany` with a
`WHERE { id: ticketId, assignedAgentId: null }` condition. If `count === 0`
(ticket already taken), throw `ConflictError`. The controller maps this to
HTTP 409. Spec FR-020 and SC-006 require exactly one winner.

**Rationale**: PostgreSQL's row-level locking guarantees that only one
`UPDATE WHERE assignedAgentId IS NULL` succeeds when two requests arrive
simultaneously. No application-level lock or distributed lock is needed.

**Alternatives considered**:
- *SELECT then UPDATE* — rejected: TOCTOU race; two agents can read NULL and
  both succeed the SELECT check before either UPDATE fires.
- *Pessimistic lock (`SELECT FOR UPDATE`)* — viable but heavier; the optimistic
  `updateMany` achieves the same with lower lock contention.

---

## Decision 5: Internal Note Visibility Enforcement

**Decision**: Internal note filtering is applied in the Application layer, not
the controller. `ListCommentsUseCase` accepts the `callerRole` parameter. If
`callerRole === CUSTOMER`, it filters out comments where `isInternalNote = true`
before returning. The Prisma query also adds `WHERE isInternalNote = false` for
Customer-role callers to avoid fetching unnecessary data.

**Rationale**: Filtering in the Application layer keeps the customer-visibility
rule testable in pure unit tests and ensures it cannot be bypassed by future
controller changes. Spec SC-004 requires zero leakage.

---

## Decision 6: Auto-Close Implementation

**Decision**: `AutoCloseTicketsUseCase` queries for all tickets where
`status = RESOLVED` AND `updatedAt ≤ NOW() - 7 days`. For each, it transitions
status to `CLOSED` and writes an activity log entry with `actorId = null` and
a system-generated note. The use case is designed to be called by a scheduled
job; the scheduling mechanism (cron) is out of scope for this feature.

**Rationale**: The use case is independently invokable and testable without a
scheduler. Tests can directly call the use case with a seeded ticket and a
manipulated `updatedAt` value. The scheduler integration is a thin wrapper.

---

## Decision 7: Ticket Summary Service Implementation

**Decision**: `PrismaTicketSummaryService` implements the `ITicketSummaryService`
interface defined in `002-customer-management`. It runs:
```sql
SELECT
  COUNT(*) AS totalTickets,
  COUNT(*) FILTER (WHERE status NOT IN ('RESOLVED','CLOSED','CANCELLED')) AS openTickets,
  MAX(createdAt) AS lastTicketAt
FROM Ticket WHERE customerId = $1
```
This service is registered as a concrete implementation replacing the
`StubTicketSummaryService` from module 002.

**Rationale**: Single query, no N+1, fulfils the interface contract and activates
the customer profile ticket summary that was stubbed in the previous module.

---

## Summary: All Decisions Resolved

| Question | Resolution |
|----------|-----------|
| Reference number generation | PostgreSQL sequence; `TKT-NNNNN` format |
| Status transition enforcement | Domain-layer state machine; `InvalidTransitionError` |
| File attachments | S3 presigned URLs; two-phase confirm flow |
| Concurrent self-assignment | Prisma `updateMany` optimistic check; 409 on conflict |
| Internal note visibility | Application-layer filter by caller role |
| Auto-close mechanism | Standalone use case; scheduler integration deferred |
| Ticket summary service | `PrismaTicketSummaryService` implements 002's interface |
