# Research: Escalation Management

**Feature**: 005-escalation-management
**Date**: 2026-06-16
**Status**: Complete — all design decisions resolved

---

## Decision 1: Scheduler Technology

**Decision**: Use `node-cron` at a 15-minute interval (`*/15 * * * *`) running
in the same Node.js process. The cron job is an Infrastructure-layer class
(`EscalationEvaluationJob`) that holds a reference to
`EvaluateEscalationPoliciesUseCase` and calls `execute()` on each tick. The use
case is constructed and injected at application startup via the DI container.

**Rationale**: `node-cron` is zero-infrastructure — no Redis, no external queue,
no additional deployment unit. The spec requires ≤ 15 min intervals which is
easily achievable in-process. The job wrapper is three lines; all evaluation
logic stays in the Application-layer use case, remaining independently testable
without a scheduler.

**Alternatives considered**:
- *Bull/BullMQ job queue* — deferred: adds Redis dependency; justified only when
  distributed job execution across multiple Node.js instances is required (v2
  scale target).
- *pg-boss (PostgreSQL-backed job queue)* — viable but introduces additional
  schema complexity; not needed at single-org scale.
- *OS-level cron calling an HTTP endpoint* — rejected: requires network
  authentication for the internal endpoint and complicates zero-downtime deploys.

---

## Decision 2: Fired-Tier Tracking — Schema Choice

**Decision**: Use a single `TicketPolicyEscalationState` table with columns
`(ticketId, policyId, firedTierOrdinals Int[])`, where `firedTierOrdinals` is a
PostgreSQL integer array. A unique constraint on `(ticketId, policyId)` guarantees
at most one row per ticket–policy pair. When a new tier fires, the use case appends
its ordinal to the array using Prisma's `push` array operator inside the same
transaction as the `EscalationEvent` write.

**Rationale**: The integer array approach avoids one row per tier-firing, keeping
the table narrow and the upsert simple. Checking `firedTierOrdinals.includes(n)`
is O(1) for arrays of max length 5. PostgreSQL's native `@>` operator can be
used for bulk queries if needed. The unique constraint prevents duplicate state
rows under concurrent evaluation runs.

**Alternatives considered**:
- *Separate `FiredTier` rows (one per tier firing)* — rejected: more joins
  needed during evaluation; `EscalationEvent` already provides the audit record;
  the state table only needs "which ordinals have fired."
- *Bitmask integer field* — viable for exactly 5 tiers; rejected in favour of
  the explicit integer array for readability and extensibility (future tiers
  beyond ordinal 5 if spec relaxes the limit).

---

## Decision 3: Notification Deduplication Strategy

**Decision**: `EvaluateEscalationPoliciesUseCase` collects all `(recipientId,
evaluationRunId)` pairs produced by all fired tiers across all policies in a
single evaluation cycle. Before calling `NotificationService.emit()`, it
deduplicates the list by `recipientId`, merging the payloads (listing all
policy+tier combinations that targeted the recipient). One call to
`NotificationService.emit()` is made per unique recipient per run.

**Rationale**: Deduplication in the Application layer is testable without any
infrastructure. The spec (FR-012 / SC-004) requires exactly one notification per
recipient per cycle, never zero. Merging at the use-case level also lets the
Notification payload carry all triggering context for the consolidated message.

**Alternatives considered**:
- *Deduplication in NotificationService* — rejected: NotificationService is an
  interface owned by the Notifications module (006); this module must not depend
  on its internals.
- *Database-level deduplication constraint* — insufficient: the constraint would
  reject duplicate inserts but would not merge payloads or suppress notifications.

---

## Decision 4: Policy Evaluation Query Strategy

**Decision**: On each evaluation run, load all active policies in a single query
with their tiers and actions eagerly included (`include: { tiers: { include: { actions: true } } }`).
For each policy, execute one query to find matching tickets: filter by
`status IN [OPEN, IN_PROGRESS, PENDING]` and, if the policy has a scope, add
`categoryId IN [...]` and/or `priority IN [...]` conditions. Time-condition
arithmetic (`NOW() - ticket.createdAt > thresholdHours`) is evaluated in the
application layer using `date-fns/differenceInHours`. The
`TicketPolicyEscalationState` for the matched ticket set is loaded in a single
`findMany` per policy to determine unfired tiers — no per-ticket subqueries.

**Rationale**: One DB round-trip per policy (not per ticket) avoids N+1. With
≤ 50 active policies and ≤ 500 open tickets, the total query count per evaluation
cycle is bounded at 51 (1 policy list + 1 ticket batch per policy). Time
arithmetic in-process avoids `NOW()` function calls scattered across dynamic SQL
and is deterministic in tests.

**Alternatives considered**:
- *Single JOIN query across all policies and tickets* — rejected: complex
  cross-product query; harder to paginate and harder to reason about under
  schema evolution.
- *Time-condition filtering in SQL (`WHERE createdAt < NOW() - INTERVAL ...`)* —
  viable but couples evaluation logic to SQL strings, bypassing zod validation
  and making unit testing harder.

