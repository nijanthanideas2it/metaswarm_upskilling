# Feature Specification: Reporting Dashboard

**Feature Branch**: `007-reporting-dashboard`

**Created**: 2026-06-16

**Status**: Draft

**Input**: User description: "lets create Reporting Dashboard module"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manager Views the Live Operations Overview (Priority: P1)

A Support Manager starts their morning shift by opening the operations dashboard.
At a glance they see how many tickets are open, in-progress, and pending across
the team — broken down by priority and category. A highlighted section shows
tickets that have been waiting without any agent response for more than 24 hours.
The dashboard refreshes automatically so the manager does not need to reload the
page to see the current state throughout the day.

**Why this priority**: The operations overview is the starting point for every
manager's workday. Without a real-time summary of queue health, managers cannot
make informed assignment or escalation decisions, and at-risk tickets go unnoticed
until customers complain.

**Independent Test**: Can be validated by seeding a set of tickets across multiple
statuses, priorities, and categories, loading the operations dashboard as a
manager, and verifying that counts match the seeded data. Advancing a ticket to
a new status and confirming the dashboard reflects the change within 5 minutes
(without a manual reload) completes the test.

**Acceptance Scenarios**:

1. **Given** a Support Manager on the operations dashboard, **Then** they see
   total counts for OPEN, IN_PROGRESS, PENDING, RESOLVED (this week), and
   CLOSED (this week) tickets, each as a distinct figure.
2. **Given** open and in-progress tickets spanning multiple priorities, **Then**
   the dashboard shows ticket counts broken down by CRITICAL, HIGH, MEDIUM, and
   LOW priority.
3. **Given** open and in-progress tickets spanning multiple categories, **Then**
   the dashboard shows ticket counts grouped by category.
4. **Given** a ticket that has been OPEN with no agent response for more than
   24 hours, **Then** it appears in the "At-Risk Tickets" section of the
   dashboard with its reference, customer name, and time-since-creation.
5. **Given** a ticket's status changes while the dashboard is open, **When** no
   more than 5 minutes pass, **Then** the updated counts are visible without the
   manager needing to manually reload the page.

---

### User Story 2 - Manager Reviews Team Performance Over a Date Range (Priority: P2)

At the end of the month a Support Manager needs to present team performance
figures to leadership. They open the agent performance report, select a date
range of the past 30 days, and see a table showing each agent's total tickets
handled, total resolved, average first response time, and average resolution
time. Agents whose average resolution time exceeds the configured threshold are
visually highlighted. The manager exports the report as a CSV to share with the
leadership team.

**Why this priority**: Performance reporting is the primary tool for identifying
coaching opportunities, justifying headcount, and demonstrating the value of the
support team. Without it, managers rely on gut feel instead of data.

**Independent Test**: Can be validated by seeding ticket data across agents for
a known date range, opening the performance report as a manager, confirming each
agent's figures match the seeded data, applying the date range filter, and
exporting the result as CSV and verifying the file is correctly formatted.

**Acceptance Scenarios**:

1. **Given** a Support Manager selecting a 30-day date range, **When** they open
   the agent performance report, **Then** they see one row per active agent
   showing: agent name, tickets handled, tickets resolved, average first response
   time (in hours), and average resolution time (in hours).
2. **Given** an agent whose average resolution time exceeds the configured
   threshold for any priority level, **Then** that agent's row is visually
   highlighted in the report with an indicator showing which threshold was exceeded.
3. **Given** the manager sorting the report by "average resolution time",
   **Then** rows are re-ordered from slowest to fastest without a page reload.
4. **Given** a manager clicking the CSV export button, **When** the export
   completes within 60 seconds, **Then** a CSV file is downloaded containing
   all agent rows with the same data visible in the report for the selected
   date range.

---

### User Story 3 - Agent Views Their Own Personal Performance Summary (Priority: P3)

A Support Agent wants to understand how they are performing relative to their
own week-on-week trend. They open their personal performance summary and see
their own ticket counts, average response time, and average resolution time for
the current week and the previous week side by side. They cannot see any other
agent's data.

**Why this priority**: Agents need personal feedback loops to self-correct and
stay motivated. Restricting the view to their own data preserves appropriate
privacy and prevents unhealthy intra-team comparisons driven by raw data without
context.

**Independent Test**: Can be validated by logging in as a test agent, opening
the personal summary, confirming the data matches the tickets assigned to and
resolved by that agent in the current and previous week. Attempting to access
the full team performance URL as the same agent must return a permission-denied
response.

