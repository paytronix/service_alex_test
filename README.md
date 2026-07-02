# ShiftFlow

Employee shift scheduling platform built with TypeScript, GraphQL, React, and PostgreSQL.

## Tech Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **API**: Express, Apollo Server 4, Pothos (code-first GraphQL), Prisma, PostgreSQL
- **Web**: React 18, Vite, Tailwind CSS, Apollo Client
- **Auth**: JWT access/refresh tokens with rotation, bcrypt password hashing
- **Real-time**: GraphQL Subscriptions via `graphql-ws`
- **Infrastructure**: Docker Compose, GitHub Actions CI

## Project Structure

```
├── apps/
│   ├── api/            # GraphQL API server
│   └── web/            # React SPA
├── packages/
│   ├── shared/         # Shared types, enums, constants
│   └── config/         # Shared ESLint/TSConfig/Prettier
├── docs/               # Architecture and data model docs
├── docker-compose.yml  # PostgreSQL + API + Web
└── .github/workflows/  # CI pipeline
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker and Docker Compose (for PostgreSQL)

### Local Development

```bash
# Install dependencies
pnpm install

# Start PostgreSQL
docker compose up postgres -d

# Generate Prisma client and run migrations
pnpm db:generate
pnpm db:migrate

# Start API and Web in development mode
pnpm dev
```

- API: http://localhost:4000/graphql
- Web: http://localhost:5173

### Using Docker Compose (full stack)

```bash
docker compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:4000/graphql

### Environment Variables

Copy the example env files and modify as needed:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

See `.env.example` for all available variables.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm test` | Run all tests |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:push` | Push schema to database (no migration) |

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full architecture overview.

## Data Model

See [docs/DATA_MODEL.md](docs/DATA_MODEL.md) for the ER diagram, all entities, and business rules.

## Features (Epics 1-3)

- [x] Monorepo with pnpm workspaces + Turborepo
- [x] Full Prisma schema (15 entities)
- [x] GraphQL API with code-first schema (Pothos)
- [x] User registration, login, email verification, password reset
- [x] JWT access + refresh token rotation
- [x] Organization CRUD with Owner auto-assignment
- [x] RBAC (Owner, Manager, Supervisor, Employee)
- [x] Member invitation by email
- [x] Audit logging
- [x] GraphQL Subscriptions (WebSocket)
- [x] React frontend with auth pages and dashboard
- [x] Protected routes with automatic token refresh
- [x] Docker Compose (PostgreSQL + API + Web)
- [x] GitHub Actions CI (lint + typecheck + test + migrate)
- [x] Unit tests for auth, RBAC, and components

## License

Proprietary
