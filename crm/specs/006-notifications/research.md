# Research: Notifications

**Feature**: 006-notifications
**Date**: 2026-06-16
**Status**: Complete — all design decisions resolved

---

## Decision 1: In-App Real-Time Delivery — Server-Sent Events with Polling Fallback

**Decision**: Use Server-Sent Events (SSE) for real-time in-app delivery via a
persistent `GET /api/v1/notifications/stream` endpoint. Each authenticated user
establishes a single long-lived HTTP/1.1 connection. The Infrastructure layer
maintains an `SseNotificationEmitterService` — a singleton `Map<userId, Response>`
— that holds the active SSE response objects. When `DispatchNotificationEventUseCase`
creates a new `IN_APP` notification, it calls `IInAppNotificationEmitter.push(userId,
notification)`, which writes an `data:` event to the corresponding `Response` object
if the user is connected. React Native mobile clients that cannot maintain a
persistent SSE connection use 30-second polling of `GET /api/v1/notifications/inbox`
as a fallback; the SSE stream is optional/additive.

**Rationale**: SSE is simpler than WebSocket for unidirectional server-to-client
delivery: it uses plain HTTP, works through standard reverse proxies, requires no
protocol upgrade, and integrates trivially with Express (set `Content-Type:
text/event-stream`, write `data:` lines). The spec requires delivery within 30
seconds for connected users — SSE satisfies this with sub-second latency for
open connections, while the 30-second poll cadence satisfies the requirement for
mobile clients as a fallback. A single Map per process is sufficient for
single-process deployments of up to 500 concurrent users.

**Alternatives considered**:
- *WebSocket (ws library)* — rejected: bidirectional protocol adds complexity
  for a unidirectional push use case; SSE is purpose-built for this pattern.
- *Long polling* — rejected: each request creates database load; SSE maintains
  one persistent connection with zero per-push overhead.
- *External pub/sub (Redis Pub/Sub)* — deferred: necessary only for multi-process
  or multi-instance deployments (v2 horizontal scaling); single-process is
  sufficient for v1 scale of 500 concurrent users.

---

## Decision 2: Email Provider Abstraction — IEmailService with SmtpEmailService

**Decision**: Define `IEmailService` in the Application layer
(`application/interfaces/email-service.interface.ts`) with a single method:
`sendEmail(to: string, subject: string, htmlBody: string): Promise<void>`. The
Infrastructure layer provides `SmtpEmailService` implementing it via `nodemailer`
with transporter configuration from environment variables (`SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`). Failed delivery calls throw a typed
`EmailDeliveryError` that the use case catches to record a `NotificationDeliveryAttempt`
with `status = FAILED` and the error message as `errorReason`.

**Rationale**: The interface boundary isolates all SMTP/nodemailer concerns from
the Application layer, enabling a swap to SendGrid or Mailgun in v2 by implementing
a new class without touching any use case. It also makes unit tests of dispatch
logic trivial — inject a mock `IEmailService` that throws on demand. Environment
variables are the only required configuration; no secrets live in code.

**Alternatives considered**:
- *Hardcoding nodemailer in the use case* — rejected: violates Clean Architecture;
  makes unit testing require SMTP infrastructure.
- *SendGrid SDK directly* — rejected: vendor-locks the v1 implementation; SMTP
  is universally supported and allows local testing with Mailtrap/Mailhog.

---

## Decision 3: Template Rendering — Handlebars Compiled at Render Time

**Decision**: Use `handlebars` for `{{variable}}` placeholder syntax matching the
spec exactly. `NotificationTemplate` records are fetched from the DB at dispatch
time (after the 10-second publication window). `TemplateRendererService` calls
`Handlebars.compile(template.bodyTemplate)(variables)` and
`Handlebars.compile(template.subjectTemplate)(variables)` at render time — no
pre-compilation cache in v1 (templates change infrequently; compile cost is
negligible). Required variable validation on template save is done by
`TemplateRendererService.validateRequiredVariables(eventType, templateBody)`:
the method parses the template string for `{{variableName}}` and `{{#if ...}}`
tokens using a regex, then cross-checks against a static `REQUIRED_VARIABLES`
map keyed by `NotificationEventType`. If any required variable is absent, a
`MissingRequiredVariableError` (listing the missing names) is thrown and the
save is rejected. If a variable is present in the template but absent from the
event payload at render time, it renders as an empty string and a warning is
appended to the `NotificationDeliveryAttempt.errorReason` field (delivery still
proceeds — spec edge case).

**Required variables per event type** (static map in Application layer):

