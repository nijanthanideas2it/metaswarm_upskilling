# Data Model: Escalation Management

**Feature**: 005-escalation-management
**Date**: 2026-06-16
**Depends on**: `001-user-auth` (User, Role, AccountStatus), `002-customer-management`
(Customer), `003-ticket-management` (Ticket, TicketCategory, TicketPriority,
TicketActivityLogEntry), `004-ticket-assignment` (no schema dependency)

---

## Entity Relationships

```
Ticket (003)          ──────────────────< EscalationEvent (via ticketId)
EscalationPolicy      ────────────────── EscalationEvent (via policyId, nullable)
EscalationTier        ────────────────── EscalationEvent (via tierId, nullable)
EscalationEvent       ────────────────── EscalationEventTarget (via eventId)
User (auth)           ────────────────── EscalationEvent (via escalatedById, nullable)
User (auth)           ────────────────── EscalationEventTarget (via recipientId)

EscalationPolicy      ──────────────────< EscalationTier (via policyId)
EscalationTier        ──────────────────< EscalationAction (via tierId)

Ticket (003)          ──────────────────< TicketPolicyEscalationState (via ticketId)
EscalationPolicy      ──────────────────< TicketPolicyEscalationState (via policyId)

Ticket (003)          ──────────────────< DeEscalationEvent (via ticketId)
User (auth)           ──────────────────< DeEscalationEvent (via performedById)
```

---

## Migration Delta: Ticket (module 003 addition)

The `Ticket` model already has `isEscalated Boolean @default(false)` from module
003. This module adds one new nullable field via a non-destructive migration:

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `escalatedAt` | DateTime? | Nullable | Set to `NOW()` when `isEscalated` flips to `true`; nulled when de-escalated |

**Migration SQL** (applied via Prisma migration file):

```sql
ALTER TABLE "Ticket" ADD COLUMN "escalatedAt" TIMESTAMP(3);
```

**Index added**:

```sql
CREATE INDEX "Ticket_isEscalated_escalatedAt_idx" ON "Ticket" ("isEscalated", "escalatedAt");
```

This index supports the escalated ticket queue query:
`WHERE isEscalated = true ORDER BY priority DESC, escalatedAt ASC`.

---

## Entity: EscalationPolicy

Defines a named, scopeable set of ordered escalation tiers. An active policy
participates in evaluation cycles; an inactive policy is excluded.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `name` | String | Unique, NOT NULL | Max 150 chars |
| `description` | String? | Nullable | Max 500 chars |
| `scopeCategories` | String[] | NOT NULL, default `[]` | Array of TicketCategory IDs; empty = all categories |
| `scopePriorities` | Enum[] | NOT NULL, default `[]` | Array of `TicketPriority` values; empty = all priorities |
| `isActive` | Boolean | NOT NULL, default false | Must be explicitly activated |
| `createdAt` | DateTime | NOT NULL, auto-set | |
| `updatedAt` | DateTime | NOT NULL, auto-updated | |

**Rules**:
- A policy with `scopeCategories = []` AND `scopePriorities = []` applies to
  all tickets (FR-002).
- A policy MUST have at least 1 and at most 5 tiers before it can be activated
  (FR-003). Activation attempt with 0 tiers returns a `VALIDATION_ERROR`.
- Deletion is blocked while `isActive = true` (FR-007); must deactivate first.

**Indexes**: `isActive`, `name` (unique)

---

## Entity: EscalationTier

A single timed escalation level within a policy. Tiers fire in ascending `ordinal`
order; once a tier fires, it cannot fire again for the same ticket–policy pair.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `policyId` | UUID | FK → EscalationPolicy.id, NOT NULL | Cascade delete |
| `ordinal` | Int | NOT NULL, 1–5 | Position in policy; unique per policy |
| `triggerCondition` | Enum | NOT NULL | `TIME_SINCE_CREATION`, `TIME_SINCE_LAST_COMMENT`, `TIME_UNASSIGNED` |
| `thresholdHours` | Int | NOT NULL, ≥ 1 | Hours elapsed before this tier fires |
| `createdAt` | DateTime | NOT NULL, auto-set | |

**Rules**:
- `ordinal` is unique within a policy: `@@unique([policyId, ordinal])`.
- `thresholdHours` for Tier N must be > `thresholdHours` for Tier N-1 (validated
  in use case, not DB constraint).
- Deleting a tier from an active policy is not permitted; deactivate policy first.

**Indexes**: `(policyId, ordinal)` unique

---

## Entity: EscalationAction

