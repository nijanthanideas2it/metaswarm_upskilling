# Research: Reporting Dashboard

**Feature**: 007-reporting-dashboard
**Date**: 2026-06-16
**Status**: Complete — all design decisions resolved

---

## Decision 1: Query Strategy for Complex Aggregations

**Decision**: Use Prisma `$queryRaw` with tagged-template parameterisation for
all multi-step aggregation queries (GROUP BY counts, AVG time deltas,
`date_trunc` buckets, CTEs). Use Prisma `groupBy` and `count` only for the
simplest operations overview status/priority counts where the query maps
cleanly to Prisma's fluent API. All date-range predicates bind against the
`createdAt` column, which carries existing B-tree indexes from modules 003 and
005.

Example pattern for a raw aggregation:

```typescript
const rows = await this.prisma.$queryRaw<AgentPerformanceRow[]>`
  SELECT
    u.id            AS "agentId",
    u.full_name     AS "agentName",
    COUNT(t.id)     AS "ticketsHandled",
    COUNT(t.id) FILTER (WHERE t.status IN ('RESOLVED','CLOSED'))
                    AS "ticketsResolved",
    AVG(EXTRACT(EPOCH FROM (first_resp.responded_at - t.created_at)) / 3600)
                    AS "avgFirstResponseHours",
    AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600)
                    AS "avgResolutionHours"
  FROM "User" u
  JOIN "Ticket" t ON t.assigned_agent_id = u.id
  LEFT JOIN LATERAL (
    SELECT MIN(a.created_at) AS responded_at
    FROM "TicketActivityLogEntry" a
    JOIN "User" au ON au.id = a.actor_id
    WHERE a.ticket_id = t.id
      AND a.event = 'COMMENT_ADDED'
      AND au.role IN ('AGENT','MANAGER','ADMIN')
  ) first_resp ON TRUE
  WHERE u.role IN ('AGENT','MANAGER','ADMIN')
    AND t.created_at >= ${startDate}
    AND t.created_at <  ${endDate}
  GROUP BY u.id, u.full_name
  ORDER BY u.full_name
`;
```

**Rationale**: Prisma's fluent API cannot express LATERAL joins, `date_trunc`,
or `FILTER (WHERE ...)` aggregates. Using `$queryRaw` with tagged templates (not
`$queryRawUnsafe`) preserves parameterisation — PostgreSQL still uses bind
parameters, preventing SQL injection. The spec requires p95 ≤ 10 s for 10,000
tickets; a single CTE query against indexed columns reliably fits within this
budget. Mixing Prisma fluent API for simple counts and raw SQL for complex
aggregations gives the best readability/safety tradeoff.

**Alternatives considered**:
- *All queries via Prisma fluent API* — rejected: impossible to express LATERAL
  subqueries, `date_trunc`, or aggregation filters in Prisma's query builder.
- *`$queryRawUnsafe` with string interpolation* — rejected: violates the
  constitution's parameterised-queries-only requirement and opens SQL injection
  vectors.
- *Separate analytics database / pre-computed materialized views* — deferred:
  adds infrastructure and synchronisation complexity; not required for v1's
  10,000-ticket scale target.

---

## Decision 2: Operations Overview Caching

**Decision**: Implement a simple in-memory cache as `OperationsOverviewCache`
in the Infrastructure layer. It holds a single entry: `Map<'default',
{ data: OperationsOverviewDto; expiresAt: number }>`. TTL is 60 seconds.
`GetOperationsOverviewUseCase` depends on the `IOperationsOverviewCache`
interface (defined in the Application layer); the concrete implementation is
injected at startup via DI. On a cache hit where `Date.now() < expiresAt`, the
cached DTO is returned directly. On a miss the use case calls
`IReportingQueryRepository.getOperationsOverview()`, writes the result to the
cache, and returns it.

**Rationale**: The spec requires the overview to reflect data no more than 5
minutes old (FR-005) and to load in ≤ 5 s (SC-001). A 60-second cache satisfies
both bounds while shielding the DB from repeated identical aggregation queries
throughout a manager's working session. No Redis dependency is needed at v1
scale (single process, single region). The interface+injection pattern keeps
`GetOperationsOverviewUseCase` fully unit-testable with an in-memory stub cache.

**Alternatives considered**:
- *Redis TTL cache* — deferred: requires a separate infrastructure dependency;
  single-process deployment doesn't benefit from cross-process invalidation in v1.
- *No caching; DB query on every poll* — rejected: a 5-minute poll from every
  connected manager would generate constant GROUP BY scans at peak hours.
- *HTTP `Cache-Control` header only* — rejected: cache headers cannot be
  enforced at the server; a misbehaving client or proxy could bypass them.

---

## Decision 3: CSV Export Strategy

**Decision**: Use the `csv-stringify` library in streaming mode. The route
handler sets `Content-Type: text/csv` and
`Content-Disposition: attachment; filename=report-<type>-<YYYY-MM-DD>.csv`
before piping. `CsvReportGeneratorService` in the Infrastructure layer accepts
an `AsyncIterable<ReportRow>` from the use case and pipes it through
`csv-stringify`'s `Stringifier` directly to the Express `Response` stream. The
`ExportCsvUseCase` fetches all rows from `IReportingQueryRepository` for the
given report type and filters, yielding them as an async generator.