**Acceptance Scenarios**:

1. **Given** a Support Agent on their personal summary, **Then** they see their
   own totals for the current week and the previous week: tickets handled,
   tickets resolved, average first response time, and average resolution time.
2. **Given** a Support Agent attempting to navigate to the full team performance
   report URL, **Then** the system denies access with a permission-denied message
   — the agent sees only their own summary.
3. **Given** a week where an agent resolved zero tickets, **Then** the summary
   displays zero values and a "No tickets resolved this week" note, not an error.

---

### User Story 4 - Manager Analyses Ticket Volume Trends and Escalation Patterns (Priority: P4)

Ahead of a quarterly review a Support Manager wants to know whether ticket
volumes have grown over the past quarter and whether escalations are increasing
or decreasing as a proportion of tickets. They open the ticket volume report,
select a 90-day date range, and see a weekly trend of tickets created versus
resolved. They then switch to the escalation report, which shows total escalations
broken down by policy name and whether they were automatic or manual, and a
percentage rate relative to total tickets in the period.

**Why this priority**: Volume and escalation trends are leading indicators of
team capacity and process quality. Managers need them for quarterly reviews,
capacity planning, and policy tuning — they cannot be derived from the
per-ticket views in other modules.

**Independent Test**: Can be validated by seeding ticket and escalation event
data across a known 90-day window, generating the volume and escalation reports
with that date range, and verifying the weekly trend line totals and the
escalation rate percentage match the seeded counts.

**Acceptance Scenarios**:

1. **Given** a Manager selecting a 90-day date range on the volume report,
   **Then** they see a trend chart with weekly bars (or line points) showing
   tickets created and tickets resolved for each week in the range, plus a
   summary of net open change for the period.
2. **Given** a Manager applying a category filter on the volume report, **Then**
   the chart and summary figures reflect only tickets in the selected category.
3. **Given** a Manager opening the escalation report for the same 90-day period,
   **Then** they see: total escalations (auto + manual), a breakdown by policy
   name (for auto), a count of manual escalations by agent, average time in
   escalated state before de-escalation, and escalation rate as a percentage
   of total tickets created in the period.
4. **Given** a Manager filtering the escalation report by type "manual only",
   **Then** the summary and breakdown update to show only manually triggered
   escalation events.

---

### User Story 5 - Admin Exports Reports and Reviews Customer Activity (Priority: P5)

An Admin needs to prepare a monthly operational summary for a stakeholder. They
use the customer and organisation report to identify the top 10 organisations by
open ticket volume, export it as a PDF, and attach it to their management report.
They also click through to one organisation's profile to review its ticket history
directly.

**Why this priority**: Customer and organisation-level reporting answers the
"who is generating our support load?" question. The export capability in PDF
format extends the dashboard's value beyond internal users by enabling polished
artifacts for external or executive audiences.

**Independent Test**: Can be validated by seeding customer and organisation data
with varying ticket volumes, opening the customer report as an admin, verifying
the top 10 organisations by open tickets are listed in the correct order,
exporting as PDF and confirming the file is generated within 60 seconds, and
clicking an organisation link to confirm navigation to the correct profile page.

**Acceptance Scenarios**:

1. **Given** an Admin on the customer activity report, **Then** they see a
   ranked list of the top 10 organisations by total open ticket count, each
   showing organisation name, total open tickets, total tickets this period,
   and a link to the organisation profile.
2. **Given** an Admin changing the "top N" setting from 10 to 25, **Then**
   the report updates to show the top 25 organisations.
3. **Given** an Admin clicking the PDF export button, **When** the export
   completes within 60 seconds, **Then** a formatted PDF is downloaded containing
   the currently visible report data including headers, table rows, and the
   selected date range.
4. **Given** an Admin clicking an organisation name in the report, **Then**
   they are navigated directly to that organisation's profile page in the
   Customer Management module.

---

### Edge Cases

- What happens when a selected date range contains no ticket data? All report
  views display zero values with a clear "No data for the selected period"
  message rather than empty charts or error states.
- What happens when an agent is deactivated mid-reporting period? Their ticket
  activity during the period they were active is still included in reports;
  they appear in performance reports with a "deactivated" indicator.
- What happens when a large export (12 months, 10,000 tickets) takes longer
  than 60 seconds? The system shows a progress indicator; if the operation
  times out it returns a user-readable error and suggests narrowing the date
  range.
