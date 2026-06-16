# Data Model: Ticket Management

**Feature**: 003-ticket-management
**Date**: 2026-06-16
**Depends on**: `001-user-auth` (User, Role, AccountStatus), `002-customer-management` (Customer, Organization)

---

## Entity Relationships

```
User (auth) ──────────────────< Ticket (via customerId)
User (auth) ──────────────────< Ticket (via assignedAgentId, nullable)
TicketCategory ───────────────< Ticket (via categoryId, nullable)
Ticket ───────────────────────< TicketComment
Ticket ───────────────────────< TicketActivityLogEntry
TicketComment ────────────────< TicketAttachment
```

---

## Entity: Ticket

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `referenceNumber` | String | Unique, NOT NULL | e.g. `TKT-00001`; generated from sequence |
| `title` | String | NOT NULL | Max 200 chars |
| `description` | String | NOT NULL | Max 5,000 chars |
| `status` | Enum | NOT NULL, default OPEN | See status enum below |
| `priority` | Enum | NOT NULL, default MEDIUM | LOW, MEDIUM, HIGH, CRITICAL |
| `categoryId` | UUID? | FK → TicketCategory.id, nullable | SetNull on category deactivation |
| `customerId` | UUID | FK → User.id, NOT NULL | Ticket owner (Customer role) |
| `assignedAgentId` | UUID? | FK → User.id, nullable | Assigned Support Agent |
| `isEscalated` | Boolean | NOT NULL, default false | Set by Escalation module |
| `resolvedAt` | DateTime? | Nullable | Set when status → RESOLVED |
| `closedAt` | DateTime? | Nullable | Set when status → CLOSED or CANCELLED |
| `createdAt` | DateTime | NOT NULL, auto-set | |
| `updatedAt` | DateTime | NOT NULL, auto-updated | Used for auto-close threshold |

**Status Enum**: `OPEN`, `IN_PROGRESS`, `PENDING`, `RESOLVED`, `CLOSED`, `CANCELLED`

**Valid Status Transitions** (enforced by `TicketStatusStateMachine` in Domain layer):

```
OPEN        → IN_PROGRESS, CANCELLED
IN_PROGRESS → PENDING, RESOLVED, OPEN
PENDING     → IN_PROGRESS
RESOLVED    → CLOSED, IN_PROGRESS
CLOSED      → (none)
CANCELLED   → (none)
```

**Indexes**: `customerId`, `assignedAgentId`, `status`, `priority`, `categoryId`,
`(status, priority)` composite, `(customerId, status)` composite

**Auto-close rule**: Tickets with `status = RESOLVED` and
`updatedAt ≤ NOW() - 7 days` are transitioned to `CLOSED` by the
`AutoCloseTicketsUseCase` on a scheduled basis.

---

## Entity: TicketCategory

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `name` | String | Unique, NOT NULL | Max 100 chars |
| `isActive` | Boolean | NOT NULL, default true | Deactivated categories hidden from selection |
| `createdAt` | DateTime | NOT NULL, auto-set | |
| `updatedAt` | DateTime | NOT NULL, auto-updated | |

**Rules**: Deactivating a category does NOT nullify existing ticket `categoryId`
values — tickets retain their category label for display. Only active categories
appear in the create/update ticket category selector.

---

## Entity: TicketComment

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `ticketId` | UUID | FK → Ticket.id, NOT NULL | Cascade delete |
| `authorId` | UUID | FK → User.id, NOT NULL | |
| `body` | String | NOT NULL | Max 10,000 chars |
| `isInternalNote` | Boolean | NOT NULL, default false | Invisible to Customer role |
| `createdAt` | DateTime | NOT NULL, auto-set | |

**Indexes**: `(ticketId, createdAt)` for chronological comment retrieval

**Visibility rule**: Customers MUST NOT see comments where `isInternalNote = true`.
Filtering applied in `ListCommentsUseCase` before returning results; Prisma query
also excludes internal notes for Customer callers to avoid unnecessary data fetch.

**Status side-effects** (enforced in use case, not DB):
- Customer comment on PENDING ticket → ticket status changes to IN_PROGRESS
- Customer comment on RESOLVED ticket → ticket status changes to IN_PROGRESS
- Agent internal note → no status change
- CLOSED or CANCELLED ticket → comment rejected (ForbiddenError)

---

## Entity: TicketAttachment

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `commentId` | UUID | FK → TicketComment.id, NOT NULL | Cascade delete |
| `fileName` | String | NOT NULL | Original file name; max 255 chars |
| `mimeType` | String | NOT NULL | MIME type; validated allowlist |
| `fileSizeBytes` | Int | NOT NULL | Must be ≤ 10,485,760 (10 MB) |
| `storageKey` | String | NOT NULL | S3 object key; used to generate download URL |
| `createdAt` | DateTime | NOT NULL, auto-set | |

