# Feature Specification: Escalation Management

**Feature Branch**: `005-escalation-management`

**Created**: 2026-06-16

**Status**: Draft

**Input**: User description: "Lets create Escalation management module"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manager Configures Escalation Policies (Priority: P1)

A Support Manager creates escalation policies that define when and how tickets
should be escalated. A policy groups one or more timed escalation tiers — Tier 1
fires first (e.g., after 4 hours without a response), Tier 2 fires later if the
ticket is still unresolved (e.g., after 8 hours), and so on. Each tier specifies
who to notify and what action to take. Policies can be scoped to specific ticket
categories or priorities.

**Why this priority**: Escalation policies are the foundation of the entire
module. Without configured rules, neither automatic nor tracked escalations are
possible. This is the configuration surface that drives all downstream behaviour.

**Independent Test**: Can be validated by creating a policy with two tiers,
scoping it to CRITICAL priority tickets, verifying it appears in the policy list,
and confirming both tiers are visible with their configured thresholds and targets.
Deactivating the policy and verifying it no longer evaluates against new tickets
completes the test.

**Acceptance Scenarios**:

1. **Given** a Support Manager on the policy creation form, **When** they create
   a policy with a name, an optional scope (category and/or priority), and at
   least one tier with a time threshold and action, **Then** the policy is saved
   and appears in the active policies list.
2. **Given** a policy with two tiers (Tier 1 at 4 hours, Tier 2 at 8 hours),
   **When** the manager views the policy detail, **Then** both tiers are displayed
   in order with their thresholds, trigger conditions, and configured actions.
3. **Given** a Support Manager who deactivates a policy, **When** tickets
   subsequently meet its trigger conditions, **Then** the policy does not fire
   and no escalation event is recorded.
4. **Given** a Manager updating a tier's time threshold from 4 hours to 2 hours,
   **When** the change is saved, **Then** new evaluations use the updated threshold;
   tickets already escalated at the old threshold are unaffected.

---

### User Story 2 - System Automatically Escalates an Overdue Ticket (Priority: P2)

A CRITICAL-priority ticket has been open for 4 hours without an agent response.
The system evaluates all active escalation policies on its scheduled interval,
detects that the ticket meets the Tier 1 threshold of the "Critical Response"
policy, executes the configured actions — notifying the Support Manager on-call
and elevating a duplicate-MEDIUM ticket to HIGH — and records the event in the
ticket's activity log. If the ticket is still unresolved 8 hours later, Tier 2
fires automatically.

**Why this priority**: Automated escalation is the primary value of this module.
Manual oversight of every ticket's age is not scalable; the system must surface
at-risk tickets without depending on human vigilance.

**Independent Test**: Can be validated by creating a ticket meeting a rule's
scope, manipulating the ticket's creation timestamp to be beyond the threshold,
running the evaluation cycle, and confirming within 5 minutes that the escalation
actions executed and the activity log contains the escalation event with the
triggering policy and tier.

**Acceptance Scenarios**:

1. **Given** an active policy with a Tier 1 rule (trigger: unassigned for > 2
   hours, scope: all priorities), **When** a ticket remains unassigned for 2
   hours and the evaluation cycle runs, **Then** the escalation actions execute
   and an escalation event is logged in the ticket's activity trail.
2. **Given** a ticket where Tier 1 has already fired, **When** the ticket
   continues to meet Tier 1's conditions, **Then** Tier 1 does NOT fire again —
   only unfired tiers are eligible.
3. **Given** a ticket that reaches RESOLVED status while an auto-escalation
   evaluation is pending, **When** the evaluation runs, **Then** escalation
   processing is skipped for that ticket and no escalation event is recorded.
4. **Given** a ticket that meets both Tier 1 of Policy A and Tier 1 of Policy B
   in the same evaluation cycle, **Then** both escalations fire; if both target
   the same recipient, only one notification is sent (deduplication).

---

### User Story 3 - Agent Manually Escalates a Complex Ticket (Priority: P3)

A Support Agent working on a ticket determines that the issue is beyond their
expertise or authority — for example, a billing dispute that requires management
sign-off. They manually escalate the ticket, provide a reason, and optionally
specify a target recipient to be notified. The escalated flag is set immediately,
the ticket is marked visually in the queue, and the intended recipient is alerted.

**Why this priority**: Not all escalations are time-driven. Technical complexity,
customer VIP status, or legal sensitivity may require escalation well before a
time threshold is breached. Manual escalation gives the team the discretion to
act immediately.

**Independent Test**: Can be validated by logging in as a test agent, opening
an assigned ticket, triggering manual escalation with a written reason, and
verifying the escalated flag appears on the ticket, the target recipient receives
a notification event, and the activity log records the escalation with the agent's
identity and their stated reason.

