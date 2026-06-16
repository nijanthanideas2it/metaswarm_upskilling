# ServiceDesk CRM

A Freshdesk-like customer support platform built with React, Node.js, and PostgreSQL.

## Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, TanStack Query, Zustand
- **Backend:** Node.js 20, Express 4, Prisma 5
- **Database:** PostgreSQL 15
- **Auth:** JWT (httpOnly cookies) + Refresh Tokens

## Roles

`ADMIN` · `SUPPORT_MANAGER` · `SUPPORT_AGENT` · `CUSTOMER`

## Getting Started

```bash
# Install dependencies
cd frontend && npm install
cd ../backend && npm install

# Set up environment variables
cp backend/.env.example backend/.env

# Run database migrations
cd backend && npx prisma migrate dev

# Start development servers
npm run dev   # backend
npm run dev   # frontend
```

## API

REST API versioned under `/api/v1/`. Swagger UI available at `/api/docs`.