- What happens when a ticket's category is changed after creation? The ticket
  is counted under its current category in all reports; historical category
  changes are not tracked by this module.
- What happens when a manager accesses a report while the underlying data is
  refreshing? The most recently completed snapshot is shown with a
  "Refreshing data…" indicator; no blank or broken state is presented.
- What happens when the PDF export produces a table wider than the page? The
  export applies column wrapping and reduces font size to fit; no columns are
  truncated silently.
- What happens when an agent's name changes (e.g., a legal name change applied
  by admin)? Reports show the agent's current name; historical report labels
  update to the current name without a separate historical record.

## Requirements *(mandatory)*

### Functional Requirements

**Operations Overview (Live)**

- **FR-001**: Admins and Support Managers MUST be able to view an operations
  overview displaying current-state counts for: OPEN, IN_PROGRESS, PENDING,
  RESOLVED (current calendar week), and CLOSED (current calendar week) tickets.
- **FR-002**: The overview MUST display open and in-progress ticket counts broken
  down by priority (CRITICAL, HIGH, MEDIUM, LOW).
- **FR-003**: The overview MUST display open and in-progress ticket counts grouped
  by ticket category.
- **FR-004**: The overview MUST display an "At-Risk Tickets" list: tickets with
  status OPEN and no agent-visible comment for more than 24 hours, showing
  reference number, customer name, category, priority, and hours since creation.
- **FR-005**: The operations overview MUST auto-refresh with data no more than
  5 minutes old without requiring a manual page reload.

**Ticket Volume Report**

- **FR-006**: Admins and Support Managers MUST be able to generate a ticket
  volume report for a selected date range of up to 12 months, showing: total
  tickets created, total tickets resolved, total tickets closed, and net change
  in open tickets for the period.
- **FR-007**: The volume report MUST support breakdown filtering by: ticket
  category, ticket priority, and customer organisation.
- **FR-008**: The volume report MUST display a time-series trend of tickets
  created and resolved, grouped by week for ranges ≤ 90 days and by month for
  ranges > 90 days.

**Agent Performance Report**

- **FR-009**: Admins and Support Managers MUST be able to view an agent
  performance report for a selected date range (up to 12 months), showing per
  active agent: name, total tickets handled, total tickets resolved, average
  first response time (hours), and average resolution time (hours).
- **FR-010**: The performance report MUST visually flag agents whose average
  resolution time exceeds the configured threshold for any ticket priority level
  within the selected period.
- **FR-011**: The performance report MUST be sortable by: agent name (A–Z),
  tickets handled (descending), and average resolution time (slowest first).
- **FR-012**: Support Agents MUST be able to access a personal summary showing
  their own totals for the current week and the immediately preceding week;
  they MUST NOT be able to access the full team performance report or any other
  agent's data.

**Resolution Time Report**

- **FR-013**: Admins and Support Managers MUST be able to view average first
  response time and average resolution time segmented by ticket priority and
  ticket category for a selected date range.
- **FR-014**: The resolution time report MUST visually distinguish tickets
  resolved within target time from those that exceeded target time using
  configurable thresholds (see FR-025).

**Escalation Report**

- **FR-015**: Admins and Support Managers MUST be able to view an escalation
  report for a selected date range showing: total escalation events (auto +
  manual), breakdown by policy name (auto) and by originating agent (manual),
  average duration from escalation to de-escalation, and escalation rate as a
  percentage of total tickets created in the period.
- **FR-016**: The escalation report MUST support filtering by escalation type
  (all, auto only, manual only) and date range.

**Customer & Organisation Report**

- **FR-017**: Admins and Support Managers MUST be able to view a customer
  activity report listing the top N organisations by open ticket count and by
  total tickets created in the selected period, where N is configurable between
  5 and 50 (default 10).
- **FR-018**: Each organisation row in the report MUST be a clickable link that
  navigates to that organisation's profile in the Customer Management module.
- **FR-019**: The customer report MUST support date range filtering (up to
  12 months).

**Data Export**

- **FR-020**: All report views MUST provide a CSV export option that downloads
  all data currently visible in the report, respecting applied filters and
  the selected date range.
- **FR-021**: Admins MUST additionally be able to export any report as a
  formatted PDF suitable for print and presentation.
- **FR-022**: Both CSV and PDF exports MUST complete within 60 seconds for
  datasets covering up to 12 months and 10,000 tickets; if the export exceeds
  60 seconds the user receives a timeout error and a suggestion to narrow the
  date range.

