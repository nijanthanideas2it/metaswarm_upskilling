# Data Model: Notifications

**Feature**: 006-notifications
**Date**: 2026-06-16
**Depends on**: `001-user-auth` (User, AccountStatus), `002-customer-management`
(Customer), `003-ticket-management` (Ticket, referenceNumber),
`004-ticket-assignment`, `005-escalation-management`

---

## Entity Relationships

```
User (auth) ───────────────────────< NotificationPreference (via userId)
User (auth) ───────────────────────< Notification (via recipientId)
User (auth) ───────────────────────< NotificationTemplate (via lastModifiedById)
NotificationEvent ─────────────────< Notification (via eventId)
Notification ───────────────────────< NotificationDeliveryAttempt (via notificationId)
```

---

## Entity: NotificationEvent

A structured, immutable record of an event emitted by an upstream module. One
event may produce multiple `Notification` rows (one per resolved recipient ×
channel).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `eventType` | Enum | NOT NULL | See `NotificationEventType` enum |
| `sourceEntityType` | String | NOT NULL | e.g. `"Ticket"` |
| `sourceEntityId` | UUID | NOT NULL | ID of the originating Ticket, etc. |
| `payload` | JSON | NOT NULL | Full event data used for template rendering and recipient resolution |
| `createdAt` | DateTime | NOT NULL, auto-set | |

**Indexes**: `(sourceEntityId, eventType)` for delivery log queries filtered by ticket

**Notes**: Append-only; never updated or deleted. `payload` contains all variables
needed to render templates (e.g., `ticketReference`, `agentName`, `customerName`).

---

## Entity: Notification

A single user-targeted delivery instance derived from a `NotificationEvent`.
One `Notification` per recipient per channel per event.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `eventId` | UUID | FK → NotificationEvent.id, NOT NULL | |
| `recipientId` | UUID | FK → User.id, NOT NULL | |
| `channel` | Enum | NOT NULL | `IN_APP`, `EMAIL` |
| `status` | Enum | NOT NULL, default PENDING | `PENDING`, `SENT`, `FAILED`, `SUPPRESSED` |
| `isRead` | Boolean | NOT NULL, default false | In-app only; always false for EMAIL channel |
| `scheduledFor` | DateTime? | Nullable | Set when quiet hours delay applies; null for immediate dispatch |
| `nextRetryAt` | DateTime? | Nullable | Set after a failed EMAIL attempt; null when no retry is pending |
| `attemptCount` | Int | NOT NULL, default 0 | Incremented on each delivery attempt |
| `createdAt` | DateTime | NOT NULL, auto-set | |
| `updatedAt` | DateTime | NOT NULL, auto-updated | |

**Status Enum**: `PENDING`, `SENT`, `FAILED`, `SUPPRESSED`

**Status transition rules**:
- `PENDING` → `SENT` (on successful delivery)
- `PENDING` → `FAILED` (after 3 failed attempts)
- `PENDING` → `SUPPRESSED` (recipient deactivated; set at creation, never re-evaluated)
- `FAILED` → `PENDING` (on admin manual retry; `attemptCount` reset to 2 so
  one more attempt is allowed; `nextRetryAt = NOW()`)

**Channel-specific rules**:
- `IN_APP`: `isRead` is meaningful; `scheduledFor` is always null; `nextRetryAt`
  is always null; no retry logic.
- `EMAIL`: `isRead` is always false; `scheduledFor` is set during quiet hours;
  `nextRetryAt` is set on failure; retry logic applies.

**Indexes**:
- `(recipientId, isRead, createdAt DESC)` — inbox list sorted newest-first, filtered by unread
- `(status, channel, nextRetryAt)` — retry job scan (`status=PENDING, channel=EMAIL, nextRetryAt<=NOW()`)
- `(status, channel, scheduledFor)` — quiet-hours release scan
- `(recipientId, createdAt)` — 90-day cleanup job
- `(eventId)` — cascade lookups from delivery log

---

## Entity: NotificationPreference

