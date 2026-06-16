# Data Model: Ticket Assignment

**Feature**: 004-ticket-assignment
**Date**: 2026-06-16
**Depends on**: `001-user-auth` (User, Role), `002-customer-management` (Organization), `003-ticket-management` (Ticket, TicketActivityLogEntry)

---

## Entity Relationships

```
User (auth) ──────────────────< TeamMembership >────────── SupportTeam
User (auth) ──────────────────< AgentAvailability (1:1)
User (auth) ──────────────────< AgentAvailabilitySchedule (1:7 max)
User (auth) ──────────────────< AssignmentRule (via targetAgentId, nullable)
SupportTeam ──────────────────< TeamMembership
SupportTeam ──────────────────< AssignmentRule (via targetTeamId, nullable)
SupportTeam ──────────────────< Ticket (via teamId, nullable) [migration delta]
AssignmentRule ───────────────< AssignmentRuleCondition

Ticket (003) ─── teamId (nullable) ──────────────────────> SupportTeam
Ticket (003) ─── assignedAgentId (nullable, pre-existing) > User
```

---

## Migration Delta: Ticket (003 → 004)

The `Ticket` model from `003-ticket-management` gains one new nullable field:

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `teamId` | String? | FK → SupportTeam.id, nullable | SetNull when the referenced team is deactivated |

> `assignedAgentId` already exists from module 003 and requires no change.
> An index on `teamId` is added for workload summary joins.

---

## Entity: SupportTeam

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String (UUID) | PK | |
| `name` | String | UNIQUE, NOT NULL | Max 100 chars; validated at use-case layer |
| `description` | String? | Nullable | Max 500 chars |
| `isActive` | Boolean | NOT NULL, default true | Deactivated teams removed from rule targets and routing |
| `createdAt` | DateTime | NOT NULL, auto-set | |
| `updatedAt` | DateTime | NOT NULL, auto-updated | |

**Indexes**: unique index on `name` (via `@unique`), `isActive` for list filtering.

**Business rules**:
- Deactivating a team triggers a cascade that deactivates all `AssignmentRule`
  rows with `targetTeamId = id` (enforced in `DeactivateTeamUseCase`, wrapped in
  a Prisma interactive transaction).
- Existing `Ticket.teamId` references are set to `null` (Prisma `onDelete: SetNull`)
  when a team is deleted. Deactivation does not delete — it only sets `isActive = false`.
- Only teams where `isActive = true` appear in rule-target selectors and are
  eligible to receive new ticket routing.

---

## Entity: TeamMembership

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String (UUID) | PK | |
| `teamId` | String | FK → SupportTeam.id, NOT NULL | Cascade delete when team is deleted |
| `agentId` | String | FK → User.id, NOT NULL | Cascade delete when user is deleted |
| `joinedAt` | DateTime | NOT NULL, default now() | Tiebreaker in member selection algorithm |

**Indexes**:
- `UNIQUE(teamId, agentId)` — one membership row per agent per team.
- `INDEX(agentId)` — for "which teams does this agent belong to" queries.
- `INDEX(teamId)` — for "who are the members of this team" queries (via Prisma relation).

**Business rules**:
- An agent may belong to multiple teams simultaneously (membership is additive).
- Removing an agent from a team does not affect their existing ticket assignments
  routed via that team.
- `joinedAt` is set automatically at membership creation and is immutable.

---

## Entity: AssignmentRule

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String (UUID) | PK | |
| `name` | String | UNIQUE, NOT NULL | Max 100 chars; unique rule name |
| `rank` | Int | NOT NULL | Not unique at DB level — conflicts allowed; see research Decision 4 |
| `isActive` | Boolean | NOT NULL, default true | Inactive rules are skipped by the engine |
| `targetAgentId` | String? | FK → User.id, nullable | Exactly one of targetAgentId / targetTeamId must be non-null |
| `targetTeamId` | String? | FK → SupportTeam.id, nullable | Exactly one of targetAgentId / targetTeamId must be non-null |
| `createdAt` | DateTime | NOT NULL, auto-set | Used as tiebreaker when two rules share the same rank |
| `updatedAt` | DateTime | NOT NULL, auto-updated | |