**Rationale**: Streaming avoids buffering a 10,000-row dataset in Node.js
heap memory before writing to the socket. `csv-stringify` is the canonical
Node.js CSV library, actively maintained, with streaming API support. The
60-second export deadline (SC-003) is enforced by a `setTimeout` in the route
handler that calls `response.destroy()` and returns HTTP 408 if the stream has
not closed within the limit.

**Alternatives considered**:
- *Build CSV string in-memory (join array)* — rejected: risk of OOM under
  concurrent exports for large datasets; non-streaming makes timeout enforcement
  harder.
- *`fast-csv`* — viable alternative; `csv-stringify` chosen because it is already
  used elsewhere in the ecosystem and has a more composable streaming API.
- *Async job queue + download link* — deferred: adds significant infrastructure
  (queue, job worker, storage); the spec targets 60 s synchronous export for v1.

---

## Decision 4: PDF Export Strategy

**Decision**: Use `pdfkit` for server-side synchronous PDF generation.
`PdfReportGeneratorService` in the Infrastructure layer creates a `PDFDocument`,
draws a title, date range, and a table using `pdfkit`'s vector drawing API
(computed column widths, row-by-row iteration). The document is piped to the
Express `Response` stream with `Content-Type: application/pdf` and
`Content-Disposition: attachment; filename=report-<type>-<YYYY-MM-DD>.pdf`.
A 60-second `setTimeout` in the route handler destroys the response and returns
HTTP 408 if the stream has not finished. PDF export is Admin-only (FR-021).

Column widths are computed proportionally to page width (A4: 595 pt usable
width minus margins). Text that exceeds column width is wrapped; font size is
reduced to 8 pt for tables exceeding 6 columns to fit on a single page width.

**Rationale**: `pdfkit` is a pure Node.js library — no headless browser, no
Chromium, no external process. This keeps the Docker image lean and avoids
Puppeteer's known memory instability under concurrent PDF generation. The spec
explicitly states v1 PDF contains tables only (no chart images), making a
vector-drawing API sufficient. `pdfkit` streams output incrementally, so memory
usage is proportional to page count rather than total row count.

**Alternatives considered**:
- *Puppeteer/Playwright (HTML→PDF)* — rejected: adds ~300 MB to container image,
  significant memory per-render, and process lifecycle complexity.
- *`pdf-lib`* — viable, but lower-level than `pdfkit` for text/table layout;
  `pdfkit` provides higher-level primitives that reduce custom layout code.
- *Pre-rendered HTML + WeasyPrint sidecar* — rejected: requires a Python sidecar
  process, adding cross-language operational complexity.

---

## Decision 5: Time-Series Bucketing and Gap Filling

**Decision**: The bucketing granularity is selected by the date range length:
- Range ≤ 90 days → `date_trunc('week', created_at)` (Monday-aligned ISO weeks)
- Range > 90 days → `date_trunc('month', created_at)`

The raw SQL query returns `(bucket TIMESTAMPTZ, created_count BIGINT,
resolved_count BIGINT)` rows only for buckets that contain at least one event.
The Application-layer service `TimeSeriesGapFillerService` receives the
query results along with the `DateRange` value object and fills any missing
buckets with `{ createdCount: 0, resolvedCount: 0 }` before the use case
returns. Gap filling is pure TypeScript with no DB involvement.

**Rationale**: Leaving gap-filling to the Application layer keeps the query
simple and the service fully unit-testable with fixed input arrays (no DB
required). Returning zero-count buckets from the DB via `generate_series` is
also possible but ties the gap logic to PostgreSQL and makes unit testing harder.
The 90-day threshold aligns with the spec's requirement that ranges ≤ 90 days
use weekly bucketing (FR-008).

**Alternatives considered**:
- *PostgreSQL `generate_series` LEFT JOIN for gaps* — viable but harder to
  unit-test without a DB; moves business logic into SQL.
- *Always use monthly buckets* — rejected: loses weekly granularity for short
  ranges, reducing the value of the volume report.
- *Client-side gap filling* — rejected: leaks business logic into the frontend
  and makes the API contract inconsistent.

---

## Decision 6: First Response Time Calculation

**Decision**: "Average first response time" is the time from `Ticket.createdAt`
to the earliest `TicketActivityLogEntry.createdAt` where:
- `event = 'COMMENT_ADDED'`
- The entry's `actorId` maps to a `User` with `role IN ('AGENT','MANAGER','ADMIN')`

This is computed via a `LATERAL` subquery using `MIN(activity.created_at)`
filtered by the two conditions above. Tickets where no such entry exists (i.e.,
no agent has ever commented) are excluded from the average (not counted as
infinite). The query returns `NULL` for `avgFirstResponseHours` when no
qualifying tickets exist in the period.