**Acceptance Scenarios**:

1. **Given** a Support Agent with an assigned ticket, **When** they submit a
   manual escalation with a non-empty reason, **Then** the ticket is flagged as
   Escalated, the activity log records the event with the agent's identity and
   reason, and configured targets are notified.
2. **Given** an Agent attempting to manually escalate a ticket not assigned to
   them, **Then** the system denies the action — agents may only escalate their
   own tickets.
3. **Given** a Support Manager, **When** they manually escalate any ticket,
   **Then** the escalation is accepted and the target recipient (if specified)
   is notified.
4. **Given** an Agent submitting a manual escalation with an empty reason field,
   **Then** the system rejects the submission and shows a validation error — a
   reason is mandatory for manual escalations.

---

### User Story 4 - Manager Reviews and Acts on Escalated Tickets (Priority: P4)

A Support Manager opens the escalated tickets queue — a filtered view showing
only currently escalated tickets, sorted by time since escalation and priority.
They review each ticket, take action (reassigning it, adding a comment, or
contacting the customer), and when satisfied that the situation is under control,
de-escalate the ticket by providing a resolution note.

**Why this priority**: Escalation is only effective if someone acts on it.
The escalated ticket queue and the de-escalation workflow close the loop —
they ensure escalated items receive manager attention and are explicitly
cleared rather than forgotten.

**Independent Test**: Can be validated by seeding several escalated tickets
with different priorities and escalation timestamps, loading the escalated queue
as a manager, confirming the sort order, de-escalating one ticket with a
resolution note, and verifying it disappears from the escalated queue while the
de-escalation note appears in the ticket's activity log.

**Acceptance Scenarios**:

1. **Given** a Support Manager on the escalated ticket queue, **Then** all
   currently escalated tickets are displayed sorted by priority (CRITICAL first)
   then by time since escalation (oldest first), showing ticket reference, title,
   customer, assignee, priority, and time since escalation.
2. **Given** a Support Manager viewing an escalated ticket, **Then** they can
   see the full escalation history for that ticket: all tiers that have fired,
   the manual escalations, and any prior de-escalation events.
3. **Given** a Support Manager who de-escalates a ticket with a required resolution
   note, **When** the action is confirmed, **Then** the escalated flag is removed,
   the ticket disappears from the escalated queue, and the de-escalation note
   is appended to the activity log.
4. **Given** a Support Agent, **When** they attempt to de-escalate a ticket,
   **Then** the system denies the action — only Admins and Support Managers may
   de-escalate.

---

### User Story 5 - Admin Audits Escalation History Across All Tickets (Priority: P5)

An Admin reviews the escalation audit log to understand escalation patterns
across the support team — which policies fire most frequently, which agents
escalate most often, how long tickets remain in escalated state before being
de-escalated, and whether escalation targets are responding promptly. This view
informs decisions about policy tuning and team capacity.

**Why this priority**: Without an audit view, escalation management is a black
box. Admins need historical data to determine whether policies are tuned
correctly and whether the team is responding to escalations appropriately.

**Independent Test**: Can be validated by triggering several auto and manual
escalations across different tickets, opening the escalation audit view as an
admin, and confirming that all events appear with correct type, policy/reason,
target, ticket reference, and timestamp. Filtering by date range and policy
should narrow the list correctly.

**Acceptance Scenarios**:

1. **Given** an Admin on the escalation audit screen, **Then** they can see a
   chronological list of all escalation events across all tickets, showing: event
   type (auto/manual), ticket reference, policy and tier (for auto) or reason
   (for manual), target notified, and timestamp.
2. **Given** an Admin filtering the audit by date range, **When** they apply the
   filter, **Then** only escalation events within that range are displayed.
3. **Given** an Admin filtering by a specific policy, **Then** only escalations
   triggered by that policy are shown.
4. **Given** an Admin viewing the audit, **When** they click a ticket reference,
   **Then** they are taken directly to that ticket's detail view.

---

### Edge Cases

- What happens when a ticket matches multiple active policies simultaneously?
  All matching policies fire independently; notifications to the same recipient
  from different policies in the same evaluation cycle are deduplicated into one.
- What happens when an escalation target user is deactivated before the
  notification is sent? The deactivated target is skipped; remaining targets
  still receive notifications; the skip is logged in the escalation event.
- What happens when a policy is deactivated while a ticket has partially escalated
  through its tiers? Fired tiers remain in history; unfired tiers are cancelled
  and will not execute even if the ticket lingers.
- What happens when an auto-escalation fires on a ticket that was manually
  escalated earlier? Both events are recorded independently; the ticket's
  escalated flag is already set, so the auto-escalation does not set it again
  but does log its own event and execute its actions.