A single executable action belonging to one tier. One tier may have multiple
actions of different types.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `tierId` | UUID | FK → EscalationTier.id, NOT NULL | Cascade delete |
| `actionType` | Enum | NOT NULL | `NOTIFY_USER`, `NOTIFY_ROLE`, `REASSIGN`, `ELEVATE_PRIORITY` |
| `targetUserId` | UUID? | FK → User.id, nullable, SetNull | Required when `actionType = NOTIFY_USER` or `REASSIGN` |
| `targetRole` | Enum? | Nullable | Required when `actionType = NOTIFY_ROLE`; one of `SUPPORT_MANAGER`, `ADMIN` |
| `createdAt` | DateTime | NOT NULL, auto-set | |

**Rules**:
- `NOTIFY_USER` requires `targetUserId != null`; `targetRole` must be null.
- `NOTIFY_ROLE` requires `targetRole != null`; `targetUserId` must be null.
- `REASSIGN` requires `targetUserId != null` (the target agent); `targetRole`
  must be null.
- `ELEVATE_PRIORITY` requires both `targetUserId` and `targetRole` to be null.
- Validated in `AddEscalationTierUseCase` / `UpdateEscalationTierUseCase`.

**Indexes**: `tierId`

---

## Entity: EscalationEvent

Immutable audit record of a single escalation occurrence — either automatic (the
evaluation job fired a tier) or manual (an agent/manager escalated explicitly).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `ticketId` | UUID | FK → Ticket.id, NOT NULL | Cascade delete |
| `policyId` | UUID? | FK → EscalationPolicy.id, nullable, SetNull | Present for AUTO events; null for MANUAL |
| `tierId` | UUID? | FK → EscalationTier.id, nullable, SetNull | Present for AUTO events; null for MANUAL |
| `type` | Enum | NOT NULL | `AUTO`, `MANUAL` |
| `reason` | String? | Nullable | Required for MANUAL escalations (max 1,000 chars); null for AUTO |
| `escalatedById` | UUID? | FK → User.id, nullable, SetNull | Set for MANUAL; null for AUTO (system actor) |
| `createdAt` | DateTime | NOT NULL, auto-set | |

**Rules**:
- Append-only; no UPDATE or DELETE.
- For MANUAL events: `reason != null`, `escalatedById != null`, `policyId = null`,
  `tierId = null`.
- For AUTO events: `policyId != null`, `tierId != null`, `reason = null`,
  `escalatedById = null`.

**Indexes**: `ticketId`, `policyId`, `(type, createdAt)`, `createdAt`

---

## Entity: EscalationEventTarget

Records each notification recipient for an escalation event, including skipped
targets (e.g., deactivated users).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `eventId` | UUID | FK → EscalationEvent.id, NOT NULL | Cascade delete |
| `recipientId` | UUID | FK → User.id, NOT NULL | Target user |
| `skipped` | Boolean | NOT NULL, default false | True if notification was not sent |
| `skipReason` | String? | Nullable | e.g., `USER_DEACTIVATED`; present only when `skipped = true` |

**Indexes**: `eventId`, `recipientId`

---

## Entity: TicketPolicyEscalationState

Per-(ticket, policy) state tracking which tier ordinals have already fired.
Prevents duplicate tier execution across evaluation cycles.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `ticketId` | UUID | FK → Ticket.id, NOT NULL | Cascade delete |
| `policyId` | UUID | FK → EscalationPolicy.id, NOT NULL | Cascade delete |
| `firedTierOrdinals` | Int[] | NOT NULL, default `[]` | Ordinals (1–5) that have already fired |
| `updatedAt` | DateTime | NOT NULL, auto-updated | |

**Rules**:
- Unique constraint on `(ticketId, policyId)` — at most one row per pair.
- Row is created (with empty array) on first evaluation match and updated via
  `push` each time a tier fires; upsert pattern in repository.
- Row is NOT deleted when a ticket is de-escalated; de-escalation only clears
  `isEscalated` on the ticket (FR-027 — unfired tiers may still fire).

**Indexes**: `(ticketId, policyId)` unique

---

## Entity: DeEscalationEvent

Immutable audit record of a de-escalation action. Kept separate from
`EscalationEvent` to avoid nullable column mixing and to simplify queries.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `ticketId` | UUID | FK → Ticket.id, NOT NULL | Cascade delete |
| `performedById` | UUID | FK → User.id, NOT NULL | Manager or Admin who de-escalated |
| `resolutionNote` | String | NOT NULL | Max 1,000 chars; mandatory (FR-023) |
| `createdAt` | DateTime | NOT NULL, auto-set | |

**Rules**:
- Append-only; no UPDATE or DELETE.
- Written in same transaction as `Ticket.isEscalated = false` and
  `Ticket.escalatedAt = null`.