**Thresholds & Configuration**

- **FR-023**: Admins MUST be able to configure resolution time thresholds per
  priority level used for highlighting in the performance and resolution time
  reports; defaults are CRITICAL: 2 hours, HIGH: 8 hours, MEDIUM: 24 hours,
  LOW: 48 hours.
- **FR-024**: Threshold changes MUST take effect in all subsequent report
  generations; previously exported reports are unaffected.

**Access Control**

- **FR-025**: Customers MUST NOT have access to any reporting view or export.
- **FR-026**: Support Agents MUST only access their own personal performance
  summary; access to all other report views MUST be denied with a
  permission-refused response.
- **FR-027**: Support Managers and Admins MUST have access to all report views
  and exports; no report scope is restricted between these two roles in v1.

### Key Entities

This module is read-only and does not own any persistent entities. All data is
sourced from the following entities owned by preceding modules:

- **Ticket** (`003-ticket-management`): status, priority, category, timestamps,
  assignee, customer reference
- **TicketActivityLogEntry** (`003-ticket-management`): first agent comment
  timestamp (for response time), status change timestamps
- **Customer** and **Organization** (`002-customer-management`): customer names
  and organisation memberships for the customer activity report
- **EscalationEvent** (`005-escalation-management`): escalation counts, policy
  names, durations
- **AgentAvailability** / **TeamMembership** (`004-ticket-assignment`): agent
  roster for the performance report

The module uses one configurable entity it owns:

- **ReportThresholdConfig**: Admin-configurable resolution time targets per
  priority level, used for highlight logic in performance and resolution time
  reports.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The operations overview loads with current data in under 5 seconds
  and auto-refreshes with data no older than 5 minutes without a manual reload.
- **SC-002**: Any date-range report covering up to 12 months of data loads and
  renders in under 10 seconds for datasets up to 10,000 tickets.
- **SC-003**: CSV and PDF exports complete within 60 seconds for datasets up to
  12 months / 10,000 tickets; zero exports exceed 60 seconds without returning
  a user-visible error and guidance to narrow the range.
- **SC-004**: Support Agents are denied access to all report views except their
  own personal summary — 100% access control enforcement across all report
  endpoints and URLs.
- **SC-005**: Escalation rate percentages are accurate to within ±1 percentage
  point of the true value computed from raw ticket and escalation data.
- **SC-006**: Managers can open the dashboard, navigate to any report, apply
  filters, and export results within 3 minutes of logging in.
- **SC-007**: Date-range filter changes re-render the report in under 5 seconds
  for the same 12-month / 10,000-ticket dataset.

## Assumptions

- This module is entirely read-only; it queries data from all preceding modules
  but does not create, update, or delete any records in those modules.
- All data is sourced from the live operational database shared by preceding
  modules; no separate analytics datastore or pre-computed data warehouse is
  used in v1. Query performance targets (SC-001, SC-002) must be met through
  appropriate indexes and query design.
- "Average first response time" is defined as the time elapsed from ticket
  creation to the first agent-visible (non-internal-note) comment added by
  any agent, manager, or admin on that ticket.
- "Average resolution time" is defined as the time elapsed from ticket creation
  to the ticket first reaching RESOLVED status.
- Resolution time thresholds default to: CRITICAL 2 hours, HIGH 8 hours,
  MEDIUM 24 hours, LOW 48 hours. These are configurable by Admin and stored in
  `ReportThresholdConfig`.
- Date range selection is bounded at a maximum of 12 months (365 days) for
  performance reasons; longer historical queries are out of scope for v1.
- The "top N" setting for the customer/organisation report is configurable
  between 5 and 50; the default is 10.
- Auto-refresh of the operations overview is implemented via polling at a
  5-minute interval; real-time push is deferred to a future enhancement.
- Report data reflects the current state of tickets (e.g., current category,
  current agent name); historical state-at-a-point-in-time reporting is out
  of scope for v1.
- Customers have no access to any part of the reporting dashboard; it is an
  internal tool for operational staff only.
- PDF export formatting renders tabular data with wrapping to fit standard A4
  and US Letter page widths; complex chart images are not included in PDF
  exports in v1 (tables only).
- Prerequisites: `001-user-auth`, `002-customer-management`,
  `003-ticket-management`, `004-ticket-assignment`, `005-escalation-management`,
  `006-notifications`.
