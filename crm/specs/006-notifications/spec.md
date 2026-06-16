# Feature Specification: Notifications

**Feature Branch**: `006-notifications`

**Created**: 2026-06-16

**Status**: Draft

**Input**: User description: "lets create notifications module"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User Receives In-App Notifications in Real Time (Priority: P1)

A Support Agent is working in the portal when a manager reassigns one of their
tickets to them. Within 30 seconds a notification badge appears on the bell icon
in the navigation bar, showing a count of unread notifications. The agent clicks
the bell and sees the notification in their inbox: "Ticket TKT-00042 has been
assigned to you." Clicking the notification takes them directly to the ticket.

**Why this priority**: In-app notifications are the primary real-time awareness
mechanism for all users during active sessions. Agents need to know immediately
when something changes on a ticket they're responsible for. Without this, users
must manually poll ticket lists to detect changes.

**Independent Test**: Can be validated by triggering a ticket assignment event
for a test agent while that agent is logged into the portal, then confirming a
notification badge appears within 30 seconds and the inbox shows the correct
notification summary, link, and timestamp.

**Acceptance Scenarios**:

1. **Given** an Agent who is logged in, **When** a ticket is assigned to them,
   **Then** an in-app notification appears in their inbox within 30 seconds with
   the ticket reference, event summary, and a link to the ticket.
2. **Given** an Agent with 5 unread notifications, **When** they click the bell
   icon, **Then** all 5 notifications are listed newest-first with unread items
   visually distinguished from read ones.
3. **Given** an Agent who marks a single notification as read, **Then** the
   unread badge count decreases by 1 and the notification's visual indicator
   changes to indicate it is read.
4. **Given** an Agent who clicks "Mark all as read", **Then** all notifications
   in the inbox are marked read and the badge count resets to 0.
5. **Given** a Customer logged into the portal, **When** the status of their
   ticket changes, **Then** they receive an in-app notification with the new
   status and a link to the ticket — only notifications about their own tickets
   are shown.

---

### User Story 2 - User Receives Email Notifications for Key Events (Priority: P2)

A Customer submits a support ticket and receives an email confirming the
submission with the ticket reference number. Later, when the assigned agent
marks the ticket as resolved, the customer receives another email summarising
the resolution and inviting them to confirm it. A Support Agent receives an
email when a ticket they were not actively viewing has been escalated and
requires their immediate attention.

**Why this priority**: Email is the primary notification channel for users who
are not actively using the portal. Customers in particular rely on email to
stay informed about their tickets without needing to log in repeatedly. Email
is also essential for escalation alerts that must reach managers even when they
are away from their desks.

**Independent Test**: Can be validated by triggering a ticket creation event for
a test customer, intercepting the outbound email (via a test email inbox like
Mailtrap), and verifying the email is dispatched within 5 minutes, contains the
correct ticket reference, event description, and a valid link to the ticket.

**Acceptance Scenarios**:

1. **Given** a Customer who has just submitted a ticket, **When** the ticket is
   created successfully, **Then** the customer receives an email within 5 minutes
   confirming receipt with the ticket reference number and current status.
2. **Given** a Support Agent whose ticket has been escalated, **When** the
   escalation event fires, **Then** the agent receives an email within 5 minutes
   containing the ticket reference, escalation reason, time elapsed since creation,
   and a direct link to the ticket.
3. **Given** an email that fails to deliver on the first attempt, **When** the
   system retries, **Then** up to 3 delivery attempts are made with increasing
   intervals; the final outcome (sent or failed) is recorded in the delivery log.
4. **Given** a recipient whose email address is unverified or malformed,
   **When** the system attempts delivery, **Then** the delivery is marked as
   FAILED with a descriptive reason logged; no silent discard occurs.

---

### User Story 3 - User Configures Their Notification Preferences (Priority: P3)

A Support Agent finds that they are receiving too many email notifications for
every comment added to tickets — they only need emails for escalations and
assignments. They open their notification preferences page, disable email
notifications for "comment added" events, and set a quiet hours window of
10 PM to 7 AM so they aren't disturbed by non-critical emails overnight.
Critical escalation emails still reach them immediately outside quiet hours
because escalations bypass the quiet hours rule.

**Why this priority**: Without preference control, notification fatigue causes
users to ignore all notifications, defeating the purpose of the system.
Granular preferences ensure notifications remain actionable rather than noisy.

**Independent Test**: Can be validated by disabling the "comment added" email
preference for a test agent, adding a comment to one of their tickets, and
confirming no email is dispatched. Then re-enabling the preference and adding
another comment to confirm an email is sent within 5 minutes.

**Acceptance Scenarios**:

1. **Given** a Support Agent on their notification preferences page, **When**
   they disable email notifications for the "comment added" event type and save,
   **Then** subsequent comment events on their tickets generate in-app
   notifications only — no email is dispatched for that event type.
2. **Given** an Agent who sets quiet hours from 22:00 to 07:00, **When** an
   email notification event fires during that window, **Then** the email is held
   and dispatched at 07:00 the next morning rather than immediately.
3. **Given** an escalation event that fires while the Agent is in quiet hours,
   **When** the notification is generated, **Then** the escalation email is
   dispatched immediately despite the quiet hours setting — escalation events
   bypass quiet hours.
4. **Given** preference changes saved by a user at time T, **When** an event
   fires more than 60 seconds after T, **Then** the updated preferences are
   applied — no event uses stale preferences beyond the 60-second window.

---

### User Story 4 - Admin Customises Notification Templates (Priority: P4)

An Admin wants to update the email template for the "ticket assigned" event to
include the company logo URL, a more professional greeting, and the customer's
organisation name. They open the template editor, modify the subject and body
using the available variable placeholders, preview the result with sample data,
and publish. All subsequent assignment emails use the new template.

**Why this priority**: Default templates cover functional content but organisations
need to customise tone, branding, and information density to match their support
culture. Template management gives Admins full control without requiring code
deployments.

**Independent Test**: Can be validated by editing the "ticket assigned" email
template, adding a variable placeholder, previewing the rendered output with
sample data, publishing, and then triggering a ticket assignment to verify the
outbound email uses the updated template.

**Acceptance Scenarios**:

1. **Given** an Admin on the template list, **Then** they can see all templates
   grouped by event type (one email template and one in-app template per event
   type), each showing its last-modified date and the user who modified it.
2. **Given** an Admin editing an email template, **When** they insert a valid
   variable placeholder (e.g., `{{ticketReference}}`), preview, and publish,
   **Then** the preview renders the placeholder with sample data and subsequent
   emails for that event type use the updated content.
3. **Given** an Admin who removes a required variable from a template body and
   attempts to save, **Then** the system rejects the save with a validation error
   listing the missing required variables.
4. **Given** a template change published at time T, **When** a notification
   event fires more than 10 seconds after T, **Then** the updated template is
   used; events dispatched before T are unaffected.

---

### User Story 5 - Admin Troubleshoots a Failed Notification Delivery (Priority: P5)

An Agent reports they never received an email for an escalation event. The Admin
opens the notification delivery log, finds the notification by ticket reference
and event type, and sees that three delivery attempts were made, all returning
a "mailbox not found" error. The Admin corrects the agent's email address in
their profile and manually triggers a re-notification.

**Why this priority**: Delivery failures are invisible to end users. Admins need
observability into the notification pipeline to diagnose missed communications,
especially for high-stakes events like escalations.

**Independent Test**: Can be validated by triggering a notification to a known
invalid email address, verifying three delivery attempts appear in the log with
failure reasons, and confirming the notification status is FAILED (not silently
discarded).

**Acceptance Scenarios**:

1. **Given** an Admin viewing the delivery log for a specific ticket, **Then**
   they can see all notification events for that ticket: channel, recipient,
   event type, delivery status, attempt count, and timestamps for each attempt.
2. **Given** a notification that failed all 3 delivery attempts, **When** the
   Admin views its detail, **Then** they can see the error reason for each
   attempt and the final FAILED status.
3. **Given** an Admin who filters the delivery log by date range and delivery
   status FAILED, **Then** only failed notifications within that range are
   displayed, allowing systematic triage.
4. **Given** an Admin who clicks "Retry" on a failed notification (where the
   underlying issue has been resolved), **Then** the system makes one additional
   delivery attempt and updates the log with the new outcome.

---

### Edge Cases

- What happens when a notification event is emitted for a user whose account
  has been deactivated? The notification is created with status SUPPRESSED for
  that recipient; no delivery attempt is made on any channel.
- What happens when the external email service is unavailable for an extended
  period and the retry queue grows large? The queue persists; notifications
  retry on the standard schedule; no events are dropped. Admins can see the
  backlog in the delivery log.
- What happens when a user changes their email address while a notification to
  their old address is queued but not yet sent? The delivery uses the address
  current at dispatch time (new address), not the address at event time.
- What happens when two rapid-fire events target the same recipient for the
  same ticket (e.g., status change + comment within 1 second)? Both
  notifications are created and delivered independently; there is no merging or
  throttling in v1.
- What happens when a template contains a valid placeholder but the event payload
  does not supply that variable's value? The variable renders as an empty string
  and a warning is logged in the delivery log entry — delivery still proceeds.
