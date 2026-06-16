# Feature Specification: Ticket Management

**Feature Branch**: `003-ticket-management`

**Created**: 2026-06-16

**Status**: Draft

**Input**: User description: "Lets create Ticket management module now"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Customer Submits a Support Ticket (Priority: P1)

A customer who needs help opens the ServiceDesk portal and creates a new support
ticket describing their issue. They provide a title, a detailed description, and
optionally select a priority and category. The system acknowledges the submission
with a unique ticket reference number and the customer can track the ticket's
progress from that point on.

**Why this priority**: Without ticket creation there is no support workflow. This
is the fundamental entry point for all service desk activity — everything else
(assignment, resolution, reporting) depends on tickets existing.

**Independent Test**: Can be validated by logging in as a test customer, submitting
a ticket form, and verifying that a ticket appears in the customer's ticket list
with a unique reference number and status OPEN.

**Acceptance Scenarios**:

1. **Given** a logged-in Customer, **When** they submit a ticket with a title
   and description, **Then** the ticket is created with status OPEN, a unique
   reference number is assigned (e.g., TKT-00001), and the ticket appears in
   their ticket list immediately.
2. **Given** a Customer submitting a ticket, **When** they do not select a
   priority, **Then** the system defaults the priority to MEDIUM.
3. **Given** a Customer submitting a ticket with a title but an empty description,
   **Then** the system rejects the submission and shows a validation error
   indicating that a description is required.
4. **Given** an Admin or Support Agent, **When** they create a ticket on behalf
   of an existing customer, **Then** the ticket is linked to that customer's
   profile and the customer can view it in their own ticket list.

---

### User Story 2 - Agent Picks Up and Works a Ticket (Priority: P2)

A Support Agent reviews the queue of unassigned tickets, self-assigns one, and
begins working on it. They update the ticket status as their investigation
progresses, add internal notes for their colleagues, and respond to the customer
with updates — all within the same ticket thread.

**Why this priority**: The agent workflow is the operational core of the service
desk. Without it, submitted tickets sit unactioned and customers receive no help.

**Independent Test**: Can be validated by creating a test ticket as a customer,
logging in as an agent, self-assigning the ticket, changing its status to
IN_PROGRESS, adding a customer-visible comment and an internal note, and verifying
that the internal note is not visible when viewing the ticket as the customer.

**Acceptance Scenarios**:

1. **Given** a Support Agent viewing the unassigned ticket queue, **When** they
   click "Assign to me" on an OPEN ticket, **Then** the ticket is assigned to
   them, the status remains OPEN, and the assignment is recorded in the activity log.
2. **Given** an agent with an assigned ticket, **When** they change the status to
   IN_PROGRESS, **Then** the ticket status updates immediately and the change
   appears in the activity log with the agent's identity and timestamp.
3. **Given** an agent adding an internal note to a ticket, **When** the customer
   views the same ticket, **Then** the internal note is not visible; the customer
   sees only their own and agent-visible comments.
4. **Given** an agent adding a customer-visible comment to a PENDING ticket,
   **When** the comment is saved, **Then** the ticket status automatically
   transitions from PENDING to IN_PROGRESS.

---

### User Story 3 - Manager Assigns and Monitors the Ticket Queue (Priority: P3)

A Support Manager views all open tickets across the team, assigns unassigned
tickets to specific agents, reassigns tickets from overloaded agents to available
ones, and adjusts ticket priorities when business conditions change. They have
visibility into all tickets regardless of who they are assigned to.

**Why this priority**: Without manager oversight, the ticket queue becomes a
black box. Managers need to balance workload, respond to priority changes, and
ensure SLAs are not missed.

**Independent Test**: Can be validated by seeding a set of unassigned and assigned
tickets, logging in as a manager, assigning an unassigned ticket to a specific
agent, and then reassigning an existing ticket to a different agent — verifying
both changes are reflected in the ticket and the activity log.

**Acceptance Scenarios**:

1. **Given** a Support Manager viewing the full ticket list, **When** they assign
   an OPEN unassigned ticket to an agent, **Then** the ticket shows the agent as
   its assignee and the assignment event is logged.
2. **Given** a Support Manager, **When** they reassign a ticket from one agent to
   another, **Then** both the old and new assignees are recorded in the activity
   log, and the new agent can see the ticket in their assigned queue.
3. **Given** a Support Manager changing a ticket's priority from MEDIUM to HIGH,
   **Then** the priority update is saved and appears in the activity log with the
   previous and new values.