- What happens when a de-escalated ticket subsequently meets a new (unfired)
  escalation tier? The new tier fires normally — de-escalation only clears the
  flag and does not reset the policy's fired-tier state.
- What happens when a ticket is reassigned as an escalation action but the target
  agent is unavailable at the time of escalation? The reassignment executes
  regardless of availability; availability management is the concern of the
  Assignment module.
- What happens when the evaluation cycle is delayed (e.g., infrastructure issue)
  and a threshold is exceeded by a wide margin? The escalation fires on the next
  successful evaluation; the logged timestamp reflects when the event was
  processed, not when the threshold was first breached.

## Requirements *(mandatory)*

### Functional Requirements

**Escalation Policy & Rule Configuration**

- **FR-001**: Admins and Support Managers MUST be able to create escalation
  policies with a unique name (required, max 150 chars), an optional description,
  and an optional scope (one or more ticket categories and/or one or more
  ticket priorities).
- **FR-002**: A policy with no scope defined MUST apply to all tickets regardless
  of category or priority.
- **FR-003**: Each policy MUST contain between 1 and 5 escalation tiers, ordered
  numerically (Tier 1 through Tier 5); tiers fire in ascending order.
- **FR-004**: Each tier MUST specify one trigger condition from:
  - Time elapsed since ticket creation exceeds a threshold (in hours)
  - Time elapsed since the last agent comment exceeds a threshold (in hours)
  - Ticket has been unassigned for longer than a threshold (in hours)
- **FR-005**: Each tier MUST specify one or more actions:
  - Notify a named user (by selecting from active agents and managers)
  - Notify all users of a role (all Support Managers, all Admins)
  - Reassign the ticket to a specific agent or team
  - Elevate ticket priority to the next level (LOW→MEDIUM→HIGH→CRITICAL)
- **FR-006**: Admins and Support Managers MUST be able to activate and deactivate
  individual policies; deactivated policies MUST be excluded from evaluation.
- **FR-007**: Admins MUST be able to delete a policy permanently; deletion MUST
  be blocked while the policy is active (it must be deactivated first).

**Automatic Escalation Execution**

- **FR-008**: The system MUST evaluate all active escalation policies against
  all tickets with status OPEN, IN_PROGRESS, or PENDING on a scheduled interval
  of no more than 15 minutes.
- **FR-009**: For each ticket–policy pair, only tiers not previously fired MUST
  be evaluated; already-fired tiers MUST NOT re-execute.
- **FR-010**: When a tier's trigger condition is met, the system MUST execute all
  configured actions for that tier within 5 minutes of the evaluation detecting
  the breach.
- **FR-011**: The system MUST halt escalation processing for a ticket when its
  status is RESOLVED or CLOSED; any unfired tiers are permanently skipped for
  that ticket.
- **FR-012**: When two or more simultaneous escalation events target the same
  recipient, the system MUST send only one consolidated notification per
  recipient per evaluation cycle.
- **FR-013**: Tickets created by Agents or Admins on behalf of customers MUST
  be subject to escalation policies identically to customer-submitted tickets.

**Manual Escalation**

- **FR-014**: Support Agents MUST be able to manually escalate tickets assigned
  to them; a non-empty reason (max 1,000 chars) is required.
- **FR-015**: Admins and Support Managers MUST be able to manually escalate any
  ticket; a non-empty reason is required.
- **FR-016**: Customers MUST NOT be able to trigger an escalation.
- **FR-017**: A manual escalation MUST allow the escalating user to optionally
  specify one or more notification targets (named users or roles).
- **FR-018**: A manually escalated ticket MUST immediately receive the Escalated
  flag regardless of whether an auto-escalation has previously fired.

**Escalated Ticket Flag & Queue**

- **FR-019**: An "Escalated" flag on a ticket MUST be a separate attribute from
  ticket status; a ticket can simultaneously be IN_PROGRESS and Escalated.
- **FR-020**: Admins, Managers, and Agents MUST see a visual indicator on
  escalated tickets in all ticket list views.
- **FR-021**: Customers MUST NOT see the Escalated flag or any escalation-related
  information on their ticket views.
- **FR-022**: Admins and Support Managers MUST be able to access a dedicated
  escalated ticket queue showing only currently escalated tickets, sorted by
  priority (CRITICAL first) then by oldest escalation timestamp.

**De-escalation**

- **FR-023**: Admins and Support Managers MUST be able to de-escalate a ticket
  by providing a required resolution note (max 1,000 chars).
- **FR-024**: De-escalation MUST immediately remove the Escalated flag and remove
  the ticket from the escalated queue.
- **FR-025**: De-escalation MUST NOT change the ticket's status; the ticket
  remains in whatever status it was in.
