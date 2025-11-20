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

**Advanced multi-layered data fetching architecture** with PostgreSQL backend optimized for large-scale spreadsheet applications.

### Data Fetching Strategy

- **Infinite Query Layer**: Primary data loading with cursor-based pagination
- **Viewport-Specific Fetching**: Smart prefetching based on user's current view
- **Lazy Cell Loading**: Separates row metadata from cell data for 70-80% payload reduction
- **Promise-Based Coordination**: Prevents duplicate requests and race conditions
- **Intelligent Caching**: Multi-level caching with automatic memory management

### Technology Stack

- **Frontend**: Next.js + React + TypeScript
- **Styling**: TailwindCSS + PostCSS with Biome for linting
- **Data**: TRPC + TanStack Query + Prisma 6.5
- **UI**: Radix UI components + TanStack Table + TanStack Virtual
- **Auth**: NextAuth (Google auth)

## Key Features

### Data Management

- **Smart Data Loading**: Multi-layered fetching with lazy cell loading for optimal performance
- **Viewport Optimization**: Only loads data for visible rows with intelligent prefetching
- **Large Dataset Support**: Handles millions of records with virtualization and smart pagination
- **Promise Coordination**: Advanced request management preventing duplicates and race conditions
- **Optimistic Updates**: Instant UI feedback for all operations with automatic rollback

### User Experience

- **Professional Spreadsheet Editing**: Smooth cell editing with anti-selection bug prevention
- **Row Selection System**: Comprehensive checkbox selection with drag handles
- **Keyboard Navigation**: Full spreadsheet-style keyboard shortcuts and navigation
- **Context Menus**: Right-click support for rows and columns with contextual actions
- **Loading States**: Professional placeholder rendering and progress tracking
- **Search & Filter**: Real-time search with highlighting and advanced filtering

## Advanced Architecture Features

### Multi-Layer Data Fetching

The application implements a sophisticated data fetching strategy that optimizes performance for large datasets:

1. **Primary Infinite Queries**: Cursor-based pagination for core data loading
2. **Viewport Data Fetching**: Smart prefetching based on user's current scroll position
3. **Lazy Cell Loading**: Separates row metadata from cell content for faster initial loads
4. **Missing Range Detection**: Intelligently identifies and fills data gaps
5. **Promise Management**: Coordinates multiple simultaneous requests to prevent duplicates

## Environment Configuration

Required environment variables (see `.env.example`):
- **Database**: `DATABASE_URL` - PostgreSQL connection string
- **Auth**: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- **Optional**: `SUPABASE_BULK_QUEUE_NAME` (default: "bulk_update"), `BULK_ROW_QUEUE_THRESHOLD` (default: 10000)