4. **Given** a Support Agent, **When** they attempt to reassign a ticket they own
   to another agent, **Then** the system denies the action — only Admins and
   Managers may reassign tickets.

---

### User Story 4 - Customer and Agent Communicate via Comments (Priority: P4)

A customer and support agent exchange messages directly on the ticket to clarify
the issue, request additional information, and confirm when the problem is
resolved. The conversation is threaded, timestamped, and attributable to each
participant.

**Why this priority**: The comment thread is how the support relationship actually
happens. Without it, the ticket is just a record — there is no collaboration.

**Independent Test**: Can be validated end-to-end by submitting a ticket as a
customer, adding a comment as an agent, replying as the customer, verifying both
comments appear in order with correct authorship, and confirming that internal
notes from the agent are not visible to the customer.

**Acceptance Scenarios**:

1. **Given** a Customer viewing their ticket, **When** they submit a comment,
   **Then** the comment appears in the ticket thread with their name and the
   current timestamp, visible to both the customer and the assigned agent.
2. **Given** an Agent adding a comment with an attachment, **When** they submit
   up to 5 files each under 10 MB, **Then** all attachments upload successfully
   and are accessible as download links on the comment.
3. **Given** a Customer who replies to a PENDING ticket (agent waiting for
   information), **When** their comment is submitted, **Then** the ticket status
   automatically changes from PENDING to IN_PROGRESS, signalling the agent that
   a response has arrived.
4. **Given** a user attempting to attach a file exceeding 10 MB, **Then** the
   system rejects the file before upload with a clear size-limit error message.

---

### User Story 5 - Ticket Resolution and Closure (Priority: P5)

An agent marks a ticket as RESOLVED after providing a solution. The customer
receives notification, reviews the resolution, and either confirms it (closing
the ticket) or replies with further questions (which returns the ticket to
IN_PROGRESS). If the customer takes no action, the ticket closes automatically
after 7 days.

**Why this priority**: Closure is what completes the support loop and frees
agents to handle new tickets. Without a clear resolution flow, tickets
accumulate in limbo and agent capacity is misrepresented.

**Independent Test**: Can be validated by resolving a test ticket as an agent,
then confirming closure as the customer. A second test verifies auto-close: set
a ticket to RESOLVED, advance the system clock past the 7-day window, and
confirm the ticket is now CLOSED.

**Acceptance Scenarios**:

1. **Given** an agent marking a ticket RESOLVED, **When** the status is saved,
   **Then** the ticket status becomes RESOLVED, the resolution date is recorded,
   and the customer is eligible to confirm closure.
2. **Given** a Customer confirming a RESOLVED ticket, **When** they click "Close
   ticket", **Then** the ticket status becomes CLOSED and no further status
   changes are permitted.
3. **Given** a Customer who replies with a new comment on a RESOLVED ticket,
   **When** the comment is submitted, **Then** the ticket status automatically
   reverts to IN_PROGRESS, alerting the agent that the issue persists.
4. **Given** a RESOLVED ticket where the customer has not responded for 7 days,
   **When** the scheduled auto-close process runs, **Then** the ticket status
   becomes CLOSED with a system-generated activity log entry recording the
   auto-close event.
5. **Given** a CLOSED ticket, **When** the customer attempts to add a comment or
   change the status, **Then** the system rejects the action with a message that
   the ticket is closed and a new ticket must be created for further help.

---

### Edge Cases

- What happens when a customer whose account is deactivated has open tickets?
  Their tickets remain accessible to agents but the customer can no longer
  add comments.
- What happens when an agent who has assigned tickets is deactivated? Their
  tickets revert to unassigned (OPEN) and appear in the unassigned queue.
- What happens when two agents attempt to self-assign the same ticket
  simultaneously? The first request succeeds; the second receives a conflict
  response indicating the ticket was just assigned.
- What happens when a file attachment upload fails partway through? The comment
  is not saved; the user must retry — no partial comment with missing attachments.
- What happens when an admin attempts to assign a ticket to a deactivated agent?
  The system rejects the assignment with a clear error.
- What happens when a customer tries to cancel a ticket that is already IN_PROGRESS?
  The customer can only cancel OPEN tickets; they must request cancellation via
  a comment for in-progress tickets.
- What happens when the same ticket is updated (status change) by two users at
  the same time? The system applies the first update and returns a conflict
  error to the second, asking the user to refresh.

## Requirements *(mandatory)*

### Functional Requirements

**Ticket Creation**