| Event Type | Required Variables |
|------------|--------------------|
| TICKET_CREATED | `ticketReference`, `customerName`, `ticketTitle`, `portalLink` |
| TICKET_ASSIGNED | `ticketReference`, `agentName`, `ticketTitle`, `portalLink` |
| TICKET_REASSIGNED | `ticketReference`, `agentName`, `previousAgentName`, `ticketTitle`, `portalLink` |
| TICKET_STATUS_CHANGED | `ticketReference`, `previousStatus`, `newStatus`, `ticketTitle`, `portalLink` |
| TICKET_COMMENT_ADDED | `ticketReference`, `authorName`, `ticketTitle`, `portalLink` |
| TICKET_RESOLVED | `ticketReference`, `agentName`, `ticketTitle`, `portalLink` |
| TICKET_AUTO_CLOSED | `ticketReference`, `ticketTitle`, `portalLink` |
| TICKET_ESCALATED | `ticketReference`, `escalationReason`, `agentName`, `ticketTitle`, `timeElapsed`, `portalLink` |
| TICKET_DE_ESCALATED | `ticketReference`, `agentName`, `ticketTitle`, `portalLink` |
| TICKET_AUTO_ASSIGNED | `ticketReference`, `agentName`, `ticketTitle`, `portalLink` |

**Alternatives considered**:
- *Mustache* — similar syntax but less maintained; Handlebars is the de facto
  standard and has better TypeScript types.
- *Pre-compiled template cache* — deferred to v2; compile cost per dispatch is
  microseconds; eliminates cache invalidation complexity in v1.

---

## Decision 4: Quiet Hours Evaluation — Dispatch-Time Check + Scheduled Release Job