- **FR-026**: Resolving a ticket (status → RESOLVED) MUST NOT automatically
  de-escalate it; de-escalation is always an explicit action.
- **FR-027**: After de-escalation, unfired auto-escalation tiers MAY continue to
  fire if their trigger conditions are subsequently met; de-escalation does not
  reset the policy's fired-tier tracking.

**Escalation Notifications**

- **FR-028**: When any escalation event fires (auto or manual), the system MUST
  emit a notification event to the Notifications module with: ticket reference,
  escalation type, tier (if auto), reason or policy name, target list, ticket
  status, and time elapsed since creation.
- **FR-029**: Notification delivery (email, in-app) is delegated to the
  Notifications module; this module MUST NOT send notifications directly.

**Audit & History**

- **FR-030**: Every escalation event MUST be recorded in the ticket's activity
  log with: event type (auto-escalation or manual-escalation), triggering policy
  name and tier (for auto) or reason (for manual), targets notified, and timestamp.
- **FR-031**: Every de-escalation MUST be recorded in the ticket's activity log
  with: the de-escalating user's identity, the resolution note, and timestamp.
- **FR-032**: Admins MUST be able to access a system-wide escalation audit log
  listing all escalation and de-escalation events across all tickets, filterable
  by date range and policy name.

### Key Entities

- **EscalationPolicy**: A named, scopeable collection of ordered escalation tiers.
  Has a name, optional description, optional scope (categories and/or priorities),
  and an active/inactive status.
- **EscalationTier**: A single level within a policy. Has an ordinal (1–5), a
  trigger condition type, a threshold value, and one or more configured actions.
- **EscalationAction**: A single action within a tier — one of: notify user,
  notify role, reassign ticket, elevate priority.
- **EscalationEvent**: An immutable record of a single escalation occurrence
  (auto or manual), capturing the source ticket, policy and tier (for auto) or
  reason (for manual), the list of targets notified, and timestamp. Stored
  separately from the ticket activity log for system-wide audit queries.
- **TicketEscalationState**: Per-ticket tracking of which policy tiers have
  already fired, to prevent duplicate escalations. Includes the current escalated
  flag and escalation timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Auto-escalation evaluation runs at least every 15 minutes; all
  matching escalation actions execute within 5 minutes of a threshold being
  detected as breached.
- **SC-002**: 100% of escalation events — auto and manual — are recorded in the
  ticket activity log and the system-wide audit log with full context (type,
  policy/reason, targets, timestamp).
- **SC-003**: A single escalation tier fires at most once per ticket per policy;
  zero duplicate tier-escalation events on the same ticket.
- **SC-004**: Notification deduplication works correctly: when two simultaneous
  escalation events target the same recipient, they receive exactly one
  notification per evaluation cycle — never zero, never more than one.
- **SC-005**: Managers can load the escalated ticket queue in under 3 seconds for
  up to 500 currently escalated tickets.
- **SC-006**: Admins can load and filter the system-wide escalation audit log in
  under 5 seconds for datasets covering up to 12 months of escalation history.
- **SC-007**: Admins and Managers can create, configure, and activate a complete
  escalation policy (name, scope, two tiers with actions) in under 5 minutes.

## Assumptions

- This module does not own SLA policy definitions or SLA timers; trigger
  thresholds within escalation rules are expressed as absolute time values
  (hours elapsed). Integration with the SLA Tracking module (`006-sla-tracking`)
  will be addressed when that module is designed — SLA-percentage-based triggers
  (e.g., "escalate when 80% of SLA response time is consumed") are deferred to
  that integration.
- The "Escalated" flag is a boolean attribute on the Ticket entity (added by this
  module to the ticket data model), distinct from ticket status. Escalated tickets
  can be in any status except CLOSED or CANCELLED.
- Notification delivery (email, in-app push) is owned by the Notifications module
  (a future feature); this module emits structured escalation events and does not
  send messages directly.
- Auto-escalation evaluation runs as a scheduled background job at a configurable
  interval (default: every 15 minutes); the scheduling infrastructure (cron or
  job queue) is out of scope for this feature specification.
- Priority elevation as an escalation action respects the four-level scale defined
  in `003-ticket-management` (LOW → MEDIUM → HIGH → CRITICAL); elevating a
  CRITICAL ticket does not change its priority.
- Customers are not aware of escalation — the Escalated flag and all escalation
  history are hidden from customer views.
- A ticket may accrue escalation events from multiple policies simultaneously;
  each policy tracks its own tier-fired state independently.
- The evaluation cycle timestamp is the authoritative time for logging; if an
  infrastructure delay causes a late detection, the log reflects actual processing
  time, not the theoretical breach time.
- Prerequisites: `001-user-auth`, `002-customer-management`,
  `003-ticket-management`, `004-ticket-assignment`.