**Indexes**: `ticketId`, `createdAt`

---

## Full Prisma Schema (new models for this module)

```prisma
// ── New enums ──────────────────────────────────────────────────────────────

enum TriggerCondition {
  TIME_SINCE_CREATION
  TIME_SINCE_LAST_COMMENT
  TIME_UNASSIGNED
}

enum EscalationActionType {
  NOTIFY_USER
  NOTIFY_ROLE
  REASSIGN
  ELEVATE_PRIORITY
}

enum EscalationEventType {
  AUTO
  MANUAL
}

// ── Ticket model delta (migration adds escalatedAt only) ───────────────────
// The full Ticket model is defined in 003-ticket-management.
// The migration file adds:
//   escalatedAt DateTime?
// and the index:
//   @@index([isEscalated, escalatedAt])
//
// Prisma model amendment (merge into the existing Ticket model block):
//
//   escalatedAt  DateTime?
//   @@index([isEscalated, escalatedAt])

// ── New models ─────────────────────────────────────────────────────────────

model EscalationPolicy {
  id               String           @id @default(uuid())
  name             String           @unique
  description      String?
  scopeCategories  String[]         @default([])
  scopePriorities  TicketPriority[] @default([])
  isActive         Boolean          @default(false)
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  tiers            EscalationTier[]
  events           EscalationEvent[]
  escalationStates TicketPolicyEscalationState[]

  @@index([isActive])
}

model EscalationTier {
  id               String             @id @default(uuid())
  policyId         String
  ordinal          Int
  triggerCondition TriggerCondition
  thresholdHours   Int
  createdAt        DateTime           @default(now())

  policy           EscalationPolicy   @relation(fields: [policyId], references: [id], onDelete: Cascade)
  actions          EscalationAction[]
  events           EscalationEvent[]

  @@unique([policyId, ordinal])
}

model EscalationAction {
  id           String              @id @default(uuid())
  tierId       String
  actionType   EscalationActionType
  targetUserId String?
  targetRole   UserRole?
  createdAt    DateTime            @default(now())

  tier         EscalationTier @relation(fields: [tierId], references: [id], onDelete: Cascade)
  targetUser   User?          @relation("EscalationActionTarget", fields: [targetUserId], references: [id], onDelete: SetNull)

  @@index([tierId])
}

model EscalationEvent {
  id             String             @id @default(uuid())
  ticketId       String
  policyId       String?
  tierId         String?
  type           EscalationEventType
  reason         String?
  escalatedById  String?
  createdAt      DateTime           @default(now())

  ticket         Ticket             @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  policy         EscalationPolicy?  @relation(fields: [policyId], references: [id], onDelete: SetNull)
  tier           EscalationTier?    @relation(fields: [tierId], references: [id], onDelete: SetNull)
  escalatedBy    User?              @relation("EscalationEventActor", fields: [escalatedById], references: [id], onDelete: SetNull)
  targets        EscalationEventTarget[]

  @@index([ticketId])
  @@index([policyId])
  @@index([type, createdAt])
  @@index([createdAt])
}

model EscalationEventTarget {
  id           String  @id @default(uuid())
  eventId      String
  recipientId  String
  skipped      Boolean @default(false)
  skipReason   String?

  event        EscalationEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  recipient    User            @relation("EscalationEventRecipient", fields: [recipientId], references: [id])

  @@index([eventId])
  @@index([recipientId])
}

model TicketPolicyEscalationState {
  id                String   @id @default(uuid())
  ticketId          String
  policyId          String
  firedTierOrdinals Int[]    @default([])
  updatedAt         DateTime @updatedAt

  ticket            Ticket           @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  policy            EscalationPolicy @relation(fields: [policyId], references: [id], onDelete: Cascade)

  @@unique([ticketId, policyId])
}

model DeEscalationEvent {
  id             String   @id @default(uuid())
  ticketId       String
  performedById  String
  resolutionNote String
  createdAt      DateTime @default(now())

  ticket         Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  performedBy    User   @relation("DeEscalationEventActor", fields: [performedById], references: [id])

  @@index([ticketId])
  @@index([createdAt])
}
```

> **Note on `UserRole`**: The `UserRole` enum is defined in the `001-user-auth`
> module schema. The `NOTIFY_ROLE` action targets `SUPPORT_MANAGER` or `ADMIN`
> only, validated in the Application layer. The Prisma field type reuses the
> existing enum; no new enum is required.
>
> **Note on `TicketPriority`**: Defined in `003-ticket-management`. Reused in
> `EscalationPolicy.scopePriorities` without redefinition.