**Allowed MIME types**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`,
`application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`,
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
`text/plain`, `application/zip`

**Rules**: Max 5 attachments per comment (validated at presigned-URL request time);
each ≤ 10 MB. Entire comment submission is atomic — if attachment confirmation
fails for any file, the comment record is rolled back.

---

## Entity: TicketActivityLogEntry

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `ticketId` | UUID | FK → Ticket.id, NOT NULL | Cascade delete |
| `event` | Enum | NOT NULL | See event types below |
| `actorId` | UUID? | FK → User.id, nullable | Null for system-generated events |
| `previousValue` | String? | Nullable | Stringified previous state |
| `newValue` | String? | Nullable | Stringified new state |
| `createdAt` | DateTime | NOT NULL, auto-set | |

**Event Enum**: `CREATED`, `STATUS_CHANGED`, `PRIORITY_CHANGED`, `CATEGORY_CHANGED`,
`ASSIGNED`, `REASSIGNED`, `UNASSIGNED`, `COMMENT_ADDED`, `INTERNAL_NOTE_ADDED`,
`AUTO_CLOSED`, `ESCALATED`, `DE_ESCALATED`, `ATTACHMENT_ADDED`

**Rules**: Append-only; no UPDATE or DELETE. Written in the same Prisma transaction
as the state-changing operation to guarantee 100% capture (spec SC-003).

**Customer visibility**: `INTERNAL_NOTE_ADDED` entries are filtered from the
activity log when a Customer role requests the log.

---

## Prisma Schema (reference)

```prisma
enum TicketStatus {
  OPEN
  IN_PROGRESS
  PENDING
  RESOLVED
  CLOSED
  CANCELLED
}

enum TicketPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum TicketActivityEvent {
  CREATED
  STATUS_CHANGED
  PRIORITY_CHANGED
  CATEGORY_CHANGED
  ASSIGNED
  REASSIGNED
  UNASSIGNED
  COMMENT_ADDED
  INTERNAL_NOTE_ADDED
  AUTO_CLOSED
  ESCALATED
  DE_ESCALATED
  ATTACHMENT_ADDED
}

model TicketCategory {
  id        String   @id @default(uuid())
  name      String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tickets   Ticket[]
}

model Ticket {
  id               String         @id @default(uuid())
  referenceNumber  String         @unique
  title            String
  description      String
  status           TicketStatus   @default(OPEN)
  priority         TicketPriority @default(MEDIUM)
  categoryId       String?
  customerId       String
  assignedAgentId  String?
  isEscalated      Boolean        @default(false)
  resolvedAt       DateTime?
  closedAt         DateTime?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  category         TicketCategory?         @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  customer         User                    @relation("CustomerTickets", fields: [customerId], references: [id])
  assignedAgent    User?                   @relation("AgentTickets", fields: [assignedAgentId], references: [id])
  comments         TicketComment[]
  activityLog      TicketActivityLogEntry[]

  @@index([customerId])
  @@index([assignedAgentId])
  @@index([status])
  @@index([priority])
  @@index([categoryId])
  @@index([status, priority])
  @@index([customerId, status])
}

model TicketComment {
  id             String    @id @default(uuid())
  ticketId       String
  authorId       String
  body           String
  isInternalNote Boolean   @default(false)
  createdAt      DateTime  @default(now())

  ticket         Ticket             @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  author         User               @relation(fields: [authorId], references: [id])
  attachments    TicketAttachment[]

  @@index([ticketId, createdAt])
}

model TicketAttachment {
  id            String   @id @default(uuid())
  commentId     String
  fileName      String
  mimeType      String
  fileSizeBytes Int
  storageKey    String
  createdAt     DateTime @default(now())

  comment       TicketComment @relation(fields: [commentId], references: [id], onDelete: Cascade)
}

model TicketActivityLogEntry {
  id            String              @id @default(uuid())
  ticketId      String
  event         TicketActivityEvent
  actorId       String?
  previousValue String?
  newValue      String?
  createdAt     DateTime            @default(now())

  ticket        Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  actor         User?  @relation(fields: [actorId], references: [id])

  @@index([ticketId, createdAt])
}
```

> **Note**: `ticket_reference_seq` is defined in a raw Prisma migration:
> ```sql
> CREATE SEQUENCE IF NOT EXISTS ticket_reference_seq START 1 INCREMENT 1;
> ```
> The repository calls `SELECT nextval('ticket_reference_seq')` within the
> ticket creation transaction.
