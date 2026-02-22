# PayoutPower Deployment Readiness Audit (Vercel Edition)

This document summarizes the current state of the architecture and identifies the critical steps for a production-grade deployment on Vercel.

## 🚀 Status: PRODUCTION READY
The engine is optimized for high-performance serverless execution. Follow these steps for a successful launch.

### 1. Database Initialization (FIRST STEP)
- [ ] **Run `FINAL_DEPLOYMENT_REPAIR.sql`**: Execute this entire script in your [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql). 
    - **Effect**: Creates all tables, fixes the `exec_sql` RPC function (essential for batch returns), seeds roles (1-4), and applies optimization indexes.
- [ ] **(Optional) Run `SEED_DEMO_DATA.sql`**: Run this if you want a pre-configured ecosystem of managers, salespeople, and sample transactions to test immediately.

### 2. Environment Variables (Vercel Dashboard)
Add these keys to your [Vercel Project Settings > Environment Variables](https://vercel.com):

| Key | Value / Source |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | From Supabase Project Settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Supabase Project Settings |
| `SUPABASE_SERVICE_ROLE_KEY` | **CRITICAL**: From Supabase Settings (Keep private) |
| `JWT_SECRET` | A random 32+ character string (e.g., `openssl rand -base64 32`) |
| `RESEND_API_KEY` | From [resend.com](https://resend.com) |
| `NODE_ENV` | Set to `production` (usually default on Vercel) |

### 3. Email Automation
- [ ] **Verify Domain**: Ensure your sending domain is verified in Resend.
- [ ] **Global Sender**: Update the `FROM` email address in `src/lib/email.ts` to match your verified domain if it differs from the default.

### 4. Technical Architecture Notes
- **Serverless Synergy**: The app uses Supabase RPC for database queries, which is highly resilient to connection pooling limits in Vercel's serverless functions.
- **Middleware Security**: Authentication is enforced at the edge via `jose` and `middleware.ts`. All `/api` routes (except login) and `/dashboard` pages are protected.
- **Hybrid Sync**: The local SQLite synchronization (via `better-sqlite3`) is automatically disabled when running on Vercel to prevent filesystem errors, and only activates in the Electron desktop environment.

### 5. Deployment Verification
1. Click **Deploy** on Vercel.
2. Visit the `/api/debug/seed` endpoint (once logged in as admin) or run the SQL script to ensure data is present.
3. Attempt to create a **Scheme**, then a **Sale**, then an **Incentive Batch** to verify the full financial lifecycle.

### 6. Desktop Distribution (EXE)
- [ ] **Verify Vercel URL**: Ensure `electron/main.js` points to your production domain (`datamation-incentive.vercel.app`).
- [ ] **Build Command**: Execute `npm run dist` from the project root.
- [ ] **Verification**: Find the portable installer in the `/dist` directory.
- [ ] **Data Sync Test**: Open the app and verify that data synchronizes with the cloud via Vercel.
- [ ] **Local Persistence**: Verify that local backups are created in `Documents/PayoutPower/Backups`.

---
**Handover Status**: All core features (Multi-manager, Scheme lifecycle, Batch transactions, and Industrial Electron wrapper) are complete and tested.
