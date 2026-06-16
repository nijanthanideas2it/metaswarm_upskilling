# Implementation Plan: Notifications

**Branch**: `006-notifications` | **Date**: 2026-06-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-notifications/spec.md`

## Summary

The Notifications module is the cross-cutting communication layer for the ServiceDesk
CRM. It accepts structured internal events from all upstream modules (001–005) via a
synchronous in-process interface, resolves recipients per event type, evaluates per-user
channel preferences and quiet hours, renders configurable templates using Handlebars,
and dispatches notifications to two channels: a persistent in-app inbox delivered in
real time via Server-Sent Events (with 30-second polling fallback for mobile) and an
email channel backed by SMTP with retry logic (up to 3 attempts with exponential
backoff). Two background cron jobs handle the quiet-hours release queue and
exponential-backoff email retries; no external message broker is required for v1.

## Technical Context

**Language/Version**: Node.js 20 LTS, TypeScript 5.x (strict mode)

**Primary Dependencies**: Express 4.x, Prisma 5.x, zod (request validation),
`nodemailer` (SMTP email dispatch), `handlebars` (template rendering),
`node-cron` (quiet-hours queue and retry jobs), `date-fns-tz` (timezone-aware
quiet hours evaluation)

**Storage**: PostgreSQL 16 (via Prisma ORM); all notification state persisted
(events, delivery attempts, templates, preferences)

**Testing**: Jest + Supertest; ≥ 80% coverage (lines + branches)

**Target Platform**: Linux server (same Node.js process as modules 001–005)

**Project Type**: Web service (REST API + internal event interface + SSE stream)

**Performance Goals**: In-app delivery ≤ 30 s of triggering event; email dispatch
≤ 5 min; delivery log queries (30-day window) ≤ 5 s; all REST endpoints p95 ≤ 200 ms

**Constraints**: Constitution p95 ≤ 200 ms; no N+1 queries; RBAC at use-case
layer; OWASP Top 10 per endpoint; zod validation at API boundary; quiet hours
per user/timezone; escalation bypass; 90-day inbox retention; deduplication of
email address resolved at dispatch time (not event time)

**Scale/Scope**: Up to 500 concurrent users; 10 event types × 2 channels;
up to 20 notification recipients per event in v1

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. Clean Architecture | ✅ Pass | `INotificationEventConsumer` interface lives in Application layer; Prisma repos, SMTP service, and SSE emitter live in Infrastructure; no inner layer imports outer; cron jobs are Infrastructure-layer wrappers calling Application use cases |
| II. TypeScript Standards | ✅ Pass | `strict: true`; `const enum` for `NotificationEventType`, `NotificationChannel`, `NotificationStatus`; no `any`; explicit return types on all use cases and services |
| III. Security | ✅ Pass | RBAC at use-case layer (admin-only for delivery log, template edit, preference override); zod at API boundary; SSE endpoint validates JWT before streaming; OWASP reviewed; recipient isolation — users see only their own inbox |
| IV. Testing | ✅ Pass | TDD; unit tests for `RecipientResolverService`, `TemplateRendererService`, `QuietHoursEvaluatorService`, all use cases with in-memory repos; integration tests for all 4 Prisma repos; contract tests for all 5 route files; ≥ 80% floor |
| V. Performance | ✅ Pass | Indexed on `(recipientId, isRead, createdAt)` for inbox; `(status, channel, nextRetryAt)` for retry job; `(sourceEntityId, eventType)` for delivery log by ticket; `(recipientId, createdAt)` for 90-day cleanup; pagination on all list endpoints; no N+1 (single `include` query per inbox page) |
| VI. API Design Consistency | ✅ Pass | `/api/v1/notifications/*`, `/api/v1/notification-preferences/*`, `/api/v1/notification-templates/*`, `/api/v1/notification-delivery-log/*`; uniform `{ data, meta, error }` envelope; camelCase; ISO 8601 dates; correct HTTP status codes |

**Post-Phase 1 re-check**: All gates remain green. `SmtpEmailService` is behind
`IEmailService` interface — no nodemailer import leaks into Application layer.
`SseNotificationEmitter` is behind `IInAppNotificationEmitter` interface for the
same reason.

## Project Structure

### Documentation (this feature)

```text
specs/006-notifications/
├── plan.md                           # This file
├── research.md                       # Phase 0 — design decisions
├── data-model.md                     # Phase 1 — Prisma schema + entity table
├── quickstart.md                     # Phase 1 — validation guide
├── contracts/
│   ├── notifications.md              # Inbox list, mark read, SSE stream
│   ├── notification-preferences.md   # Get/update own prefs; admin override
│   └── notification-templates.md     # Template CRUD, preview; delivery log + retry
└── tasks.md                          # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── notification-event.entity.ts
│   │   │   ├── notification.entity.ts
│   │   │   ├── notification-preference.entity.ts
│   │   │   └── notification-template.entity.ts
│   │   └── repositories/
│   │       ├── notification.repository.interface.ts
│   │       ├── notification-preference.repository.interface.ts
│   │       ├── notification-template.repository.interface.ts
│   │       └── notification-delivery-attempt.repository.interface.ts
│   ├── application/
│   │   ├── interfaces/
│   │   │   ├── notification-event-consumer.interface.ts   # INotificationEventConsumer — called by other modules
│   │   │   ├── email-service.interface.ts                 # IEmailService
│   │   │   └── in-app-notification-emitter.interface.ts   # IInAppNotificationEmitter
│   │   ├── use-cases/
│   │   │   ├── inbox/
│   │   │   │   ├── get-inbox.use-case.ts
│   │   │   │   ├── mark-as-read.use-case.ts
│   │   │   │   └── mark-all-read.use-case.ts
│   │   │   ├── preferences/
│   │   │   │   ├── get-preferences.use-case.ts
│   │   │   │   ├── update-preferences.use-case.ts
│   │   │   │   ├── admin-get-user-preferences.use-case.ts
│   │   │   │   └── admin-override-preferences.use-case.ts
│   │   │   ├── templates/
│   │   │   │   ├── list-templates.use-case.ts
│   │   │   │   ├── get-template.use-case.ts
│   │   │   │   ├── update-template.use-case.ts
│   │   │   │   └── preview-template.use-case.ts
│   │   │   ├── delivery-log/
│   │   │   │   ├── get-delivery-log.use-case.ts
│   │   │   │   └── retry-notification.use-case.ts
│   │   │   └── dispatch/
│   │   │       └── dispatch-notification-event.use-case.ts   # entry point
│   │   └── services/
│   │       ├── recipient-resolver.service.ts
│   │       ├── template-renderer.service.ts
│   │       └── quiet-hours-evaluator.service.ts
│   ├── infrastructure/
│   │   ├── repositories/
│   │   │   ├── prisma-notification.repository.ts
│   │   │   ├── prisma-notification-preference.repository.ts
│   │   │   ├── prisma-notification-template.repository.ts
│   │   │   └── prisma-notification-delivery-attempt.repository.ts
│   │   ├── services/
│   │   │   ├── smtp-email.service.ts
│   │   │   └── sse-notification-emitter.service.ts
│   │   └── jobs/
│   │       ├── process-quiet-hours-queue.job.ts
│   │       └── retry-failed-emails.job.ts
│   └── presentation/
│       └── http/
│           ├── routes/
│           │   ├── notifications.routes.ts
│           │   ├── notification-preferences.routes.ts
│           │   ├── notification-templates.routes.ts
│           │   ├── notification-delivery-log.routes.ts
│           │   └── notification-stream.routes.ts
│           └── controllers/
│               ├── notifications.controller.ts
│               ├── notification-preferences.controller.ts
│               ├── notification-templates.controller.ts
│               ├── notification-delivery-log.controller.ts
│               └── notification-stream.controller.ts
└── tests/
    ├── unit/
    │   ├── services/
    │   │   ├── recipient-resolver.service.test.ts
    │   │   ├── template-renderer.service.test.ts
    │   │   └── quiet-hours-evaluator.service.test.ts
    │   └── use-cases/
    │       ├── inbox/
    │       │   ├── get-inbox.use-case.test.ts
    │       │   ├── mark-as-read.use-case.test.ts
    │       │   └── mark-all-read.use-case.test.ts
    │       ├── preferences/
    │       │   ├── update-preferences.use-case.test.ts
    │       │   └── admin-override-preferences.use-case.test.ts
    │       ├── templates/
    │       │   ├── update-template.use-case.test.ts
    │       │   └── preview-template.use-case.test.ts
    │       ├── delivery-log/
    │       │   └── retry-notification.use-case.test.ts
    │       └── dispatch/
    │           └── dispatch-notification-event.use-case.test.ts
    ├── integration/
    │   └── repositories/
    │       ├── prisma-notification.repository.test.ts
    │       ├── prisma-notification-preference.repository.test.ts
    │       ├── prisma-notification-template.repository.test.ts
    │       └── prisma-notification-delivery-attempt.repository.test.ts
    └── contract/
        ├── notifications.routes.test.ts
        ├── notification-preferences.routes.test.ts
        ├── notification-templates.routes.test.ts
        ├── notification-delivery-log.routes.test.ts
        └── notification-stream.routes.test.ts
```

**Structure Decision**: Backend-only extension of the `backend/` workspace shared
by modules 001–005. The module adds no new top-level project directory — it
integrates cleanly into the existing Clean Architecture layer structure. The
`INotificationEventConsumer` interface is defined in the Application layer and
registered at app startup via dependency injection, allowing upstream modules to
call it without importing any notification infrastructure. SSE and cron jobs are
registered at server startup alongside Express route registration.
