# Data Model: User Authentication

**Feature**: 001-user-auth
**Date**: 2026-06-16

---

## Entities & Relationships

```
User ──< RefreshToken
User ──< PasswordResetToken
User ──< AuthEventLog
```

---

## Entity: User

Represents any registered individual who can authenticate into the system.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `email` | String | Unique, NOT NULL, indexed | Lowercase, trimmed before storage |
| `passwordHash` | String | NOT NULL | bcrypt hash, cost 12 |
| `role` | Enum | NOT NULL | `ADMIN`, `SUPPORT_MANAGER`, `SUPPORT_AGENT`, `CUSTOMER` |
| `status` | Enum | NOT NULL, default `ACTIVE` | `ACTIVE`, `DEACTIVATED` |
| `failedLoginAttempts` | Int | NOT NULL, default 0 | Reset to 0 on successful login |
| `lockedUntil` | DateTime? | Nullable | Null = not locked; set to `now + 15min` on 5th failure |
| `createdAt` | DateTime | NOT NULL, auto-set | |
| `updatedAt` | DateTime | NOT NULL, auto-updated | |

**Indexes**: `email` (unique), `status` (for admin queries)

**Validation rules**:
- `email` must be a valid RFC 5321 email address (enforced by `zod` at API boundary and `Email` value object in domain)
- `passwordHash` is never exposed in any API response
- `failedLoginAttempts` is incremented atomically; reset only on successful authentication
- A user with `status = DEACTIVATED` MUST NOT be allowed to log in regardless of credentials

**State transitions** (`status`):
```
ACTIVE ──── deactivate (Admin) ──→ DEACTIVATED
DEACTIVATED ── reactivate (Admin) ──→ ACTIVE
```

**State transitions** (lockout):
```
unlocked (failedLoginAttempts < 5)
  ──── 5th consecutive failure ──→ locked (lockedUntil = now + 15 min)
  ──── lockedUntil < now (automatic) OR Admin reset ──→ unlocked
  ──── successful login ──→ failedLoginAttempts = 0
```

---

## Entity: RefreshToken

Represents a single active session's renewal credential, stored server-side.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `tokenHash` | String | Unique, NOT NULL, indexed | SHA-256 hash of the raw opaque token |
| `userId` | UUID | FK → User.id, NOT NULL | Cascade delete when User is deleted |
| `expiresAt` | DateTime | NOT NULL | `createdAt + 7 days` |
| `revokedAt` | DateTime? | Nullable | Null = active; set on logout or rotation |
| `deviceInfo` | String? | Nullable | Optional user-agent/device hint for display |
| `createdAt` | DateTime | NOT NULL, auto-set | |

**Indexes**: `tokenHash` (unique), `userId` (for batch revocation on logout-all)

**Validation rules**:
- A `RefreshToken` is valid only when `revokedAt IS NULL` AND `expiresAt > NOW()`
- On every use, the token is revoked (`revokedAt = NOW()`) and a new one is
  issued in the same transaction (rolling rotation)
- On logout, all `RefreshToken` records for `userId` where `revokedAt IS NULL`
  with the matching `tokenHash` are revoked
- On password reset success, ALL active `RefreshToken` records for the user
  are revoked (force re-login across all devices)

---

## Entity: PasswordResetToken

Represents a pending password-change request tied to a user.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `tokenHash` | String | Unique, NOT NULL, indexed | SHA-256 hash of the raw URL token |
| `userId` | UUID | FK → User.id, NOT NULL | Cascade delete when User is deleted |
| `expiresAt` | DateTime | NOT NULL | `createdAt + 1 hour` |
| `usedAt` | DateTime? | Nullable | Null = not yet used; set on successful password change |
| `createdAt` | DateTime | NOT NULL, auto-set | |

**Indexes**: `tokenHash` (unique), `userId` (for invalidating prior tokens)

**Validation rules**:
- A `PasswordResetToken` is valid only when `usedAt IS NULL` AND `expiresAt > NOW()`
- When a new reset is requested for a user, ALL prior `PasswordResetToken` records
  for that `userId` with `usedAt IS NULL` are deleted (only latest link is valid)
- The raw token is never stored; the hash is stored; the raw token is only ever
  sent in the reset email URL

---

## Entity: AuthEventLog

Immutable audit trail for all authentication-related actions.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `userId` | UUID? | Nullable FK → User.id | Null for unrecognised email login attempts |
| `event` | Enum | NOT NULL | See event types below |
| `ipAddress` | String? | Nullable | Stored for audit; MUST NOT appear in application logs |
| `userAgent` | String? | Nullable | Truncated to 500 chars |
| `createdAt` | DateTime | NOT NULL, auto-set | |

**Event types** (`event` enum):
```
LOGIN_SUCCESS
LOGIN_FAILURE
ACCOUNT_LOCKED
LOGOUT
TOKEN_REFRESH
PASSWORD_RESET_REQUEST
PASSWORD_RESET_SUCCESS
PASSWORD_CHANGED
```

**Indexes**: `userId + createdAt` (for user audit queries), `createdAt` (for time-range admin queries)

**Rules**:
- Records are append-only; no UPDATE or DELETE
- `userId` is nullable to record failed logins for unrecognised email addresses
  without leaking whether the email exists (consistent response time)
- `ipAddress` is stored for compliance/audit but is masked in all application
  log output (first two octets retained: `192.168.x.x`)

---

## Prisma Schema (reference)

```prisma
enum Role {
  ADMIN
  SUPPORT_MANAGER
  SUPPORT_AGENT
  CUSTOMER
}

enum AccountStatus {
  ACTIVE
  DEACTIVATED
}

enum AuthEvent {
  LOGIN_SUCCESS
  LOGIN_FAILURE
  ACCOUNT_LOCKED
  LOGOUT
  TOKEN_REFRESH
  PASSWORD_RESET_REQUEST
  PASSWORD_RESET_SUCCESS
  PASSWORD_CHANGED
}

model User {
  id                    String               @id @default(uuid())
  email                 String               @unique
  passwordHash          String
  role                  Role
  status                AccountStatus        @default(ACTIVE)
  failedLoginAttempts   Int                  @default(0)
  lockedUntil           DateTime?
  createdAt             DateTime             @default(now())
  updatedAt             DateTime             @updatedAt

  refreshTokens         RefreshToken[]
  passwordResetTokens   PasswordResetToken[]
  authEventLogs         AuthEventLog[]

  @@index([status])
}

model RefreshToken {
  id          String    @id @default(uuid())
  tokenHash   String    @unique
  userId      String
  expiresAt   DateTime
  revokedAt   DateTime?
  deviceInfo  String?
  createdAt   DateTime  @default(now())

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model PasswordResetToken {
  id          String    @id @default(uuid())
  tokenHash   String    @unique
  userId      String
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime  @default(now())

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model AuthEventLog {
  id          String     @id @default(uuid())
  userId      String?
  event       AuthEvent
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime   @default(now())

  user        User?      @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
  @@index([createdAt])
}
```
