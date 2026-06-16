# Research: Ticket Assignment

**Feature**: 004-ticket-assignment
**Date**: 2026-06-16
**Status**: Complete — all design decisions resolved

---

## Decision 1: Rules Engine Execution Model

**Decision**: Synchronous in-process evaluation at ticket creation time. The
`AssignmentRulesEngine` service in the Application layer is called by
`ticket-created.hook.ts`, which is registered with the `003-ticket-management`
module at app startup via dependency injection. Rules are loaded in a single
`findMany` query per evaluation (`{ where: { isActive: true }, orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }] }`)
and evaluated sequentially until the first match. On match, the engine delegates
to `GetTeamMemberSelectionUseCase` (team target) or assigns directly (agent
target), then writes a `TicketActivityLogEntry` — all within the same Prisma
interactive transaction initiated by the hook.

**Rationale**: The synchronous in-process model meets the 5-second auto-assignment
SLA at the stated scale (≤500 concurrent users, ≤50 active rules). It requires no
additional infrastructure, keeps the entire assignment visible in a single
request trace, and allows the creation response to include the assigned agent.
Loading all active rules once per evaluation avoids N+1 and is acceptable given
the ≤50 rule limit.

**Alternatives considered**:
- *Async queue (BullMQ/Redis)* — deferred: solves higher concurrency (>500 users)
  but adds Redis dependency and makes the assignment asynchronous, complicating
  the client UX for v1.
- *External rules engine (Drools, json-rules-engine)* — rejected: over-engineered
  for ≤50 rules; adds a dependency with its own schema model, making type safety
  and testing harder.
- *Database-level triggers* — rejected: moves business logic out of the Application
  layer; untestable in unit tests without a database connection.

---

## Decision 2: Team Member Selection Algorithm

**Decision**: `GetTeamMemberSelectionUseCase` runs a single Prisma aggregation
query — a `$queryRaw` GROUP BY — that joins `TeamMembership`, `AgentAvailability`,
and `Ticket` tables in one pass. For each `AVAILABLE` member of the team, it
counts tickets where `status IN ('OPEN', 'IN_PROGRESS')`. Results are sorted
`openTicketCount ASC, teamMembership.joinedAt ASC`. The first row is the selected
agent. If the result set is empty (no AVAILABLE members), the function returns
`null` and the engine falls back to team-only association (FR-018).

**Rationale**: A single aggregation query is the only approach that avoids N+1
under the "fewest open tickets" requirement. The tiebreaker (`joinedAt ASC`) uses
an already-indexed column on `TeamMembership`. This satisfies the ≤200 ms p95
constraint and the "no N+1" constitution gate.

**Alternatives considered**:
- *Load all members, count tickets with separate queries* — rejected: O(N) queries
  per team member; N+1 anti-pattern.
- *Round-robin via a `lastAssignedAt` column* — deferred: simpler to implement but
  does not balance workload when ticket resolution times vary; deferred to v2.
- *Application-level sorting after fetching raw counts* — viable but unnecessary;
  SQL ORDER BY handles it correctly and the DB can use the index.

---

## Decision 3: Availability Schedule Timezone Handling

**Decision**: `AgentAvailabilitySchedule` stores `dayOfWeek` (0–6), `startTimeUtc`
(HH:MM string), `endTimeUtc` (HH:MM string), and `timezone` (IANA string, e.g.
`"America/New_York"`). At schedule creation/update, the agent's submitted local
times are converted to UTC using `luxon`: `DateTime.fromObject({ hour, minute }, { zone: agentTimezone }).toUTC()`.
The `AvailabilityScheduleValueObject.isActiveNow(utcNow: DateTime): boolean`
method checks whether the current UTC moment falls within any of the agent's
active schedule windows. A manually set `OFFLINE` status overrides schedule
evaluation — the method is only called when the agent's `AgentAvailability.status`
is not explicitly `OFFLINE` (FR-026).

**Rationale**: Storing times in UTC sidesteps DST edge cases at read time — the
conversion happens once at write, not on every engine evaluation. Keeping the
original timezone string alongside UTC values allows the UI to display the
schedule in the agent's local time without a reverse lookup. `luxon` provides a
reliable IANA timezone database.

**Alternatives considered**:
- *Store local times only, convert at evaluation* — rejected: conversion on every
  rule evaluation (potentially many agents) increases CPU load and DST bugs compound
  over time.
- *Store UTC offset (e.g. +05:30) instead of IANA zone* — rejected: offsets do not
  account for DST transitions; agents would get incorrect windows twice a year.
- *date-fns-tz* — viable alternative to `luxon`; `luxon` chosen for its
  first-class `DateTime` object model and superior TypeScript types.

---

## Decision 4: Rank Conflict Detection