Per-user, per-event-type, per-channel on/off flag with optional quiet hours.
One row per unique `(userId, eventType, channel)` triple.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `userId` | UUID | FK → User.id, NOT NULL | |
| `eventType` | Enum | NOT NULL | `NotificationEventType` |
| `channel` | Enum | NOT NULL | `IN_APP`, `EMAIL` |
| `enabled` | Boolean | NOT NULL, default true | Whether to deliver on this channel for this event |
| `quietHoursStart` | String? | Nullable | `HH:MM` 24h format; EMAIL channel only |
| `quietHoursEnd` | String? | Nullable | `HH:MM` 24h format; EMAIL channel only |
| `quietHoursTimezone` | String? | Nullable | IANA timezone string, e.g. `"America/New_York"` |
| `createdAt` | DateTime | NOT NULL, auto-set | |
| `updatedAt` | DateTime | NOT NULL, auto-updated | |

**Unique constraint**: `(userId, eventType, channel)`

**Default preferences** (seeded at user registration — one row per event type ×
channel combination):

| Channel | Event Type | Default `enabled` |
|---------|------------|-------------------|
| IN_APP | all 10 event types | `true` |
| EMAIL | TICKET_ASSIGNED | `true` |
| EMAIL | TICKET_ESCALATED | `true` |
| EMAIL | TICKET_RESOLVED | `true` |
| EMAIL | all other 7 types | `false` |

**Quiet hours rules**:
- `quietHoursStart`, `quietHoursEnd`, `quietHoursTimezone` are only meaningful
  when `channel = EMAIL`.
- All three fields must be provided together (validated at API boundary).
- If `quietHoursStart = quietHoursEnd`, quiet hours are considered disabled
  (no window to hold).
- Midnight-spanning windows (e.g., `23:00`–`06:00`) are supported.

**Indexes**: `(userId, eventType, channel)` — unique index doubles as lookup key

---

## Entity: NotificationTemplate

One configurable template per `(eventType, channel)`. Stores current version and
a snapshot of the immediately previous version for admin reference.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `eventType` | Enum | NOT NULL | `NotificationEventType` |
| `channel` | Enum | NOT NULL | `IN_APP`, `EMAIL` |
| `subjectTemplate` | String? | Nullable | Email only; `null` for IN_APP channel |
| `bodyTemplate` | String | NOT NULL | Handlebars template with `{{variable}}` placeholders |
| `previousSubjectTemplate` | String? | Nullable | Snapshot of prior subjectTemplate before last edit |
| `previousBodyTemplate` | String? | Nullable | Snapshot of prior bodyTemplate before last edit |
| `lastModifiedById` | UUID? | FK → User.id, nullable | Admin who last saved; null for seed data |
| `lastModifiedAt` | DateTime? | Nullable | Timestamp of last admin edit; null for seed data |
| `createdAt` | DateTime | NOT NULL, auto-set | |
| `updatedAt` | DateTime | NOT NULL, auto-updated | |

**Unique constraint**: `(eventType, channel)` — exactly one template per pair

**Required variables**: Validated by `TemplateRendererService.validateRequiredVariables()`
before save. See research.md Decision 3 for the full required-variables map per
event type.

**Save workflow**:
1. Existing `bodyTemplate` (and `subjectTemplate`) are copied to `previousBodyTemplate`
   (and `previousSubjectTemplate`) before overwrite.
2. New content is validated for required variables.
3. Row is updated atomically — no intermediate invalid state.

**Seed data**: 20 default templates (10 event types × 2 channels) are created
by the initial migration with functional but minimal content. Each includes all
required variables so the system works out-of-the-box without admin configuration.

---

## Entity: NotificationDeliveryAttempt

An immutable audit record for a single delivery attempt. Never updated or deleted.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK | |
| `notificationId` | UUID | FK → Notification.id, NOT NULL | |
| `attemptNumber` | Int | NOT NULL | 1-based; max 4 (3 automatic + 1 admin retry) |
| `status` | Enum | NOT NULL | `SENT`, `FAILED` |
| `errorReason` | String? | Nullable | SMTP error message or validation warning; max 1,000 chars |
| `attemptedAt` | DateTime | NOT NULL, auto-set | |