- **FR-001**: Customers MUST be able to create a new support ticket with: title
  (required, max 200 chars), description (required, max 5,000 chars), priority
  (optional, default MEDIUM), and category (optional).
- **FR-002**: Admins, Support Managers, and Support Agents MUST be able to create
  a ticket on behalf of an existing customer by specifying the customer record.
- **FR-003**: System MUST assign a unique, human-readable reference number to
  each ticket upon creation (format: `TKT-NNNNN`, sequential, zero-padded).
- **FR-004**: System MUST set ticket status to OPEN automatically upon creation.

**Ticket Viewing & Search**

- **FR-005**: Customers MUST only be able to view tickets they have created;
  they MUST NOT be able to access other customers' tickets.
- **FR-006**: Support Agents MUST be able to view all unassigned tickets and all
  tickets assigned to them; they MUST NOT be able to view tickets assigned to
  other agents unless they are also unassigned.
- **FR-007**: Admins and Support Managers MUST be able to view all tickets in
  the system regardless of status, assignee, or customer.
- **FR-008**: Ticket list views MUST support pagination (default page size 20,
  maximum 100), filtering by status, priority, category, and assignee, and
  sorting by creation date, updated date, and priority.

**Ticket Lifecycle & Status**

- **FR-009**: The permitted ticket statuses are: OPEN, IN_PROGRESS, PENDING,
  RESOLVED, CLOSED, CANCELLED.
- **FR-010**: Valid status transitions MUST be enforced:
  - OPEN → IN_PROGRESS, CANCELLED
  - IN_PROGRESS → PENDING, RESOLVED, OPEN (unassign/requeue)
  - PENDING → IN_PROGRESS (customer reply or agent action)
  - RESOLVED → CLOSED (customer confirmation or auto-close), IN_PROGRESS (customer reply)
  - CLOSED → no further transitions permitted
  - CANCELLED → no further transitions permitted
- **FR-011**: Customers MUST be able to cancel their own tickets only when status
  is OPEN; cancellation is blocked for any other status.
- **FR-012**: Customers MUST be able to confirm a RESOLVED ticket, transitioning
  it to CLOSED.
- **FR-013**: System MUST automatically transition a RESOLVED ticket to CLOSED
  if the customer adds no comment and performs no action within 7 days of the
  RESOLVED status being set.
- **FR-014**: A customer reply (comment) on a PENDING or RESOLVED ticket MUST
  automatically transition the ticket to IN_PROGRESS.
- **FR-015**: An agent reply (comment) on a PENDING ticket MUST NOT change the
  ticket status; only a customer reply changes PENDING status.

**Ticket Assignment**

- **FR-016**: Admins and Support Managers MUST be able to assign any unassigned
  or assigned ticket to any active Support Agent.
- **FR-017**: Admins and Support Managers MUST be able to reassign a ticket from
  one agent to another.
- **FR-018**: Support Agents MUST be able to self-assign any unassigned ticket.
- **FR-019**: System MUST reject assignment to a deactivated agent with a clear
  error.
- **FR-020**: System MUST handle simultaneous self-assignment conflicts: the
  first request wins; subsequent requests receive a conflict response.
- **FR-021**: When an agent's account is deactivated, all tickets assigned to
  them MUST automatically revert to unassigned status.

**Comments & Internal Notes**

- **FR-022**: Customers, Agents, Admins, and Support Managers MUST be able to
  add comments to any ticket they are permitted to view.
- **FR-023**: Agents, Admins, and Support Managers MUST be able to mark a comment
  as an internal note; internal notes MUST be visible only to Agents, Admins, and
  Managers — never to Customers.
- **FR-024**: Comments MUST be plain text; rich text formatting is out of scope
  for v1.
- **FR-025**: A CLOSED or CANCELLED ticket MUST NOT accept new comments from any
  user.

**File Attachments**

- **FR-026**: Any user adding a comment MUST be able to attach up to 5 files per
  comment submission.
- **FR-027**: Individual file size MUST NOT exceed 10 MB; the system MUST reject
  oversized files before upload is attempted.
- **FR-028**: Permitted attachment file types: images (JPG, PNG, GIF, WEBP),
  documents (PDF, DOCX, XLSX, TXT), archives (ZIP).
- **FR-029**: If any file in a comment submission fails validation, the entire
  comment submission MUST be rejected; no partial comments with missing
  attachments are permitted.

**Activity Log**

- **FR-030**: System MUST automatically record an activity log entry for every
  state-changing event on a ticket: status change, priority change, category
  change, assignment change, comment added (customer-visible or internal),
  auto-close.