**Decision**: `AssignmentRule.rank` is a plain `Int` (not unique at the DB level)
to allow multiple rules to share the same rank without a constraint violation. The
`ListAssignmentRulesUseCase` executes a secondary `$queryRaw` GROUP BY after
fetching the rules list:
```sql
SELECT rank FROM "AssignmentRule"
WHERE "isActive" = true
GROUP BY rank HAVING COUNT(*) > 1
```
Any rule whose rank appears in this conflicted-rank set is annotated with
`hasConflict: true` in the response DTO. The conflict is surfaced in the rules
list UI for the manager to resolve. It does not block saves, creation, or engine
evaluation — the engine itself uses `orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }]`
so the earlier-created rule fires first (FR-011).

**Rationale**: Blocking saves on rank conflict would be counterproductive —
managers reordering a large rule list need to pass through transient conflict
states. Surfacing the conflict as a flag allows the UI to prompt resolution without
preventing saves. Engine evaluation remains deterministic via `createdAt` tiebreaker.

**Alternatives considered**:
- *Unique constraint on `rank`* — rejected: forces the client to do a two-phase
  "gap and shift" reorder, complicating the reorder endpoint and creating locking
  risks.
- *Fractional rank (Float)* — deferred: solves insertion between ranks without
  shifting, but adds complexity; acceptable for v2 if rule lists grow beyond 50.

---

## Decision 5: Team Deactivation Cascade

**Decision**: `DeactivateTeamUseCase` runs entirely within a Prisma interactive
transaction:
1. Set `SupportTeam.isActive = false`.
2. Query all `AssignmentRule` where `targetTeamId = teamId AND isActive = true`.
3. Bulk-set those rules to `isActive = false`.
4. Write a `TicketActivityLogEntry`-style audit record for each deactivated rule
   (using a new `RULE_AUTO_DEACTIVATED` event in the `TicketActivityEvent` enum
   extension, or a separate audit log — see data model).
5. Return the list of affected rule `id` and `name` values in the response body.

The controller includes `affectedRules: [{ id, name }]` in the `data` response so
the manager can immediately see what was changed (FR-005).

**Rationale**: Running inside a single transaction guarantees that a team is never
left active with targeting rules silently broken, and that rule deactivation is
never left partial if the DB write fails. Returning affected rules in the response
body avoids the need for a separate follow-up query by the client.

**Alternatives considered**:
- *DB-level CASCADE or trigger* — rejected: moves business logic out of the
  Application layer; trigger output cannot be surfaced in the HTTP response.
- *Async background job* — rejected: creates a window where a deactivated team's
  rules are still active; synchronous transaction is safer.

---

## Decision 6: Workload Summary Query and Caching

**Decision**: `GetWorkloadSummaryUseCase` runs a single `$queryRaw` that JOINs
`User`, `TeamMembership`, `AgentAvailability`, and `Ticket` tables in one pass,
counting `OPEN` and `IN_PROGRESS` tickets per agent and collecting team names via
`STRING_AGG`. Results are cached in a module-scoped `Map<string, { data, expiresAt }>` 
with a 25-second TTL (just under the 30-second freshness requirement from SC-004).
The cache key is `"workload"` for the global summary and `"workload:teamId:<uuid>"`
for team-filtered views. The cache entry is invalidated immediately on any call to
`SetAvailabilityStatusUseCase` (availability change) or when a ticket assignment
event fires. Cache entries also expire naturally at 25 seconds.

**Rationale**: A single denormalized query prevents N+1 per agent and meets the
≤3-second workload load time (SC-002). The 25-second TTL means the workload view
is never more than 25 seconds stale, satisfying the 30-second propagation window
(SC-004). An in-memory Map cache avoids adding Redis for a single use case; if the
service scales to multiple replicas, each replica caches independently — acceptable
for the single-org v1 deployment.

**Alternatives considered**:
- *Redis cache* — deferred: adds infrastructure; acceptable for multi-replica v2
  deployments.
- *Materialized view in PostgreSQL* — deferred: fast reads but requires a scheduled
  refresh or triggers; adds migration complexity.
- *No cache, query on every request* — rejected: a 500-agent org with 30-second
  polling intervals would hit this query ~16 times/second under concurrent managers,
  risking DB pressure.

---

## Summary: All Decisions Resolved

| Question | Resolution |
|----------|-----------|
| Rules engine execution model | Synchronous in-process; single query per evaluation; registered via DI hook |
| Team member selection | Single `$queryRaw` aggregation; sort by `openTicketCount ASC, joinedAt ASC` |
| Availability schedule timezone | Store UTC + IANA timezone; convert at write using `luxon`; `isActiveNow()` at evaluation |
| Rank conflict detection | Non-unique `rank` column; `hasConflict` flag computed via GROUP BY HAVING in list query |
| Team deactivation cascade | Prisma interactive transaction; affected rule names returned in response body |
| Workload summary | Single `$queryRaw` JOIN; 25-second in-memory TTL cache; invalidated on availability change |