**Rationale**: The spec's assumption defines first response time as "the time
elapsed from ticket creation to the first agent-visible comment added by any
agent, manager, or admin." `COMMENT_ADDED` is the exact event type written by
`003-ticket-management` for all comments (including agent replies). Filtering
by actor role (not just event type) excludes customer self-comments that might
be logged with the same event code. Using `LATERAL` keeps the subquery
correlated per ticket, avoiding a full cross-join.

**Alternatives considered**:
- *Use `INTERNAL_NOTE_ADDED` event as well* — rejected: internal notes are not
  customer-visible responses; the spec definition is "agent-visible comment",
  which aligns with `COMMENT_ADDED` only.
- *Application-layer calculation from fetched logs* — rejected: loads all
  activity log rows into memory; unacceptably slow for 10,000 tickets.
- *Separate `firstRespondedAt` column on `Ticket`* — deferred: would require a
  schema migration to 003; deriving from the activity log avoids schema coupling
  in v1.

---

## Decision 7: Agent Personal Summary vs. Team Report Separation

**Decision**: Two separate use cases handle agent performance queries:
- `GetPersonalPerformanceSummaryUseCase`: always scopes the query to
  `requesterId` only; returns current-week and previous-week summaries.
  Accessible to any authenticated user (agents see their own; managers/admins
  can also call it to see a single agent's summary).
- `GetTeamPerformanceReportUseCase`: requires `role IN (MANAGER, ADMIN)`;
  returns all agents for the given date range.

Route middleware enforces the role gate before invoking the use case. The Agent
role is permitted to call `GET /api/v1/reports/performance/me` only. Any
attempt to call `GET /api/v1/reports/performance` as an Agent is rejected by
the middleware with HTTP 403 before the use case is ever invoked.

**Rationale**: Separating the two use cases prevents the "personal summary"
path from accidentally exposing team data if a middleware bug allows an Agent
to reach the team report use case. The use case boundary is the last line of
defence per Clean Architecture. The `GetPersonalPerformanceSummaryUseCase`
hard-codes `requesterId` as the sole agent filter — it is structurally
impossible for it to return another agent's data regardless of the HTTP params
passed.

**Alternatives considered**:
- *Single use case with a `scope` parameter* — rejected: a single use case
  that branches on a caller-provided parameter is harder to test for isolation
  guarantees and easier to misconfigure via a middleware bug.
- *Role check inside the use case only* — rejected: moving the gate to the use
  case means the route still accepts Agent requests and the use case must be
  aware of the HTTP caller context, violating Clean Architecture's principle
  that use cases are HTTP-agnostic.

---

## Decision 8: ReportThresholdConfig Single-Row Upsert Pattern

**Decision**: `ReportThresholdConfig` has a single row with `id = 'default'`.
`PrismaReportThresholdConfigRepository.upsert()` calls:
```typescript
await this.prisma.reportThresholdConfig.upsert({
  where:  { id: 'default' },
  update: { ...fields, updatedById, updatedAt: new Date() },
  create: { id: 'default', ...fields, updatedById },
});
```
`GetReportThresholdsUseCase` calls `findById('default')` and, if null (fresh
deployment), returns the default values (`CRITICAL: 2h`, `HIGH: 8h`,
`MEDIUM: 24h`, `LOW: 48h`) as a `ReportThresholdConfig` domain object without
persisting anything. Thresholds are written only on the first Admin `PATCH`
call, using upsert.

**Rationale**: A single-row config table with a sentinel `id = 'default'` is
the simplest approach that survives DB restarts and scales to zero overhead for
reads (single PK lookup). Returning defaults on a missing row avoids requiring
a mandatory seed migration. The upsert pattern eliminates the create-vs-update
decision at the application layer, making the write path idempotent.

**Alternatives considered**:
- *Seed a default row in migration* — viable but couples the migration to a
  specific business default; if defaults change, a new migration is needed.
- *Store thresholds in environment variables* — rejected: would make them
  non-configurable at runtime through the Admin UI (FR-023).
- *Multiple rows, one per priority* — rejected: overcomplicates the read path;
  all four thresholds are always read together and updated atomically.

---

## Summary: All Decisions Resolved

| Question | Resolution |
|----------|-----------|
| Query strategy for aggregations | Prisma `$queryRaw` (tagged template); Prisma fluent for simple counts |
| Operations overview caching | In-memory `Map` cache; 60 s TTL; `IOperationsOverviewCache` interface |
| CSV export | `csv-stringify` streaming; pipe to Express response; 60 s timeout → 408 |
| PDF export | `pdfkit` server-side; streaming; Admin-only; 60 s timeout → 408 |
| Time-series bucketing | `date_trunc` weekly (≤ 90 days) or monthly (> 90 days); gap-fill in Application layer |
| First response time | MIN `COMMENT_ADDED` by agent/manager/admin role via LATERAL subquery |
| Agent summary vs. team report | Separate use cases; role gate in route middleware; `GetPersonalPerformanceSummaryUseCase` hard-scoped to `requesterId` |
| Threshold config | Single row `id = 'default'`; upsert on write; return coded defaults if row absent on read |
