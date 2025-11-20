# Airtable Clone

An [Airtable](https://www.airtable.com) clone built with [create-t3-app](https://create.t3.gg/).

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in your database and auth credentials

# Set up database
npm run db:push
npm run db:generate

# Start development server
npm run dev
```

## Development Commands

```bash
# Development
npm run dev          # Start development server with Turbo
npm run build        # Build for production
npm run start        # Start production server
npm run preview      # Build and start production server
npm run typecheck    # Run TypeScript type checking

# Code Quality
npm run check        # Run Biome linter
npm run check:write  # Fix linting issues
npm run check:unsafe # Fix with unsafe rules

# Database
npm run db:generate  # Create and apply migrations
npm run db:migrate   # Deploy migrations to production
npm run db:push      # Push schema changes (development)
npm run db:studio    # Open Prisma Studio GUI
```

## Core Architecture

**IndexedDB serves as the primary data source** for UI rendering, with PostgreSQL as the durable backend. All mutations go through a local write queue for offline support and optimistic updates.

### Technology Stack

- **Frontend**: Next.js + React + TypeScript
- **Styling**: TailwindCSS + PostCSS with Biome for linting
- **Data**: TRPC + TanStack Query + Prisma 6.5
- **UI**: Radix UI components + TanStack Table + TanStack Virtual
- **Auth**: NextAuth (Google auth)

## Key Features

- **Real-time Sync**: Background synchronization with conflict resolution
- **Large Dataset Support**: Handles large amount of records with virtualization and pagination
- **Optimistic Updates**: Instant UI feedback for all operations
- **Type Safety**: End-to-end TypeScript from database to UI
- **Spreadsheet-like Editing**: Cell editing with keyboard shortcuts support
- **Context Menus**: Right-click support for rows and columns with contextual actions

## Environment Configuration

Required environment variables (see `.env.example`):
- **Database**: `DATABASE_URL` - PostgreSQL connection string
- **Auth**: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- **Optional**: `SUPABASE_BULK_QUEUE_NAME` (default: "bulk_update"), `BULK_ROW_QUEUE_THRESHOLD` (default: 10000)


## Built With T3 Stack

This project is built on the [T3 Stack](https://create.t3.gg/) foundation with significant enhancements for local-first functionality.