- What happens when quiet hours span midnight (e.g., 23:00 to 06:00) and an
  event fires at 00:30? The email is held and dispatched at 06:00 that same day.
- What happens when an Admin re-triggers a notification manually for a SUPPRESSED
  event (deactivated user)? The system rejects the retry and shows an error
  explaining that the user is deactivated.

## Requirements *(mandatory)*

### Functional Requirements

**Event Ingestion & Recipient Resolution**

- **FR-001**: The system MUST accept notification events from all other modules
  via a defined internal event interface; accepted event types MUST include at
  minimum: TICKET_CREATED, TICKET_ASSIGNED, TICKET_REASSIGNED, TICKET_STATUS_CHANGED,
  TICKET_COMMENT_ADDED, TICKET_RESOLVED, TICKET_AUTO_CLOSED, TICKET_ESCALATED,
  TICKET_DE_ESCALATED, TICKET_AUTO_ASSIGNED.
- **FR-002**: For each event, the system MUST resolve the target recipients based
  on event type and payload (e.g., TICKET_ASSIGNED → assigned agent;
  TICKET_STATUS_CHANGED → ticket owner customer and assigned agent;
  TICKET_ESCALATED → all configured escalation targets for that event).
- **FR-003**: Before dispatching any notification, the system MUST check each
  recipient's preferences; if a recipient has disabled the event type on a
  channel, that channel MUST be skipped.
- **FR-004**: Notification events for deactivated users MUST be created with
  status SUPPRESSED and MUST NOT trigger any delivery attempt.

**In-App Notifications**

- **FR-005**: Each authenticated user MUST have a personal notification inbox
  accessible from all portal screens via a persistent notification icon showing
  the unread count (capped at 99+ display).
- **FR-006**: In-app notifications MUST display: event summary text, the
  ticket reference number (where applicable), a relative or absolute timestamp,
  and a clickable link to the related record.
- **FR-007**: In-app notifications MUST be delivered to a logged-in user's
  session within 30 seconds of the triggering event.
- **FR-008**: Users MUST be able to mark individual notifications as read
  and mark all notifications as read in a single bulk action.
- **FR-009**: The inbox MUST display the most recent 90 days of notifications,
  paginated at 20 per page (maximum 50 per page).
- **FR-010**: Customers MUST only see notifications about their own tickets;
  agents, managers, and admins see only notifications addressed to them.

**Email Notifications**

- **FR-011**: For each notification where the recipient's email preference is
  enabled for the event type, the system MUST send an email to the recipient's
  current registered email address.
- **FR-012**: Email notifications MUST include: a subject line identifying the
  event type and ticket reference, an event summary body, the current ticket
  status, and a hyperlink directly to the ticket in the portal.
- **FR-013**: Email notifications MUST be dispatched within 5 minutes of the
  triggering event (subject to quiet hours rules).
- **FR-014**: Failed email deliveries MUST be retried up to 3 times using
  exponential backoff (initial retry at 5 minutes, then 15 minutes, then 60
  minutes); after 3 failures the notification status is set to FAILED.
- **FR-015**: Every delivery attempt MUST be logged with channel, status, attempt
  number, error reason (if failed), and timestamp; no failure MUST be silently
  discarded.
- **FR-016**: Escalation event emails MUST bypass quiet hours and MUST be
  dispatched immediately.

**User Notification Preferences**

- **FR-017**: All users MUST be able to configure notification preferences
  per event type and per channel (in-app, email), independently toggling each
  combination.
- **FR-018**: Default preferences at account creation MUST be:
  - In-app: all event types enabled for all roles
  - Email: TICKET_ASSIGNED, TICKET_ESCALATED, TICKET_RESOLVED enabled; all
    others default off
- **FR-019**: Users MUST be able to configure a quiet hours window
  (start time, end time, and timezone) during which email notifications are
  held and delivered as a batch at the end of the window.
- **FR-020**: Quiet hours MUST apply only to email; in-app notifications MUST
  always be delivered in real time regardless of quiet hours.
- **FR-021**: Escalation event emails (TICKET_ESCALATED) MUST bypass quiet
  hours and deliver immediately for all recipients.
- **FR-022**: Preference changes MUST take effect for all events processed more
  than 60 seconds after the change is saved.
- **FR-023**: Admins MUST be able to view and override any user's notification
  preferences for compliance or operational reasons; overrides MUST be logged
  with the admin's identity and reason.

**Notification Templates**

- **FR-024**: The system MUST maintain one configurable template per event type
  per channel (email subject, email body, in-app summary text).
