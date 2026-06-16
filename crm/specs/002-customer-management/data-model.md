# Data Model: Customer Management

**Feature**: 002-customer-management
**Date**: 2026-06-16
**Depends on**: `001-user-auth` (User, Role, AccountStatus enums)

---

## Entity Relationships

```
User (auth module) ──── Customer (1:1 via userId)
Organization ──────────< Customer (1:many via organizationId)
Organization ──────────○ Customer (0:1 via primaryContactId)
Customer ──────────────< CustomerProfileAuditEntry
```

---

## Entity: Customer

Extends the `User` record from the Auth module with CRM profile data and
organisational context.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `userId` | UUID | FK → User.id, Unique, NOT NULL | 1:1 link to Auth module identity |
| `fullName` | String | NOT NULL | Max 200 chars; trimmed |
| `phone` | String? | Nullable | Optional; max 30 chars |
| `jobTitle` | String? | Nullable | Optional; max 100 chars |
| `organizationId` | UUID? | FK → Organization.id, Nullable | Null = no org affiliation |
| `createdAt` | DateTime | NOT NULL, auto-set | |
| `updatedAt` | DateTime | NOT NULL, auto-updated | |

**Indexes**: `userId` (unique), `organizationId`, trigram GiST on `lower(fullName)` and `lower(email)` (via JOIN to User)

**Derived / joined fields** (not stored, fetched via JOIN to User):
- `email` — from `User.email`
- `role` — from `User.role`
- `status` — from `User.status`

**Validation rules**:
- `fullName` must be non-empty and ≤ 200 characters
- `phone` if provided must match a loose E.164-style format (digits, spaces, hyphens, `+`, parentheses; max 30 chars); full phone validation is presentation-layer concern
- A Customer record is always accompanied by exactly one User record; creating a Customer without a User is forbidden

**Field update permissions** (enforced by use cases):

| Field | Admin | Support Manager | Support Agent | Customer (own) |
|-------|-------|----------------|---------------|----------------|
| `fullName` | ✅ | ✅ | ❌ | ✅ |
| `phone` | ✅ | ✅ | ❌ | ✅ |
| `jobTitle` | ✅ | ✅ | ❌ | ✅ |
| `organizationId` | ✅ | ✅ | ❌ | ❌ |
| `email` (User) | ✅ | ❌ | ❌ | ❌ |
| `status` (User) | ✅ | ❌ | ❌ | ❌ |

---

## Entity: Organization

Represents a company or business entity that groups one or more customers.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `name` | String | Unique, NOT NULL | Max 200 chars; case-insensitive uniqueness enforced in use case |
| `emailDomain` | String? | Nullable | Optional; e.g. `acme.com`; max 253 chars |
| `industry` | String? | Nullable | Optional; max 100 chars |
| `primaryContactId` | UUID? | FK → Customer.id, Nullable | Optional; must be an existing customer |
| `createdAt` | DateTime | NOT NULL, auto-set | |
| `updatedAt` | DateTime | NOT NULL, auto-updated | |

**Indexes**: `name` (unique, case-insensitive enforced at use-case layer), `primaryContactId`

**Validation rules**:
- `name` must be non-empty, ≤ 200 characters, and unique (case-insensitive check before insert)
- `emailDomain` if provided must not include `@` or `http://`; format: `domain.tld`
- `primaryContactId` if set must reference an existing, active Customer in the system
- An Organisation with associated customers MUST NOT be deleted (enforced in `DeleteOrganisationUseCase`; DB FK provides safety net)

**State**: No explicit status field; organisations are deleted (hard) only after all members are removed.

---

## Entity: CustomerProfileAuditEntry

Immutable log of every field-level change to a Customer profile.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `customerId` | UUID | FK → Customer.id, NOT NULL | Cascade delete when Customer is deleted |
| `fieldName` | String | NOT NULL | e.g. `"fullName"`, `"phone"`, `"organizationId"` |
| `previousValue` | String? | Nullable | Null for initial value on create |
| `newValue` | String? | Nullable | Null when field is cleared |
| `changedById` | UUID | FK → User.id, NOT NULL | The user who made the change |
| `changedAt` | DateTime | NOT NULL, auto-set | |

**Indexes**: `(customerId, changedAt)` for profile history queries; `changedById`

**Rules**:
- Append-only; no UPDATE or DELETE (except cascade when Customer is deleted)
- Written in the same Prisma transaction as the profile update — no update without an audit entry
- `previousValue` and `newValue` are stored as strings; complex types (e.g., `organizationId`) are stored as the string UUID representation
- Sensitive fields (email, if updated) are stored in the audit log as-is for compliance; the log itself is accessible only to Admin

---

## Prisma Schema (reference)

```prisma
model Customer {
  id             String    @id @default(uuid())
  userId         String    @unique
  fullName       String
  phone          String?
  jobTitle       String?
  organizationId String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization   Organization? @relation("OrganizationMembers", fields: [organizationId], references: [id], onDelete: SetNull)
  primaryFor     Organization? @relation("OrganizationPrimaryContact")
  auditEntries   CustomerProfileAuditEntry[]

  @@index([organizationId])
}

model Organization {
  id               String    @id @default(uuid())
  name             String    @unique
  emailDomain      String?
  industry         String?
  primaryContactId String?   @unique
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  members          Customer[] @relation("OrganizationMembers")
  primaryContact   Customer?  @relation("OrganizationPrimaryContact", fields: [primaryContactId], references: [id], onDelete: SetNull)
}

model CustomerProfileAuditEntry {
  id            String   @id @default(uuid())
  customerId    String
  fieldName     String
  previousValue String?
  newValue      String?
  changedById   String
  changedAt     DateTime @default(now())

  customer      Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  changedBy     User     @relation(fields: [changedById], references: [id])

  @@index([customerId, changedAt])
  @@index([changedById])
}
```

> **Note**: The GiST trigram index for customer search is defined in a raw
> Prisma migration SQL block:
> ```sql
> CREATE EXTENSION IF NOT EXISTS pg_trgm;
> CREATE INDEX customer_search_idx ON "Customer"
>   USING GiST (lower("fullName") gist_trgm_ops);
> -- Email search index goes on the User table (owned by 001-user-auth migration)
> ```