**Indexes**:
- `INDEX(rank, isActive)` — primary engine query: `WHERE isActive = true ORDER BY rank ASC, createdAt ASC`.
- `INDEX(targetTeamId)` — cascade deactivation query on team deactivation.
- Unique index on `name` (via `@unique`).

**Business rules**:
- Exactly one of `targetAgentId` or `targetTeamId` must be non-null; enforced at
  use-case layer (not DB). A CHECK constraint is documented here for defence-in-depth
  but is not implemented via a DB migration in v1.
- Rules are evaluated in ascending `rank` order. When two active rules share the
  same rank, the rule with the earlier `createdAt` takes precedence (FR-011).
- An active rule cannot be deleted (FR-014); it must be deactivated first.
- When the `targetTeamId`'s team is deactivated, this rule is also auto-deactivated
  by `DeactivateTeamUseCase`.
- The `rank` field is a plain integer to allow reordering without unique-constraint
  conflicts. Duplicate ranks are permitted and flagged as conflicts in the list API.

---

## Entity: AssignmentRuleCondition

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String (UUID) | PK | |
| `ruleId` | String | FK → AssignmentRule.id, NOT NULL | Cascade delete when rule is deleted |
| `field` | Enum (RuleConditionField) | NOT NULL | `CATEGORY`, `PRIORITY`, `ORGANISATION` |
| `operator` | Enum (RuleConditionOperator) | NOT NULL | `EQUALS`, `IN` |
| `value` | String | NOT NULL | For `EQUALS`: single string; for `IN`: JSON array string e.g. `'["HIGH","CRITICAL"]'` |

**Field Enum: RuleConditionField**: `CATEGORY`, `PRIORITY`, `ORGANISATION`

**Operator Enum: RuleConditionOperator**: `EQUALS`, `IN`

**Indexes**: `INDEX(ruleId)` — for fetching all conditions for a rule in a single query.

**Business rules**:
- Multiple conditions within a rule use AND logic — all must be satisfied for the
  rule to match (FR-009).
- `CATEGORY` conditions use `EQUALS` (single category name match).
- `PRIORITY` conditions may use `EQUALS` (single priority) or `IN` (set of priorities).
- `ORGANISATION` conditions use `EQUALS` (single organisation ID or name match).
- Condition values are validated against the field enum at the use-case layer;
  invalid values return `400 Bad Request`.
- A rule must have at least one condition; validated at create/update time.

---

## Entity: AgentAvailability

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String (UUID) | PK | |
| `agentId` | String | FK → User.id, UNIQUE, NOT NULL | One availability row per agent |
| `status` | Enum (AgentStatus) | NOT NULL, default AVAILABLE | Current real-time status |
| `updatedAt` | DateTime | NOT NULL, auto-updated | Used to determine recency; triggers cache invalidation |

**Status Enum: AgentStatus**: `AVAILABLE`, `BUSY`, `OFFLINE`

**Business rules**:
- One row per agent; upserted (created on first status set, updated thereafter).
- `BUSY` and `OFFLINE` agents are excluded from `GetTeamMemberSelectionUseCase`
  results (FR-023).
- Manual `OFFLINE` status overrides schedule — `AvailabilityScheduleValueObject.isActiveNow()`
  is only consulted when `status != OFFLINE` (FR-026).
- Status changes must be reflected in the assignment engine within 30 seconds (SC-004);
  the 25-second workload cache TTL and immediate cache invalidation on status change
  guarantee this.

---

## Entity: AgentAvailabilitySchedule

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String (UUID) | PK | |
| `agentId` | String | FK → User.id, NOT NULL | Not unique — one row per agent per day |
| `dayOfWeek` | Int | NOT NULL | 0 = Sunday, 1 = Monday, ..., 6 = Saturday |
| `startTimeUtc` | String | NOT NULL | UTC time string in `HH:MM` format |
| `endTimeUtc` | String | NOT NULL | UTC time string in `HH:MM` format |
| `timezone` | String | NOT NULL | IANA timezone string; e.g. `"America/New_York"` |

**Indexes**:
- `UNIQUE(agentId, dayOfWeek)` — one schedule entry per agent per day.
- `INDEX(agentId)` — for fetching an agent's full weekly schedule.

