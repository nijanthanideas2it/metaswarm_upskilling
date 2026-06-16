# Data Model: Reporting Dashboard

**Feature**: 007-reporting-dashboard
**Date**: 2026-06-16
**Depends on**: `001-user-auth` (User, Role), `002-customer-management`
(Customer, Organization), `003-ticket-management` (Ticket,
TicketActivityLogEntry, TicketCategory), `004-ticket-assignment`
(SupportTeam, TeamMembership), `005-escalation-management` (EscalationEvent),
`006-notifications` (no direct data dependency)

---

## Read-Only Module Notice

This module **does not add columns or relationships to any existing table**.
All reporting data is sourced directly from entities owned by modules 001–006.
The only schema change introduced by this module is the new
`ReportThresholdConfig` table.

---

## Entity Relationships

```
ReportThresholdConfig (singleton)
  └── updatedById ──────────────────── User.id  (nullable FK)

─── Source entities (read-only, owned by other modules) ───

User ──────────────────────────────────────< Ticket (via assignedAgentId)
User ──────────────────────────────────────< Ticket (via customerId)
Ticket ────────────────────────────────────< TicketActivityLogEntry
TicketCategory ────────────────────────────< Ticket
Organization ──────────────────────────────< Customer
Customer.userId ───────────────────────── User.id
Ticket ────────────────────────────────────< EscalationEvent
```

---

## Owned Entity: ReportThresholdConfig

Single-row configuration table. The row is identified by the sentinel
primary key `id = 'default'`. The row is written only when an Admin first
calls `PATCH /api/v1/reports/thresholds`. Until then, all threshold reads
return the coded defaults without hitting the table.

| Field | Type | Constraints | Default | Notes |
|-------|------|-------------|---------|-------|
| `id` | String | PK | `'default'` | Always `'default'`; enforced in repository |
| `criticalResolutionHours` | Int | NOT NULL | `2` | Highlight threshold for CRITICAL tickets |
| `highResolutionHours` | Int | NOT NULL | `8` | Highlight threshold for HIGH tickets |
| `mediumResolutionHours` | Int | NOT NULL | `24` | Highlight threshold for MEDIUM tickets |
| `lowResolutionHours` | Int | NOT NULL | `48` | Highlight threshold for LOW tickets |
| `updatedById` | String? | FK → User.id, nullable | `null` | Admin who last changed thresholds |
| `updatedAt` | DateTime | NOT NULL, `@updatedAt` | — | Auto-updated by Prisma on each write |

**Constraints**:
- All threshold values must be positive integers (validated by zod at the
  boundary before reaching the use case).
- `criticalResolutionHours` ≤ `highResolutionHours` ≤ `mediumResolutionHours`
  ≤ `lowResolutionHours` is a business invariant enforced in
  `UpdateReportThresholdsUseCase` (not a DB constraint).

**Access pattern**: Single PK lookup `WHERE id = 'default'`. No index needed.

### Prisma Schema

```prisma
model ReportThresholdConfig {
  id                      String   @id @default("default")
  criticalResolutionHours Int      @default(2)
  highResolutionHours     Int      @default(8)
  mediumResolutionHours   Int      @default(24)
  lowResolutionHours      Int      @default(48)
  updatedById             String?
  updatedAt               DateTime @updatedAt

  updatedBy User? @relation("ThresholdUpdater", fields: [updatedById], references: [id])
}
```

---

## Source Entities Referenced by Reporting Queries

The following entities are queried read-only. Their schemas are defined in the
modules listed; they are reproduced here at field-reference level only for
query specification purposes.

| Entity | Owning Module | Key Fields Used in Reports |
|--------|--------------|---------------------------|
| `Ticket` | 003 | `id`, `status`, `priority`, `categoryId`, `customerId`, `assignedAgentId`, `isEscalated`, `createdAt`, `resolvedAt`, `closedAt` |
| `TicketActivityLogEntry` | 003 | `ticketId`, `event`, `actorId`, `createdAt` |
| `TicketCategory` | 003 | `id`, `name` |
| `User` | 001 | `id`, `fullName`, `role`, `accountStatus` |
| `Customer` | 002 | `userId`, `organizationId` |
| `Organization` | 002 | `id`, `name` |
| `EscalationEvent` | 005 | `id`, `ticketId`, `type`, `policyId`, `policyName`, `escalatedById`, `escalatedAt`, `deEscalatedAt` |

---

## Named Query Specifications

The following queries are implemented in
`PrismaReportingQueryRepository`. Each specification names the method,
describes the SQL strategy, lists the indexes it relies on, and describes
the return shape.

---

### Q-001: getOperationsOverview

**Method**: `getOperationsOverview(): Promise<OperationsOverviewDto>`

