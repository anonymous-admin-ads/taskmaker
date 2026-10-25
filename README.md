# TaskFlow Enterprise (TaskMaker)

> Enterprise-grade project, task, and agile workflow management platform featuring **Hold Box** & **Blocked Box** workflow branches, dedicated **Developer Console ("God Mode")**, real-time UI controls, and automated AES-256 encrypted backups.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [How to Run](#how-to-run)
  - [1. Quick Start (Single Terminal)](#1-quick-start-single-terminal)
  - [2. Individual Component Execution](#2-individual-component-execution)
  - [3. Production Build and Run](#3-production-build-and-run)
- [Default Credentials & Portals](#default-credentials--portals)
  - [Standard Workspace Users](#standard-workspace-users)
  - [Developer Console ("God Mode")](#developer-console-god-mode)
- [Workflow Engines: Hold Box & Blocked Box](#workflow-engines-hold-box--blocked-box)
- [Project Structure](#project-structure)
- [Available npm Scripts](#available-npm-scripts)
- [API Architecture & Proxying](#api-architecture--proxying)
- [Backups & Disaster Recovery](#backups--disaster-recovery)
- [Running Automated Tests](#running-automated-tests)
- [License](#license)

---

## Overview

**TaskFlow Enterprise** is a high-performance, full-stack enterprise project and task management system designed to eliminate workflow bottlenecks and provide real-time operational governance. Built with **React 19**, **TypeScript**, **Tailwind CSS v4**, **Vite 8**, and an **Express 5 + SQLite WAL** backend, TaskFlow delivers sub-millisecond database queries, instant URL-synchronized client-side navigation, and multi-theme personalization.

---

## Key Features

- **Interactive Kanban & Agile Workflow**:
  - Drag-and-drop / status transitions across *Backlog*, *To Do*, *In Progress*, *Dev Review*, *Testing/QA*, and *Done*.
- **Specialized Workflow Branches**:
  - **Hold Box**: Stashes tickets waiting on external client dependencies, assets, or feedback without skewing active sprint velocity.
  - **Blocked Box**: Dedicated critical escalation branch for blocked tickets with blocker descriptions, severity metrics, and resolution history.
- **Developer Console ("God Mode" at `/godmode`)**:
  - Independent root administrative portal completely isolated from normal workspace sessions.
  - Dynamically toggle UI buttons, views, and navigation links platform-wide in real-time.
  - Master switch for Role-Based Access Control (RBAC) enforcement.
  - Live system health, metrics, schema browser, and audit log inspector.
- **Automated AES-256 Disaster Recovery**:
  - Scheduled automated backups saved as encrypted `.tfbak` archives in `backups/`.
  - Self-healing sandbox restore verification on startup and recurring intervals.
- **Role-Based Access Control (RBAC)**:
  - 7 standard roles: `super_admin`, `admin`, `project_manager`, `team_lead`, `developer`, `qa_engineer`, and `viewer`.
  - Fine-grained permission matrix with support for per-user permission overrides.
- **Rich Multiple Views**:
  - **Dashboard**: High-level KPIs, project progress, sprint velocity, and activity feeds.
  - **Kanban Board**: Column-based workflow with tag and priority indicators.
  - **Backlog**: Sprint planning and prioritization.
  - **List View**: Dense tabular data view with instant multi-column filtering.
  - **Timeline / Roadmap**: Gantt-style planning view.
  - **Calendar**: Task due dates and milestone scheduling.
  - **Reports & Analytics**: Real-time throughput, cycle time, and blocker statistics.
  - **Sprints & Projects**: Manage sprints, repositories, team leads, and member directories.
- **Personalization & Theme Engine**:
  - Instant theme switching between **Midnight Cyan** (default dark), **Ocean Blue**, and **Arctic Light**.

---

## Tech Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | Modern functional components, typed contexts, and zero vanilla JS in `src/`. |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Official `@tailwindcss/vite` plugin with native `@theme` design tokens. |
| **Icons** | [Lucide React](https://lucide.dev/) | Consistent iconography throughout all views and modals. |
| **Build & Dev Tool** | [Vite 8](https://vite.dev/) | Instant HMR, code chunking, and built-in reverse proxy to backend. |
| **Backend Server** | [Express 5](https://expressjs.com/) | Node.js ES modules (`type: module`), compression, cookie-parser, dynamic CORS. |
| **Database** | [SQLite (WAL Mode)](https://www.sqlite.org/wal.html) | Native Node `node:sqlite` (`DatabaseSync`) with 64MB memory cache and ACID transactions. |
| **Security** | `node:crypto` | Cryptographic `scrypt` password hashing, timing-safe authentication, and brute-force rate limiting. |

---

## Prerequisites

- **Node.js**: `v22.0.0` or higher (Node `v24+` recommended)
- **npm**: `v10.0.0` or higher

Check your installed versions:
```bash
node -v
npm -v
```

---

## How to Run

### 1. Quick Start (Single Terminal)

You do **NOT** need multiple terminals. Running `npm run dev` automatically starts both the backend API and the frontend concurrently:

```bash
# 1. Install dependencies (if not already installed)
npm install

# 2. Launch the unified development environment
npm run dev
```

Once started, the console will output:
```
========================================================
   TASKFLOW ENTERPRISE - UNIFIED DEV ENVIRONMENT       
   Backend (Express API :4000) + Frontend (Vite :3000) 
========================================================

TaskFlow Enterprise Server running on http://localhost:4000
SQLite Persistent Database with WAL Mode & ACID Compliance

  VITE v8.3.5  ready in 150 ms
  ➜  Local:   http://localhost:3000/
```

- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **Backend API Server**: [http://localhost:4000](http://localhost:4000)
- **Health Check Endpoint**: [http://localhost:4000/api/health](http://localhost:4000/api/health)

> [!TIP]
> Press `Ctrl + C` once in your terminal to cleanly stop both the frontend and backend servers together.

---

### 2. Individual Component Execution

If you ever wish to run the frontend and backend separately:

```bash
# Start frontend only (Vite dev server on :3000)
npm run dev:frontend

# Start backend only (Express API on :4000)
npm run dev:backend
```

---

### 3. Production Build and Run

To compile and serve optimized production assets:

```bash
# 1. Build optimized frontend distribution in dist/
npm run build

# 2. Start production Express server (serves API + static SPA files)
npm start
```
The server will be available at [http://localhost:4000](http://localhost:4000).

---

## Default Credentials & Portals

The database automatically initializes and seeds default accounts upon first startup.

### Standard Workspace Users
Use these credentials on the main login screen at [http://localhost:3000/login](http://localhost:3000/login):

| Name | Email / User ID | Password | Role |
| :--- | :--- | :--- | :--- |
| **Hyagreenan G** | `hyagreenan@company.com` / `USR-ADMIN` | `Admin@123` | Project Manager |
| **Kamalesh** | `kamalesh@company.com` / `USR-101` | `Admin@123` | Project Manager |
| **Lokesh** | `lokesh@company.com` / `USR-102` | `Admin@123` | Developer |
| **Aman** | `aman@company.com` / `USR-103` | `Admin@123` | QA Engineer |
| **Afzal** | `afzal@company.com` / `USR-105` | `Admin@123` | Team Lead |
| **Karthik** | `karthik@company.com` / `USR-104` | `Admin@123` | Developer |

---

### Developer Console ("God Mode")
The Developer Console has its own dedicated portal for platform administration:

- **Portal URL**: [http://localhost:3000/godmode](http://localhost:3000/godmode)
- **User ID**: `DEV-CONSOLE-ROOT` *(or `devconsole@system.local`)*
- **Password**: `DevConsole@123`

> [!IMPORTANT]
> Normal workspace users cannot log into the Developer Console, and the `DEV-CONSOLE-ROOT` identity cannot access normal workspace boards. This strict isolation prevents cross-session privilege escalation.

---

## Workflow Engines: Hold Box & Blocked Box

TaskFlow provides dedicated workflow controls for handling paused or stalled work without losing context:

```
[To Do] ──> [In Progress] ──> [Dev Review] ──> [Testing / QA] ──> [Done]
                 │                   │
                 ├── [ Hold Box ] ───┘ (Requires reason & expected release date)
                 │
                 └── [ Blocked Box ] ──> (Requires severity & blocker root-cause)
```

1. **Hold Box**:
   - Used when waiting on third-party API keys, client design approvals, or external dependencies.
   - Requires a mandatory **Hold Reason** and estimated release timeline.
   - Moving out of Hold Box requires documenting **Release Notes**.
2. **Blocked Box**:
   - Used when work has ground to a complete halt due to severe defects or environment outages.
   - Requires **Blocker Description** and **Severity level** (`Low`, `Medium`, `High`, `Critical`).
   - Resolving a blocker records resolution notes and restores the ticket to its preceding review state.

---

## Project Structure

```text
taskmaker/
├── data/                       # Persistent SQLite database (WAL mode)
│   └── taskflow.db             # Primary SQLite database file
├── backups/                    # Encrypted automated database backups (.tfbak)
├── dist/                       # Production compiled frontend bundle
├── scripts/
│   └── dev.mjs                 # Unified dev runner (launches backend & frontend)
├── server/                     # Backend Express 5 application
│   ├── db/
│   │   ├── database.js         # SQLite connection & high-performance PRAGMAs
│   │   ├── migrations.js       # Atomic schema migrations
│   │   └── seed.js             # Initial roles, users, and enterprise seed data
│   ├── routes/                 # Express API endpoints
│   │   ├── authRoutes.js       # Authentication, sessions & rate limiting
│   │   ├── ticketRoutes.js     # Ticket CRUD & status transitions
│   │   ├── workflowRoutes.js   # Hold Box & Blocked Box transition engines
│   │   ├── projectRoutes.js    # Projects, repositories, and members
│   │   ├── backupRoutes.js     # Manual & scheduled backup management
│   │   ├── uiControlRoutes.js  # Developer Console UI toggles
│   │   └── adminRoutes.js      # User management & audit logs
│   ├── services/               # Core business logic services
│   │   ├── authService.js      # scrypt cryptography & session validation
│   │   ├── permissionService.js# RBAC enforcement & override engine
│   │   ├── workflowEngine.js   # Automated rule execution & loop suppression
│   │   └── backupService.js    # AES-256 backup creation & verify-restore
│   └── server.js               # Express entrypoint & background scheduler
├── src/                        # Frontend React 19 + TypeScript application
│   ├── api/
│   │   └── client.ts           # Centralized API fetch wrapper
│   ├── components/
│   │   ├── auth/               # Login & Sign-up pages
│   │   ├── common/             # Error boundaries & context menus
│   │   ├── kanban/             # Kanban board, columns, and cards
│   │   ├── layout/             # Top navigation & sidebar
│   │   ├── modals/             # Modals (Hold Box, Blocked Box, Create Ticket)
│   │   └── views/              # View screens (Dashboard, Sprints, God Mode, etc.)
│   ├── context/                # Auth, Theme, Toast, and UI Control providers
│   ├── types/                  # TypeScript interfaces and domain models
│   ├── utils/
│   │   └── router.ts           # Client-side SPA route definitions and URL synchronization
│   ├── App.tsx                 # Root application component & layout routing
│   ├── index.css               # Tailwind CSS v4 directives & theme variables
│   └── main.tsx                # React DOM mount point
├── tests/                      # Automated test suites
├── index.html                  # HTML entrypoint
├── package.json                # Dependencies, metadata & scripts
├── tsconfig.json               # TypeScript configuration
└── vite.config.ts              # Vite configuration & proxy settings
```

---

## Available npm Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | **Recommended**: Starts both backend (:4000) and frontend (:3000) concurrently in a single terminal. |
| `npm run dev:frontend` | Starts only the Vite dev server with Hot Module Replacement. |
| `npm run dev:backend` | Starts only the Express API server. |
| `npm run build` | Builds the React frontend into `dist/` with optimized chunking. |
| `npm run preview` | Locally previews the production build with Vite. |
| `npm start` | Launches the production Express server serving the API and `dist/` static files. |
| `npm test` | Executes the complete test verification suite across workflow, security, and persistence. |

---

## API Architecture & Proxying

In development, Vite proxies all `/api/*` network calls to `http://localhost:4000`:

```
Browser (:3000) ──> Vite Proxy (/api) ──> Express Backend (:4000)
```

Core API endpoint groups:
- `POST /api/auth/login`: User and Developer Console authentication.
- `GET /api/projects`: List projects with member and sprint metadata.
- `GET /api/tickets`: Query tickets filtered by project, sprint, status, or assignee.
- `POST /api/workflow/transition`: Validate and execute workflow moves (Hold/Blocked/Standard).
- `GET /api/ui-controls`: Retrieve dynamic UI element toggles governed by God Mode.
- `POST /api/backup/create`: Trigger an immediate AES-256 database backup.
- `GET /api/health`: Instant server health and timestamp check.

---

## Backups & Disaster Recovery

- **Atomic SQLite WAL**: The database operates with `PRAGMA journal_mode = WAL` and `PRAGMA synchronous = NORMAL` for high concurrency without locks.
- **Automated Encryption**: Backups are written using AES-256 encryption into `backups/*.tfbak`.
- **Scheduled Backups**: An automated scheduler in `server/server.js` triggers daily backups and verifies restore integrity in a memory sandbox on startup.
- **Manual Backups**: Super administrators can create or restore backups on demand from the Developer Console.

---

## Running Automated Tests

The project includes an end-to-end verification suite covering security, optimistic concurrency, workflow state machines, and backups:

```bash
npm test
```

Verifications include:
- `workflow.test.mjs`: Hold Box, Blocked Box, transition rules, and loop suppression.
- `persistence-concurrency.test.mjs`: Optimistic concurrency version checks.
- `security.test.mjs`: `scrypt` hashing, session revocation, and RBAC matrix.
- `backup-restore.test.mjs`: Atomic backup archive generation and sandbox restore.
- `session-separation.test.mjs`: Strict separation between Developer Console and Workspace users.

---

## License

ISC License. Built for enterprise project tracking and high-velocity engineering teams.