**Decision**: At email dispatch time, `DispatchNotificationEventUseCase` calls
`QuietHoursEvaluatorService.evaluate(preference, now)`. The service converts
`now` to the user's timezone using `date-fns-tz/toZonedTime`, then checks if
the current local time falls within `[quietHoursStart, quietHoursEnd)`. If yes
(and the event is NOT `TICKET_ESCALATED`), the notification status stays `PENDING`
and `scheduledFor` is set to the next occurrence of `quietHoursEnd` in the user's
timezone (handling the midnight-spanning case: if end time has already passed
today in the user's timezone, target tomorrow). A `node-cron` job
(`ProcessQuietHoursQueueJob`) runs every minute scanning:

```sql
SELECT * FROM Notification
WHERE status = 'PENDING'
  AND channel = 'EMAIL'
  AND scheduledFor <= NOW()
  AND scheduledFor IS NOT NULL
```

For each matching notification, it re-dispatches via `SmtpEmailService` and
updates status accordingly.

**Midnight-spanning rule**: If `quietHoursStart = 23:00` and `quietHoursEnd = 06:00`,
an event at `00:30` local time is inside quiet hours (since 00:30 is after 23:00
or before 06:00). `scheduledFor` is set to the same calendar day at `06:00` local
time converted to UTC.

**Escalation bypass**: `TICKET_ESCALATED` events skip the quiet hours check
entirely in `DispatchNotificationEventUseCase` — no `scheduledFor` is set and
the email is dispatched immediately.

**Alternatives considered**:
- *Per-event deferred dispatch queue* — rejected: adds complexity for v1; a
  one-minute cron scan over a small indexed result set is fast and sufficient.
- *Per-user cron jobs* — rejected: thousands of cron jobs is operationally
  infeasible; a single scan query with a proper index is the right approach.

---

## Decision 5: Email Retry Mechanism — Exponential Backoff via Cron Job

**Decision**: `NotificationDeliveryAttempt` records each attempt immutably. On
failure, `DispatchNotificationEventUseCase` increments `Notification.attemptCount`
and sets `nextRetryAt` to:
- Attempt 1 → `now + 5 min`
- Attempt 2 → `now + 15 min`
- Attempt 3 → `now + 60 min`
- Attempt ≥ 3 (all 3 exhausted) → `status = FAILED`, `nextRetryAt = null`

A `RetryFailedEmailsJob` cron (every 5 minutes) queries:

```sql
SELECT * FROM Notification
WHERE status = 'PENDING'
  AND channel = 'EMAIL'
  AND scheduledFor IS NULL
  AND nextRetryAt <= NOW()
  AND attemptCount < 3
```

For each result it calls `SmtpEmailService.sendEmail(...)`, writes a new
`NotificationDeliveryAttempt`, and updates the `Notification` row. The retry
job and the quiet-hours job are mutually exclusive by the `scheduledFor IS NULL`
and `scheduledFor IS NOT NULL` predicates respectively — no notification can be
in both queues simultaneously.

**Alternatives considered**:
- *Bull/BullMQ job queue* — deferred to v2; adds Redis dependency; cron-over-DB
  is sufficient for 500 users and retry rates expected in v1.
- *Immediate async retry with setTimeout* — rejected: not durable; process restart
  loses pending retries. DB-backed state survives restarts.

---

## Decision 6: Recipient Resolution — Static Resolver Map in Application Layer

**Decision**: `RecipientResolverService` in the Application layer contains a static
`RESOLVER_MAP: Record<NotificationEventType, ResolverFn>`. Each resolver function
receives the event payload and returns `Promise<string[]>` (list of `userId`s).
Resolvers that need to look up ticket or user data call the relevant repository
interfaces injected into the service. Resolution map:

| Event Type | Recipients |
|------------|-----------|
| TICKET_CREATED | `[payload.customerId]` |
| TICKET_ASSIGNED | `[payload.assignedAgentId]` |
| TICKET_REASSIGNED | `[payload.assignedAgentId, payload.previousAgentId]` |
| TICKET_STATUS_CHANGED | `[payload.customerId, payload.assignedAgentId].filter(Boolean)` |
| TICKET_COMMENT_ADDED | `[payload.customerId, payload.assignedAgentId].filter(Boolean)`, excluding the comment author |
| TICKET_RESOLVED | `[payload.customerId]` |
| TICKET_AUTO_CLOSED | `[payload.customerId]` |
| TICKET_ESCALATED | `payload.escalationTargetIds` (from escalation event payload) |
| TICKET_DE_ESCALATED | `[payload.assignedAgentId].filter(Boolean)` |
| TICKET_AUTO_ASSIGNED | `[payload.assignedAgentId]` |

Deactivated users are detected by checking `User.accountStatus` (from
`001-user-auth`). Any recipient whose account is `DEACTIVATED` produces a
`Notification` with `status = SUPPRESSED` and no delivery attempt.

**Alternatives considered**:
- *Dynamic rules stored in DB* — rejected: recipient resolution is a business
  rule, not configurable data; static map is the right model for v1.
- *Event-sourced fan-out* — deferred: appropriate for multi-tenant or
  subscriber-pattern extensions in v2.

---

## Decision 7: Internal Event Interface — INotificationEventConsumer

**Decision**: The module exposes `INotificationEventConsumer` in
`application/interfaces/notification-event-consumer.interface.ts`:

```typescript
interface INotificationEventConsumer {
  emit(event: NotificationEventPayload): Promise<void>;
}
```

`NotificationEventPayload` is a discriminated union typed per event:

```typescript
type NotificationEventPayload =
  | { eventType: 'TICKET_CREATED'; ticketId: string; customerId: string; ... }
  | { eventType: 'TICKET_ASSIGNED'; ticketId: string; assignedAgentId: string; ... }
  | ...
```

The concrete `NotificationEventConsumerService` (Application layer) implements
this interface. Upstream modules (003, 004, 005) receive this interface injected
at app startup; they call `consumer.emit(event)` with `await` in a
fire-and-forget pattern (`void consumer.emit(event)` is acceptable — failures
are logged, not propagated to the caller). The `emit` method creates the
`NotificationEvent` record, runs `RecipientResolverService`, creates per-recipient
`Notification` records, and triggers async dispatch (in-app push + email queue
entry) without blocking the caller's response.

**Rationale**: Synchronous in-process function call is the simplest integration
that satisfies v1 requirements. No message broker, no HTTP call, no serialization
overhead. The interface contract means upstream modules never import notification
infrastructure, preserving Clean Architecture boundaries. Fire-and-forget is safe
because all state is persisted before `emit` returns — any async failure is
recoverable from the DB.

**Alternatives considered**:
- *HTTP webhook between modules* — rejected: adds network latency, retry logic,
  and serialization in the same process for no benefit.
- *Event emitter (Node.js EventEmitter)* — rejected: untyped, difficult to test
  deterministically in unit tests, and not async-first.
- *Message queue (RabbitMQ / Kafka)* — deferred to v2 for multi-instance
  deployment; adds infrastructure complexity not justified for single-process v1.

---

## Decision 8: 90-Day Inbox Retention Cleanup

**Decision**: A separate `node-cron` job (`CleanupExpiredNotificationsJob`) runs
daily at 02:00 UTC, deleting `Notification` rows where `channel = IN_APP` AND
`createdAt < NOW() - 90 days`. The job does NOT delete the parent `NotificationEvent`
record (which may have other recipients or channels still within retention) unless
all associated `Notification` rows are deleted. The cascade is handled by the
Prisma schema. Batch delete of up to 1,000 rows per job run prevents long-running
transactions.

**Rationale**: Keeping a clean inbox improves query performance and prevents
unbounded DB growth. 90 days covers the spec requirement (FR-009). The daily
off-peak cron avoids contention with peak notification volume.

---

## Summary: All Decisions Resolved

| Question | Resolution |
|----------|-----------|
| In-app real-time delivery | SSE (`Map<userId, Response>`); 30-s poll fallback for mobile |
| Email provider abstraction | `IEmailService` interface; `SmtpEmailService` via nodemailer |
| Template rendering | Handlebars at dispatch time; required variable validation on save |
| Quiet hours evaluation | `date-fns-tz` timezone check; `ProcessQuietHoursQueueJob` every 1 min |
| Email retry mechanism | `RetryFailedEmailsJob` every 5 min; exponential backoff (+5/+15/+60 min) |
| Recipient resolution | Static `RESOLVER_MAP` in Application layer; deactivated → SUPPRESSED |
| Internal event interface | `INotificationEventConsumer.emit()` synchronous call, fire-and-forget async |
| 90-day retention | Daily `CleanupExpiredNotificationsJob`; batch delete ≤ 1,000 rows |