**Indexes**: `(notificationId, attemptNumber)` — ordered lookup of attempts per notification

**Notes**: Append-only. Written in a Prisma transaction alongside the `Notification`
status + `nextRetryAt` update to guarantee consistency. The admin delivery log
view joins `NotificationDeliveryAttempt` to show attempt details.

---

## Prisma Schema (reference)

```prisma
enum NotificationEventType {
  TICKET_CREATED
  TICKET_ASSIGNED
  TICKET_REASSIGNED
  TICKET_STATUS_CHANGED
  TICKET_COMMENT_ADDED
  TICKET_RESOLVED
  TICKET_AUTO_CLOSED
  TICKET_ESCALATED
  TICKET_DE_ESCALATED
  TICKET_AUTO_ASSIGNED
}

enum NotificationChannel {
  IN_APP
  EMAIL
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
  SUPPRESSED
}

enum DeliveryAttemptStatus {
  SENT
  FAILED
}

model NotificationEvent {
  id               String                  @id @default(uuid())
  eventType        NotificationEventType
  sourceEntityType String
  sourceEntityId   String
  payload          Json
  createdAt        DateTime                @default(now())

  notifications    Notification[]

  @@index([sourceEntityId, eventType])
}

model Notification {
  id             String               @id @default(uuid())
  eventId        String
  recipientId    String
  channel        NotificationChannel
  status         NotificationStatus   @default(PENDING)
  isRead         Boolean              @default(false)
  scheduledFor   DateTime?
  nextRetryAt    DateTime?
  attemptCount   Int                  @default(0)
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  event          NotificationEvent            @relation(fields: [eventId], references: [id])
  recipient      User                         @relation(fields: [recipientId], references: [id])
  attempts       NotificationDeliveryAttempt[]

  @@index([recipientId, isRead, createdAt(sort: Desc)])
  @@index([status, channel, nextRetryAt])
  @@index([status, channel, scheduledFor])
  @@index([recipientId, createdAt])
  @@index([eventId])
}

model NotificationPreference {
  id                   String                @id @default(uuid())
  userId               String
  eventType            NotificationEventType
  channel              NotificationChannel
  enabled              Boolean               @default(true)
  quietHoursStart      String?               // "HH:MM" 24h
  quietHoursEnd        String?               // "HH:MM" 24h
  quietHoursTimezone   String?               // IANA tz string
  createdAt            DateTime              @default(now())
  updatedAt            DateTime              @updatedAt

  user                 User @relation(fields: [userId], references: [id])

  @@unique([userId, eventType, channel])
}

model NotificationTemplate {
  id                      String                @id @default(uuid())
  eventType               NotificationEventType
  channel                 NotificationChannel
  subjectTemplate         String?
  bodyTemplate            String
  previousSubjectTemplate String?
  previousBodyTemplate    String?
  lastModifiedById        String?
  lastModifiedAt          DateTime?
  createdAt               DateTime              @default(now())
  updatedAt               DateTime              @updatedAt

  lastModifiedBy          User? @relation(fields: [lastModifiedById], references: [id])

  @@unique([eventType, channel])
}

model NotificationDeliveryAttempt {
  id             String                @id @default(uuid())
  notificationId String
  attemptNumber  Int
  status         DeliveryAttemptStatus
  errorReason    String?
  attemptedAt    DateTime              @default(now())

  notification   Notification @relation(fields: [notificationId], references: [id])

  @@index([notificationId, attemptNumber])
}
```

> **Note on TypeScript enums**: The Prisma enum values are used directly. In
> application code, `const enum NotificationEventType`, `const enum NotificationChannel`,
> and `const enum NotificationStatus` are declared in the Domain layer and must
> match the Prisma schema values exactly. No runtime import of Prisma enums in
> the Domain or Application layers — the TypeScript enums are the canonical source;
> Prisma values are verified by integration tests.