**Business rules**:
- When an agent submits their schedule, the local start/end times are converted
  to UTC using `luxon`: `DateTime.fromObject({ hour, minute }, { zone: agentTimezone }).toUTC()`.
  The original `timezone` string is stored alongside for UI display.
- An agent may have 0–7 schedule rows (one per day of week, or none at all).
- If no schedule rows exist for an agent, the schedule constraint is inactive;
  `AgentAvailability.status` is the sole routing gate.
- When the current UTC time falls outside all of an agent's schedule windows,
  `AvailabilityScheduleValueObject.isActiveNow()` returns `false`, and the engine
  treats the agent as OFFLINE regardless of their `AgentAvailability.status`
  (FR-025), unless `status = OFFLINE` already took precedence.
- Schedule rows are replaced wholesale on `PUT /api/v1/agent-availability/schedule`
  (delete all existing rows for the agent, insert new ones, within a transaction).

---

## Prisma Schema (reference)

```prisma
// ─── New Enums ────────────────────────────────────────────────────────────────

enum AgentStatus {
  AVAILABLE
  BUSY
  OFFLINE
}

enum RuleConditionField {
  CATEGORY
  PRIORITY
  ORGANISATION
}

enum RuleConditionOperator {
  EQUALS
  IN
}

// ─── Ticket model migration delta (add to existing Ticket model from 003) ─────
//
// Add to model Ticket:
//   teamId    String?
//   team      SupportTeam? @relation(fields: [teamId], references: [id], onDelete: SetNull)
//   @@index([teamId])

// ─── New Models ───────────────────────────────────────────────────────────────

model SupportTeam {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  memberships      TeamMembership[]
  assignmentRules  AssignmentRule[]
  tickets          Ticket[]

  @@index([isActive])
}

model TeamMembership {
  id       String   @id @default(uuid())
  teamId   String
  agentId  String
  joinedAt DateTime @default(now())

  team   SupportTeam @relation(fields: [teamId], references: [id], onDelete: Cascade)
  agent  User        @relation("AgentTeamMemberships", fields: [agentId], references: [id], onDelete: Cascade)

  @@unique([teamId, agentId])
  @@index([agentId])
}

model AssignmentRule {
  id            String   @id @default(uuid())
  name          String   @unique
  rank          Int
  isActive      Boolean  @default(true)
  targetAgentId String?
  targetTeamId  String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  targetAgent  User?        @relation("AgentTargetRules", fields: [targetAgentId], references: [id], onDelete: SetNull)
  targetTeam   SupportTeam? @relation(fields: [targetTeamId], references: [id], onDelete: SetNull)
  conditions   AssignmentRuleCondition[]

  @@index([rank, isActive])
  @@index([targetTeamId])
}

model AssignmentRuleCondition {
  id       String                @id @default(uuid())
  ruleId   String
  field    RuleConditionField
  operator RuleConditionOperator
  value    String

  rule AssignmentRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)

  @@index([ruleId])
}

model AgentAvailability {
  id        String      @id @default(uuid())
  agentId   String      @unique
  status    AgentStatus @default(AVAILABLE)
  updatedAt DateTime    @updatedAt

  agent User @relation("AgentAvailability", fields: [agentId], references: [id], onDelete: Cascade)
}

model AgentAvailabilitySchedule {
  id           String @id @default(uuid())
  agentId      String
  dayOfWeek    Int
  startTimeUtc String
  endTimeUtc   String
  timezone     String

  agent User @relation("AgentSchedule", fields: [agentId], references: [id], onDelete: Cascade)

  @@unique([agentId, dayOfWeek])
  @@index([agentId])
}
```

> **Migration notes**:
> - The `Ticket` model `teamId` field and its `@@index([teamId])` are added via a
>   new Prisma migration on top of the 003 baseline.
> - `onDelete: SetNull` on `AssignmentRule.targetAgentId` and `targetTeamId` ensures
>   rules are not hard-deleted when a user or team is removed; they become orphaned
>   targets and should be reviewed by an admin.
> - The mutual-exclusion constraint (exactly one of `targetAgentId`/`targetTeamId`)
>   is enforced at the use-case layer, not via a DB CHECK constraint in v1.