---

## Decision 5: `isEscalated` Flag and Transaction Atomicity

**Decision**: Every write that changes `Ticket.isEscalated` or `Ticket.escalatedAt`
happens inside the same Prisma interactive transaction as the `EscalationEvent`
(or `DeEscalationEvent`) creation. The ticket activity log entry (`TicketActivityLogEntry`)
is also written in the same transaction. This guarantees that a partial failure
(e.g., process crash between the Ticket update and the event write) cannot leave
the flag set without an audit record, or vice versa.

**Rationale**: Spec SC-002 requires 100% capture of escalation events. The only
way to guarantee this without distributed transactions is to co-locate the flag
update and the event write in a single DB transaction. Prisma interactive
transactions (`prisma.$transaction(async (tx) => {...})`) make this straightforward.

**Alternatives considered**:
- *Eventual consistency via an event bus* — rejected: unnecessary for single-DB
  deployment; adds complexity without a reliability benefit at this scale.
- *Flag set by the auto-close job separately* — rejected: flag must reflect real
  time state; stale flag would mislead the escalated queue.

---

## Decision 6: Manual Escalation Authorization Model

**Decision**: `ManualEscalateTicketUseCase` accepts `callerId` and `callerRole`
(injected from the JWT middleware). Authorization check:
1. If `callerRole === SUPPORT_AGENT`: assert `ticket.assignedAgentId === callerId`;
   throw `ForbiddenError` otherwise.
2. If `callerRole === SUPPORT_MANAGER` or `ADMIN`: no ownership check required.
3. If `callerRole === CUSTOMER`: always throw `ForbiddenError` (FR-016).

This logic lives entirely in the use case, not the controller or middleware, so
it is exercised by unit tests.

**Rationale**: Role + ownership check in the use case layer is the Clean
Architecture standard used by all preceding modules. Centralising it there
prevents the ownership rule from being bypassed by future controller changes.

**Alternatives considered**:
- *Middleware-level ownership gate* — rejected: middleware does not have access
  to the ticket entity without an additional DB query, and cross-cutting auth
  middleware for resource ownership is an anti-pattern.

---

## Decision 7: De-escalation Entity — Separate Table vs. Reuse of EscalationEvent

**Decision**: Use a separate `DeEscalationEvent` table (`id, ticketId, performedById,
resolutionNote, createdAt`). The `EscalationEvent` table is kept immutable and
typed to escalation events only (`AUTO` and `MANUAL`).

**Rationale**: De-escalation has a mandatory `resolutionNote` field that has no
meaning on an escalation event, and its read patterns (per-ticket history, manager
audit) are distinct. Keeping the tables separate avoids nullable columns and
`type` discriminator hacks, and makes the audit log query for de-escalations
straightforward without filtering by type.

**Alternatives considered**:
- *Add `DE_ESCALATION` as a type on `EscalationEvent`* — rejected: forces
  `reason` (manual escalation) and `resolutionNote` (de-escalation) to share
  a nullable column, complicating validation and display logic.

---

## Decision 8: Handling Deactivated Escalation Target Users

**Decision**: During action execution in `EvaluateEscalationPoliciesUseCase`, for
each `NOTIFY_USER` action the use case fetches the target user's `accountStatus`.
If `accountStatus !== ACTIVE`, the action is skipped; an `EscalationEventTarget`
row is written with `skipped = true` and `skipReason = 'USER_DEACTIVATED'`.
Remaining targets continue to be notified. For `NOTIFY_ROLE` actions, the use
case fetches all active users with the target role and notifies each.

**Rationale**: Spec edge case: deactivated targets must be skipped but the skip
must be logged. Recording the skip in `EscalationEventTarget` preserves the
audit trail. Spec FR-030 requires targets notified to be logged; skipped targets
must also appear for completeness.

**Alternatives considered**:
- *Validate targets at policy creation time* — insufficient: users may be
  deactivated after policy creation; validation would give false safety.

---

## Summary: All Decisions Resolved

| Question | Resolution |
|----------|-----------|
| Scheduler technology | `node-cron` in-process; Infrastructure wrapper calls Application use case |
| Fired-tier tracking schema | `TicketPolicyEscalationState` with `firedTierOrdinals Int[]` array; unique on `(ticketId, policyId)` |
| Notification deduplication | Application-layer merge by `recipientId` per evaluation run before calling `NotificationService` |
| Policy evaluation query pattern | One query per policy; time arithmetic in-process via `date-fns` |
| `isEscalated` flag atomicity | Same Prisma transaction as `EscalationEvent` write and activity log entry |
| Manual escalation authorization | Use-case layer ownership check: agent → own ticket only; manager/admin → any ticket |
| De-escalation entity | Separate `DeEscalationEvent` table; `EscalationEvent` remains escalation-only |
| Deactivated target handling | Skip and log `EscalationEventTarget` row with `skipped=true`; remaining targets notified |