**Strategy**: Three parallel Prisma `groupBy` / `count` calls, combined in
the repository method:
1. Group `Ticket` by `status`; count per status. Extract OPEN, IN_PROGRESS,
   PENDING. For RESOLVED and CLOSED counts use `createdAt >= start-of-ISO-week`.
2. Group `Ticket` by `priority` where `status IN ('OPEN','IN_PROGRESS')`; count
   per priority.
3. Group `Ticket` by `categoryId` where `status IN ('OPEN','IN_PROGRESS')`; join
   category names.
4. Fetch at-risk tickets: `SELECT t.id, t.reference_number, t.priority,
   t.category_id, u.full_name AS customer_name, t.created_at FROM Ticket t JOIN
   User u ON u.id = t.customer_id WHERE t.status = 'OPEN' AND t.created_at <=
   NOW() - INTERVAL '24 hours' AND NOT EXISTS (SELECT 1 FROM
   TicketActivityLogEntry a WHERE a.ticket_id = t.id AND a.event = 'COMMENT_ADDED'
   AND EXISTS (SELECT 1 FROM User au WHERE au.id = a.actor_id AND au.role IN
   ('AGENT','MANAGER','ADMIN')))`.

**Indexes used**: `Ticket(status)`, `Ticket(status, priority)`,
`Ticket(categoryId)`, `Ticket(createdAt)`,
`TicketActivityLogEntry(ticketId, createdAt)`.

**Returns**: `{ statusCounts, priorityCounts, categoryCounts, atRiskTickets[] }`

---

### Q-002: getTicketVolumeReport

**Method**: `getTicketVolumeReport(filters: ReportFilters): Promise<TicketVolumeReportDto>`

**Strategy**: Single `$queryRaw` CTE:
- CTE `base`: select `id`, `date_trunc(<granularity>, created_at) AS bucket`,
  `resolved_at`, `closed_at`, `status` from `Ticket` where `created_at BETWEEN
  $startDate AND $endDate` and optional `category_id = $categoryId` /
  `priority = $priority` / `customer_id IN (SELECT user_id FROM Customer WHERE
  organization_id = $orgId)`.
- Final SELECT: `bucket`, `COUNT(*) AS created_count`, `COUNT(*) FILTER (WHERE
  resolved_at IS NOT NULL AND resolved_at BETWEEN $startDate AND $endDate) AS
  resolved_count` GROUP BY `bucket` ORDER BY `bucket`.
- Granularity computed in Application layer from `DateRange` and passed as a
  literal string (`'week'` or `'month'`) — the only non-parameterised component;
  whitelisted to exactly these two values in `TimeSeriesGapFillerService`.

**Indexes used**: `Ticket(createdAt)`, `Ticket(categoryId)`,
`Ticket(priority)`, `Ticket(customerId)`.

**Returns**: Array of `{ bucket: Date; createdCount: number; resolvedCount: number }`; gaps filled by `TimeSeriesGapFillerService` in Application layer.

---

### Q-003: getAgentPerformanceReport

**Method**: `getAgentPerformanceReport(filters: ReportFilters): Promise<AgentPerformanceRow[]>`

**Strategy**: Single `$queryRaw` with a `LATERAL` subquery (see Decision 6 in
`research.md` for full SQL sketch):
- Join `User` (role IN AGENT/MANAGER/ADMIN) → `Ticket` (assigned_agent_id,
  created_at in range).
- LATERAL subquery computes `firstRespondedAt` = MIN `TicketActivityLogEntry`
  where `event = 'COMMENT_ADDED'` and actor has agent/manager/admin role.
- Aggregates per agent: `COUNT(t.id)`, `COUNT FILTER resolved`, `AVG first
  response delta`, `AVG resolution delta`.
- Deactivated agents included if they have tickets in the range; annotated with
  `isDeactivated: true` from `User.accountStatus`.

**Indexes used**: `Ticket(assignedAgentId)`, `Ticket(createdAt)`,
`TicketActivityLogEntry(ticketId, createdAt)`, `User(role)`.

**Returns**: Array of `AgentPerformanceRow` sorted by the `sort` parameter
(name ASC, ticketsHandled DESC, or avgResolutionHours DESC).

---

### Q-004: getPersonalPerformanceSummary

**Method**: `getPersonalPerformanceSummary(agentId: string): Promise<PersonalSummaryDto>`

**Strategy**: Two invocations of a parameterised `$queryRaw` query identical in
structure to Q-003 but scoped to a single `assigned_agent_id = $agentId`. The
two date ranges are current ISO week (`Monday 00:00:00 UTC` to `NOW()`) and
previous ISO week (the 7 days before that). Results are assembled into a
`{ currentWeek, previousWeek }` shape.

