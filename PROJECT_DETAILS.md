# IncentivePro (IncenSys) — Full Project Documentation

> **Internal Product Name:** IncenSys  
> **Package Name:** `payout-power`  
> **Developed by:** IncentivePro Group  
> **Version:** 0.1.0  
> **Last Updated:** March 2026

---

## 1. Project Overview

**IncentivePro** (branded as **IncenSys** in the UI) is a full-stack, enterprise-grade **Incentive Management System (IMS)** built for sales-driven organizations. It provides end-to-end management of:

- Sales logging and deal tracking
- Commission scheme / incentive rule definition
- Incentive batch creation and multi-tier approval workflows
- Financial disbursement tracking
- Automated email notifications at every stage
- Role-based access control (RBAC)
- Audit logging
- CSV / Excel / PDF reporting and exports

The application targets companies like **IncentivePro Group** that have sales teams, team managers, accounts departments, and administrators who collectively need a structured, auditable incentive payout pipeline.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org) (App Router) |
| **Language** | TypeScript 5 |
| **UI Components** | [Radix UI](https://radix-ui.com) + [shadcn/ui](https://ui.shadcn.com) |
| **Styling** | Tailwind CSS v4 |
| **Animations** | Framer Motion |
| **Icons** | Lucide React |
| **Charts** | Recharts |
| **Database** | [Supabase](https://supabase.com) (PostgreSQL via RPC) |
| **Local DB (Desktop)** | better-sqlite3 |
| **Auth** | Custom JWT via `jose` (8h expiry, HS256) |
| **Email** | Nodemailer via SMTP (Gmail) |
| **Email (Alt)** | Resend API |
| **Form Handling** | React Hook Form + Zod |
| **Exports** | jsPDF + jspdf-autotable, xlsx, file-saver |
| **Desktop Shell** | Electron 31 (Electron Builder) |
| **Deployment** | Vercel (serverless) |
| **Runtime** | React 19, Node 20+ |

---

## 3. Application Architecture

### 3.1 Deployment Modes

The app runs in two modes:

| Mode | Description |
|---|---|
| **Web (Vercel)** | Full serverless Next.js app. Database via Supabase RPC. No local SQLite. |
| **Desktop (Electron)** | Electron shell wrapping the Vercel production URL. Adds local SQLite sync and offline backup to `Documents/IncentivePro/Backups`. The `better-sqlite3` sync is **automatically disabled** in Vercel environment. |

### 3.2 Directory Structure

```
red-ant/
├── src/
│   ├── app/               # Next.js App Router pages
│   │   ├── page.tsx       # Landing page (public)
│   │   ├── globals.css    # Global styles & theme tokens
│   │   ├── layout.tsx     # Root layout
│   │   ├── api/           # API Route Handlers
│   │   │   ├── auth/      # login, signup, logout, reset-password
│   │   │   ├── users/     # User management
│   │   │   ├── sales/     # Sales CRUD & approval
│   │   │   ├── batches/   # Incentive batch creation & approval
│   │   │   ├── schemes/   # Commission scheme management
│   │   │   ├── adjustments/  # Financial adjustments
│   │   │   ├── reports/   # Reporting data
│   │   │   ├── quotas/    # Quota management
│   │   │   ├── audit/     # Audit log
│   │   │   ├── notifications/ # Notification feed
│   │   │   ├── dashboard/ # Dashboard summary stats
│   │   │   ├── email-template/ # Email template preview
│   │   │   └── debug/     # Debug / seeding utilities
│   │   └── dashboard/     # Protected dashboard pages
│   │       ├── page.tsx   # Main dashboard (charts, KPIs)
│   │       ├── layout.tsx # Sidebar + header layout
│   │       ├── sales/     # Sales pipeline page
│   │       ├── batches/   # Incentive settlements page
│   │       ├── schemes/   # Commission rules page
│   │       ├── users/     # Team management page
│   │       ├── reports/   # Analytics & exports page
│   │       ├── adjustments/ # Financial adjustments page
│   │       ├── audit/     # System audit log page
│   │       └── notifications/ # Notification center
│   ├── components/
│   │   ├── date-range-picker.tsx
│   │   └── ui/            # 55 shadcn/ui + custom components
│   ├── lib/
│   │   ├── db.ts          # Supabase RPC database client
│   │   ├── auth.ts        # JWT sign/verify/session helpers
│   │   ├── auth-context.tsx  # React auth context (client)
│   │   ├── email.ts       # Email sending (all templates)
│   │   ├── export-utils.ts   # CSV, Excel, PDF export helpers
│   │   ├── migrate.ts     # DB migration script
│   │   ├── hybrid-sync.ts # Supabase ↔ SQLite hybrid sync
│   │   └── final-sync.ts  # Final sync utility
│   ├── hooks/             # Custom React hooks
│   └── types/             # TypeScript type definitions
├── electron/              # Electron main process
├── middleware.ts           # Edge auth middleware (Route protection)
├── ROLES_GUIDE.md         # Role & workflow documentation
├── DEPLOYMENT_CHECKLIST.md # Deployment steps
├── SEED_DEMO_DATA.sql     # Demo data seed script
├── FINAL_DEPLOYMENT_REPAIR.sql # Production DB initialization SQL
├── db-optimize.sql        # DB optimization indexes
└── package.json
```

---

## 4. User Roles & Workflow

The application enforces a **strict 4-tier approval pipeline** to maintain financial integrity.

### Roles

| Role | Code | Purpose |
|---|---|---|
| **Administrator** | `admin` | Final approver, user manager, system auditor |
| **Team Manager** | `manager` | Reviews deals, creates batches, manages schemes |
| **Accounts** | `accounts` | Processes approved payouts, marks batches as paid |
| **Salesperson** | `salesperson` | Logs sales, views personal earnings status |

### Role-Based Navigation Access

| Page | Admin | Manager | Accounts | Salesperson |
|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Settlements (Batches) | ✅ | ✅ | ✅ | ✅ |
| Sales Pipeline | ✅ | ✅ | ❌ | ✅ |
| Adjustments | ✅ | ✅ | ✅ | ❌ |
| Analytics / Reports | ✅ | ✅ | ✅ | ❌ |
| Team Management | ✅ | ✅ | ❌ | ❌ |
| Commission Rules | ✅ | ✅ | ❌ | ❌ |
| System Audit | ✅ | ❌ | ❌ | ❌ |

### The Approval Pipeline

```
1. [Sales / Manager] logs a deal → Status: Earned
        ↓
2. [Manager] groups deals into a Batch → "Submit for Approval" → Status: Pending Admin
        ↓
3. [Administrator] reviews and "Grants Final Approval"
        → Status: Approved
        → AUTOMATED EMAIL sent to all Salespeople in the batch
        → ACCOUNTS notified for disbursement
        ↓
4. [Accounts] processes payment → "Mark Paid" → Status: Paid
```

---

## 5. Database Layer

**Database:** Supabase (PostgreSQL)  
**Query Method:** Custom RPC function (`exec_sql`) — all SQL is executed via this RPC.

This approach is used to maintain compatibility between the web (Supabase) and the local SQLite (Electron) environments, and to work around Vercel serverless connection limits.

### Database Client (`src/lib/db.ts`)

The `db` object exposes a SQLite-like API:
```typescript
db.prepare(sql).all(...params)  // Returns array of rows
db.prepare(sql).get(...params)  // Returns first row or null
db.prepare(sql).run(...params)  // Executes mutation, returns { lastInsertRowid }
```

Parameters are interpolated safely using a custom `escapeSqlParam()` function (handles `null`, `boolean`, `number`, `Date`, `string`).

### Key Tables (inferred from API routes)

| Table | Description |
|---|---|
| `users` | All users with roles and status |
| `roles` | Role definitions (1–4) |
| `sales` | Individual sales / deal log entries |
| `batches` | Incentive payment batches |
| `batch_items` | Individual entries within a batch |
| `schemes` | Commission rule definitions |
| `adjustments` | Manual financial adjustments |
| `audit_logs` | System-wide activity audit trail |
| `quotas` | Sales quotas per user/period |
| `notifications` | In-app notification records |

---

## 6. Authentication & Security

- **JWT-based** sessions (signed with HS256, 8-hour expiry)
- Session stored in an HTTP-only cookie named `token`
- **Middleware** (`middleware.ts`) enforces authentication at the Edge:
  - All `/api/*` routes (except login, signup, reset) are protected
  - All `/dashboard/*` routes are protected
  - Unauthenticated requests are redirected to `/`
- **RBAC** enforced at both the API route level (via `authenticate(requiredRoles)`) and UI level (navigation items filtered by role)
- Passwords hashed with **bcryptjs**

---

## 7. Email System

**Library:** Nodemailer (SMTP/Gmail)  
**Fallback:** Resend API  
**Sender:** `IncentiveProincentive@gmail.com` (configurable via env)

### Email Templates

All emails use a branded HTML template system with two themes (`admin` / `general`):

| Function | Trigger | Recipient |
|---|---|---|
| `sendWelcomeEmail` | New user created by admin | New user |
| `sendAdminSignupNotification` | Self-registration | Admin |
| `sendUserStatusUpdate` | Admin approves/rejects user | User |
| `sendAdminUserUpdateNotification` | User profile changed | Admin |
| `sendAdminBatchSubmissionNotification` | Manager submits batch | Admin |
| `sendBatchApprovedEmail` | Admin approves batch | Each Salesperson |
| `sendBatchPaidEmail` | Accounts marks batch paid | Each Salesperson |
| `sendAccountsBatchNotification` | Admin approves batch | Accounts team |
| `sendIncentiveUpdate` | General incentive status change | User |
| `sendPasswordResetEmail` | Password reset requested | User |

---

## 8. Export / Reporting System

Available from the **Analytics** page (`/dashboard/reports`).

| Format | Library | Function |
|---|---|---|
| CSV | Native Blob API | `downloadCSV()` |
| Excel (`.xlsx`) | `xlsx` | `exportToExcel()` |
| PDF (modern) | `jsPDF` + `jspdf-autotable` | `exportToPDF()` |
| PDF (legacy print) | Native browser print | `downloadPDF()` |

All exports are timestamped (`filename_YYYY-MM-DD.ext`).

---

## 9. Dashboard Pages

| Page | Route | Description |
|---|---|---|
| **Dashboard** | `/dashboard` | KPI cards, charts (Recharts), recent activity |
| **Sales Pipeline** | `/dashboard/sales` | Log and manage sales deals, approve/reject |
| **Settlements** | `/dashboard/batches` | Create, submit, approve, and pay incentive batches |
| **Adjustments** | `/dashboard/adjustments` | Log financial adjustments (bonus/deduction) |
| **Analytics** | `/dashboard/reports` | Reports with filters, date range picker, exports |
| **Team Management** | `/dashboard/users` | Create/edit users, assign roles, approve signups |
| **Commission Rules** | `/dashboard/schemes` | Define incentive schemes (tiers, accelerators) |
| **System Audit** | `/dashboard/audit` | Full audit trail of all system actions |
| **Notifications** | `/dashboard/notifications` | In-app notification center |

---

## 10. API Routes

All routes live under `/api/`:

| Route Group | Endpoints |
|---|---|
| `auth/` | `login`, `signup`, `logout`, `me`, `reset-password`, `forgot-password` |
| `users/` | CRUD for users |
| `sales/` | Sales log CRUD, approval, bulk operations |
| `batches/` | Batch creation, submission, approval, mark paid |
| `schemes/` | Commission scheme CRUD |
| `adjustments/` | Financial adjustment CRUD |
| `reports/` | Aggregated report data |
| `quotas/` | Quota management |
| `audit/` | Audit log read |
| `notifications/` | Notification feed |
| `dashboard/` | Summary stats for dashboard page |
| `email-template/` | Preview email templates |
| `debug/` | Seed data, email check, DB diagnostics (admin only) |

---

## 11. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-only) |
| `DATABASE_URL` | Optional | Direct PostgreSQL URL (for migration scripts) |
| `JWT_SECRET` | ✅ | Min 32-char secret for JWT signing |
| `SMTP_HOST` | Optional | SMTP host (default: `smtp.gmail.com`) |
| `SMTP_PORT` | Optional | SMTP port (default: `465`) |
| `SMTP_USER` | Optional | SMTP username / email |
| `SMTP_PASS` | Optional | SMTP password / app password |
| `SMTP_FROM` | Optional | From address for sent emails |
| `RESEND_API_KEY` | Optional | Resend API key (alternative to SMTP) |
| `NEXT_PUBLIC_APP_URL` | ✅ | Base URL for email links |
| `NODE_ENV` | ✅ | `production` on Vercel |

---

## 12. Desktop App (Electron)

- **App ID:** `com.IncentivePro.IncentivePro`
- **Product Name:** IncentivePro
- **Publisher:** IncentivePro
- **Build Output:** `/dist/` (portable `.exe` for Windows)
- **Data Backup:** `Documents/IncentivePro/Backups` (local SQLite)
- **Sync:** The Electron app wraps the production Vercel URL and syncs with cloud via API
- **Build Command:** `npm run dist`

---

## 13. Key Scripts

| Script | Command | Description |
|---|---|---|
| Development server | `npm run dev` | Starts Next.js dev server |
| Production build | `npm run build` | Builds for Vercel deployment |
| Start production | `npm run start` | Runs built app |
| Lint | `npm run lint` | ESLint check |
| Electron (dev) | `npm run electron` | Opens Electron with local next server |
| Build desktop | `npm run dist` | Builds portable Windows EXE |

---

## 14. Deployment (Vercel)

1. Run `FINAL_DEPLOYMENT_REPAIR.sql` in the Supabase SQL Editor (creates tables, RPC, roles, indexes)
2. *(Optional)* Run `SEED_DEMO_DATA.sql` for demo users and transactions
3. Add all required environment variables in Vercel project settings
4. Verify domain is configured in Resend for email delivery
5. Deploy via Vercel
6. Verify by visiting `/api/debug/seed` and testing the full lifecycle: Scheme → Sale → Batch → Approval → Paid

---

## 15. Reference Numbers

All Incentive Batches and Financial Adjustments carry a unique **reference number** (`REF: xxxxx`) for traceability. These appear in:
- Batch approval emails
- Salesperson payout emails
- Accounts disbursement notifications
- CSV, Excel, and PDF exports
- Dashboard and audit views

---

## 16. Branding & UI Theme

| Token | Value |
|---|---|
| Primary color | Blue (`#3b82f6` / `blue-600`) |
| Admin accent | Slate (`#1e293b`) |
| Background | `#f8fafc` (slate-50) |
| Font | Inter (Google Fonts) |
| Border | `#e2e8f0` (slate-200) |
| Chart colors | Indigo, Cyan, Emerald, Amber |

UI uses **glassmorphism** and **Framer Motion** micro-animations. Sidebar is collapsible on desktop and drawer-based on mobile.

---

*This document was auto-generated on 2026-03-02. For the latest state, refer to the source code.*