- **FR-031**: Each activity log entry MUST record: event type, triggering user
  identity (or "System" for automated events), previous value, new value, and
  timestamp.
- **FR-032**: Activity log entries MUST be append-only; no edits or deletions
  are permitted.
- **FR-033**: All users with access to a ticket MUST be able to view its full
  activity log; internal note entries in the log MUST be hidden from Customers.

**Category Management**

- **FR-034**: Admins MUST be able to create new ticket categories with a name
  (required, unique, max 100 chars).
- **FR-035**: Admins MUST be able to rename existing categories.
- **FR-036**: Admins MUST be able to deactivate a category; deactivated categories
  MUST NOT appear in the category selection when creating or updating a ticket,
  but existing tickets retain their category label for historical display.

**Integration**

- **FR-037**: The Ticket module MUST provide a concrete implementation of the
  `ITicketSummaryService` interface defined in the Customer Management module
  (`002-customer-management`), returning total tickets, open ticket count, and
  last ticket date for a given customer.

### Key Entities

- **Ticket**: The primary support request record. Has a unique reference number,
  title, description, status, priority, category, assigned agent, and owning
  customer. Tracks resolution and closure dates.
- **TicketComment**: A message on the ticket thread. Has body text, authorship,
  a flag for internal-note visibility, and a collection of attachments.
- **TicketAttachment**: A file linked to a comment. Stores the filename, file
  type, size, and a storage reference (URL or key to the object store).
- **TicketActivityLogEntry**: An immutable record of a single state-changing
  event on a ticket. Records event type, actor, before/after values, and
  timestamp.
- **TicketCategory**: A configurable label for classifying tickets. Has a name
  and an active/inactive status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Customers can create a new support ticket in under 2 minutes from
  opening the new-ticket form to receiving a confirmation with a reference number.
- **SC-002**: Ticket list and queue views for agents (up to 1,000 visible tickets)
  load in under 3 seconds.
- **SC-003**: 100% of ticket state-changing events — status changes, assignments,
  priority changes, comment additions — are captured in the activity log with the
  triggering user's identity and an accurate timestamp.
- **SC-004**: Internal notes are never visible to Customer-role users — zero
  leakage in all tested access scenarios.
- **SC-005**: File attachments up to 10 MB upload successfully and become
  accessible on the comment within 30 seconds under standard network conditions.
- **SC-006**: Simultaneous self-assignment of the same ticket by two agents
  results in exactly one successful assignment; the losing request receives a
  conflict error within 2 seconds.
- **SC-007**: Auto-close of RESOLVED tickets executes within 1 hour of the 7-day
  inactivity window expiring; no RESOLVED ticket remains unclosed past 7 days
  1 hour.
- **SC-008**: Ticket reference numbers are globally unique — zero duplicate
  reference numbers across the full lifetime of the system.

## Assumptions

- Ticket reference numbers are sequential integers padded to 5 digits (TKT-00001,
  TKT-00002, …); the format is configurable by Admin in a future version.
- File attachments are stored in an external object store (S3-compatible service);
  this module generates a pre-signed upload URL and stores the file reference
  key — the storage service itself is out of scope for this feature.
- Email and in-app notifications for ticket events (creation, assignment, new
  comment, status change) are handled by the Notifications module (a future
  feature); this module emits domain events but does not send notifications directly.
- Full-text search across ticket titles and descriptions is out of scope for v1;
  only structured filtering (status, priority, category, assignee) is in scope.
- Rich text formatting in comments (bold, bullet lists, code blocks) is out of
  scope for v1; plain text only.
- Auto-close of RESOLVED tickets is triggered by a scheduled background job
  (e.g., daily cron); the scheduling infrastructure itself is out of scope for
  this feature — the module only provides the query and transition logic.
- Customers cannot reopen a CLOSED ticket; they must create a new ticket.
  Reopening can only be done by Admins or Support Managers.
- A ticket can be assigned to at most one agent at a time.
- Category management (create, rename, deactivate) is restricted to Admin only.
- This module provides the concrete implementation of `ITicketSummaryService`
  from `002-customer-management`, fulfilling the integration contract that module
  defined as a stub.
- The Authentication module (`001-user-auth`) and the Customer Management module
  (`002-customer-management`) are prerequisite dependencies of this module.
- Agent visibility into tickets is scoped: agents see all unassigned tickets plus
  tickets explicitly assigned to them; they do not see tickets assigned to peers.
  This may be expanded in a future "team visibility" feature.