- **FR-025**: Admins MUST be able to edit template content using defined variable
  placeholders (e.g., `{{ticketReference}}`, `{{customerName}}`,
  `{{agentName}}`, `{{ticketStatus}}`, `{{portalLink}}`).
- **FR-026**: The system MUST validate that all required variables for a template
  are present before saving; saving MUST be blocked if required variables are
  missing.
- **FR-027**: Admins MUST be able to preview a rendered template populated with
  representative sample data before publishing.
- **FR-028**: Template changes MUST take effect for all notifications dispatched
  more than 10 seconds after the change is published.
- **FR-029**: The system MUST retain the previous version of each template so
  Admins can view what was in place before the last change; full version history
  is out of scope for v1.

**Delivery Tracking & Troubleshooting**

- **FR-030**: Admins MUST be able to view a notification delivery log filterable
  by: ticket reference, recipient, event type, channel, delivery status
  (PENDING, SENT, FAILED, SUPPRESSED), and date range.
- **FR-031**: Each delivery log entry MUST show: recipient identity, event type,
  channel, status, attempt count, error reason (if applicable), and timestamps
  for each attempt.
- **FR-032**: Admins MUST be able to manually trigger one additional delivery
  attempt on a FAILED notification, provided the recipient account is active;
  retrying a SUPPRESSED notification MUST be rejected.

### Key Entities

- **NotificationEvent**: A structured event payload emitted by another module
  and consumed by this module. Contains event type, source entity reference
  (e.g., ticket ID), timestamp, and a data payload used for template rendering
  and recipient resolution.
- **Notification**: A single user-targeted notification instance derived from a
  NotificationEvent. Has a status (PENDING, SENT, FAILED, SUPPRESSED), channel
  (IN_APP, EMAIL), read status (for in-app), and links to the event and recipient.
- **NotificationPreference**: A per-user, per-event-type, per-channel on/off
  setting with an associated quiet hours window and timezone.
- **NotificationTemplate**: Configurable content for a specific event type and
  channel, using variable placeholders. Stores the current version and a snapshot
  of the previous version.
- **NotificationDeliveryAttempt**: An immutable log entry for a single delivery
  attempt, recording channel, outcome, error reason, and timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In-app notifications appear in the recipient's session within
  30 seconds of the triggering event for 99% of events under normal load
  (up to 500 concurrent users).
- **SC-002**: Email notifications are dispatched within 5 minutes of the
  triggering event; 95% of successfully dispatched emails reach the recipient's
  inbox within 10 minutes of dispatch (subject to external provider SLA).
- **SC-003**: Preference changes take effect within 60 seconds; zero events
  processed more than 60 seconds after a preference change use the old
  preference value.
- **SC-004**: 100% of notification events are persisted as records; zero events
  are silently dropped — every failure is logged with a reason code.
- **SC-005**: Escalation emails bypass quiet hours and are dispatched within
  5 minutes regardless of the recipient's quiet hours setting.
- **SC-006**: Email delivery retry fires up to 3 times before the notification
  is marked FAILED; zero notifications enter a permanent FAILED state without
  all 3 retries having been attempted.
- **SC-007**: Admins can load and filter the delivery log for any 30-day window
  in under 5 seconds.

## Assumptions

- Authentication-related notifications (password reset confirmation, invitation
  email, password changed alert) are owned by `001-user-auth` and are excluded
  from this module's scope.
- Push notifications to native mobile devices (React Native app background push)
  are out of scope for v1; only in-app (in-session) and email channels are
  in scope. Mobile push is deferred to v2.
- The external email delivery service (SMTP relay or transactional email provider)
  is treated as a configurable integration; this module manages templates,
  dispatch logic, and retry state — it does not own the email service
  infrastructure.
- Quiet hours apply per-user, not per-organisation; there is no organisation-wide
  quiet hours policy in v1.
- Escalation event emails (TICKET_ESCALATED) always bypass quiet hours. No other
  event type bypasses quiet hours in v1.
- In-app notification delivery relies on real-time polling or a persistent
  connection from the frontend; the mechanism is an implementation concern and
  out of scope for this specification.
- Notification events are consumed from an internal interface (function call or
  message queue); this module does not poll other modules for changes.
- Customers receive notifications only for events related to their own tickets;
  they do not receive system-level or team-level notification types.
- The template system supports a fixed set of variable placeholders defined per
  event type; free-form scripting or conditional logic within templates is out
  of scope for v1.
- This module is the last module in the dependency chain for the ServiceDesk CRM
  v1 feature set; it depends on all preceding modules:
  `001-user-auth`, `002-customer-management`, `003-ticket-management`,
  `004-ticket-assignment`, `005-escalation-management`.