**Indexes used**: `Ticket(assignedAgentId)`, `Ticket(createdAt)`.

**Returns**: `PersonalSummaryDto { currentWeek: WeekSummary; previousWeek: WeekSummary }`.

---

### Q-005: getResolutionTimeReport

**Method**: `getResolutionTimeReport(filters: ReportFilters): Promise<ResolutionTimeReportDto>`

**Strategy**: Single `$queryRaw` grouping resolved tickets by `priority` and
`category_id` within the date range:
```sql
SELECT
  t.priority,
  tc.name                 AS category_name,
  AVG(first_resp.delta_hours) AS avg_first_response_hours,
  AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600)
                          AS avg_resolution_hours,
  COUNT(*)                AS ticket_count
FROM Ticket t
LEFT JOIN TicketCategory tc ON tc.id = t.category_id
LEFT JOIN LATERAL (
  SELECT EXTRACT(EPOCH FROM (MIN(a.created_at) - t.created_at)) / 3600
         AS delta_hours
  FROM TicketActivityLogEntry a
  JOIN "User" au ON au.id = a.actor_id
  WHERE a.ticket_id = t.id
    AND a.event = 'COMMENT_ADDED'
    AND au.role IN ('AGENT','MANAGER','ADMIN')
) first_resp ON TRUE
WHERE t.resolved_at IS NOT NULL
  AND t.resolved_at BETWEEN $startDate AND $endDate
GROUP BY t.priority, tc.name
```

**Indexes used**: `Ticket(resolvedAt)` (added by this module's migration),
`Ticket(priority)`, `Ticket(categoryId)`,
`TicketActivityLogEntry(ticketId, createdAt)`.

**Returns**: Array of `{ priority, categoryName, avgFirstResponseHours,
avgResolutionHours, ticketCount }`. The Application layer calls
`ReportThresholdHighlighterService` to annotate each row with
`exceedsThreshold: boolean`.

---

### Q-006: getEscalationReport

**Method**: `getEscalationReport(filters: EscalationReportFilters): Promise<EscalationReportDto>`

**Strategy**: Single `$queryRaw` CTE:
- CTE `events`: select from `EscalationEvent` where `escalated_at BETWEEN
  $startDate AND $endDate` and optional `type = $type` filter.
- CTE `total_tickets`: count `Ticket.id` where `created_at BETWEEN $startDate
  AND $endDate` (for rate calculation).
- Final SELECT: `COUNT(*) AS total_escalations`, `type`,
  `policy_name` (for AUTO type), `escalated_by_id` (for MANUAL type),
  `AVG(EXTRACT(EPOCH FROM (de_escalated_at - escalated_at)) / 3600)
  FILTER (WHERE de_escalated_at IS NOT NULL) AS avg_duration_hours`,
  `COUNT(*)::FLOAT / NULLIF(total_tickets.cnt, 0) * 100 AS escalation_rate_pct`
  GROUP BY `type`, `policy_name`, `escalated_by_id`.
- Agent names joined via `User.full_name` for MANUAL breakdowns.

**Indexes used**: `EscalationEvent(escalatedAt)`,
`EscalationEvent(type)`, `Ticket(createdAt)`.

**Returns**: `EscalationReportDto { totalEscalations, byPolicy[],
byAgent[], avgDurationHours, escalationRatePct }`.

---

### Q-007: getCustomerActivityReport

**Method**: `getCustomerActivityReport(filters: CustomerActivityFilters): Promise<CustomerActivityReportDto>`

**Strategy**: Single `$queryRaw`:
```sql
SELECT
  o.id                          AS org_id,
  o.name                        AS org_name,
  COUNT(t.id) FILTER (WHERE t.status IN ('OPEN','IN_PROGRESS','PENDING'))
                                AS open_ticket_count,
  COUNT(t.id)                   AS total_ticket_count
FROM Organization o
JOIN Customer c ON c.organization_id = o.id
JOIN Ticket t   ON t.customer_id = c.user_id
WHERE t.created_at BETWEEN $startDate AND $endDate
GROUP BY o.id, o.name
ORDER BY open_ticket_count DESC
LIMIT $topN
```

**Indexes used**: `Ticket(customerId)`, `Ticket(createdAt)`,
`Ticket(status)`, `Customer(organizationId)`.

**Returns**: Array (length ≤ `topN`) of `{ orgId, orgName, openTicketCount,
totalTicketCount }`.

---

## New Index Added by This Module's Migration

| Table | Index | Rationale |
|-------|-------|-----------|
| `Ticket` | `@@index([resolvedAt])` | Q-005 filters on `resolved_at BETWEEN` — no existing index on this column |

All other indexes referenced above already exist from modules 003 and 005. No
modifications to existing tables are made.
