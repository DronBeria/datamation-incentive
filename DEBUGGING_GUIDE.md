# IncentivePro IMS — Complete Software Debugging Guide
## End-to-End Feature Inventory & Verification Checklist

> **Purpose:** This document serves as the single source of truth for every feature and functionality in the IncentivePro Incentive Management System. Use it to systematically verify that every flow works correctly, identify any hallucinations or loose ends, and make the software industrial-ready before client delivery.

---

## TABLE OF CONTENTS
1. [System Architecture Overview](#1-system-architecture-overview)
2. [Authentication & Security](#2-authentication--security)
3. [Role-Based Access Control (RBAC)](#3-role-based-access-control-rbac)
4. [Landing Page / Login](#4-landing-page--login)
5. [Dashboard (Home)](#5-dashboard-home)
6. [User Management (Team Management)](#6-user-management-team-management)
7. [Sales Pipeline](#7-sales-pipeline)
8. [Commission Schemes](#8-commission-schemes)
9. [Settlements (Batch Management)](#9-settlements-batch-management)
10. [Adjustments](#10-adjustments)
11. [Analytics / Reports](#11-analytics--reports)
12. [Notifications](#12-notifications)
13. [System Audit](#13-system-audit)
14. [Email Notification System](#14-email-notification-system)
15. [Data Export System](#15-data-export-system)
16. [Middleware & Security Headers](#16-middleware--security-headers)
17. [Database Layer](#17-database-layer)
18. [Known Issues & Potential Loose Ends](#18-known-issues--potential-loose-ends)

---

## 1. SYSTEM ARCHITECTURE OVERVIEW

### Tech Stack
| Component | Technology |
|-----------|-----------|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS v4, Shadcn/UI, Framer Motion |
| **Backend** | Next.js API Routes (serverless) |
| **Database** | Supabase (PostgreSQL) via `exec_sql` RPC + Supabase Client |
| **Auth** | JWT (jose library), HttpOnly cookies, bcryptjs |
| **Email** | Nodemailer (Gmail SMTP) |
| **Charts** | Recharts |
| **Exports** | jsPDF, xlsx, file-saver |
| **Desktop** | Electron wrapper (optional) |

### Key Files Structure
```
src/
├── app/
│   ├── page.tsx                    → Landing page (Login/Signup/Forgot/Reset)
│   ├── layout.tsx                  → Root layout with AuthProvider
│   ├── template.tsx                → Page transition animations
│   ├── globals.css                 → Global CSS
│   ├── api/
│   │   ├── auth/                   → login, signup, logout, me, forgot-password, reset-password, quick-logins
│   │   ├── dashboard/              → Dashboard stats API (role-specific KPIs)
│   │   ├── users/                  → User CRUD
│   │   ├── sales/                  → Sales log CRUD + approve/reject
│   │   ├── schemes/                → Incentive scheme CRUD
│   │   ├── batches/                → Batch CRUD + state machine (submit/approve/reject/pay)
│   │   ├── adjustments/            → Manual adjustments CRUD
│   │   ├── notifications/          → Notifications CRUD
│   │   ├── reports/                → Analytics data API
│   │   ├── audit/                  → Audit log retrieval
│   │   ├── quotas/                 → Sales quota/target management
│   │   └── debug/                  → Debug/seed endpoints
│   └── dashboard/
│       ├── page.tsx                → Dashboard home
│       ├── layout.tsx              → Sidebar navigation + header
│       ├── users/page.tsx          → Team Management
│       ├── sales/page.tsx          → Sales Pipeline
│       ├── schemes/page.tsx        → Commission Rules
│       ├── batches/page.tsx        → Settlements/Batches
│       ├── adjustments/page.tsx    → Adjustments
│       ├── reports/page.tsx        → Analytics
│       ├── notifications/page.tsx  → Notifications center
│       └── audit/page.tsx          → System Audit log
├── lib/
│   ├── auth.ts                     → JWT sign/verify, getSession(), authenticate()
│   ├── auth-context.tsx            → React AuthProvider + useAuth hook
│   ├── db.ts                       → Database abstraction (exec_sql RPC wrapper)
│   ├── email.ts                    → Email templates + SMTP sender
│   ├── export-utils.ts             → CSV, Excel, PDF export utilities
│   ├── hybrid-sync.ts              → Electron local backup sync
│   └── utils.ts                    → cn() utility
├── components/
│   ├── ui/                         → 55 Shadcn/UI components
│   └── date-range-picker.tsx       → Date range picker component
└── types/
    └── lucide-react.d.ts           → Type declarations
middleware.ts                       → Route protection, RBAC, security headers
```

---

## 2. AUTHENTICATION & SECURITY

### 2.1 Login Flow
**API:** `POST /api/auth/login`
**File:** `src/app/api/auth/login/route.ts`

**Process:**
1. Validate email format and required fields
2. Rate limit check (10 attempts per IP per 15 minutes, in-memory Map)
3. Fetch user from DB with role join (`users JOIN roles`)
4. Check `is_active` — block deactivated accounts
5. Check `approval_status` — block pending/rejected accounts
6. Constant-time bcrypt comparison (timing attack prevention)
7. Sign JWT with payload: `{ id, email, full_name, role, role_id, department }`
8. Set HttpOnly, secure, SameSite cookie (8-hour expiry)
9. Update `last_login` timestamp
10. Create `LOGIN` audit log entry

**🔍 VERIFY:**
- [ ] Valid login redirects to `/dashboard`
- [ ] Invalid credentials show "Invalid email or password"
- [ ] Deactivated account shows "Access Denied" message
- [ ] Pending account shows "Waiting for admin approval"
- [ ] Rejected account shows "Access denied"
- [ ] Rate limit works after 10 failed attempts (returns 429)
- [ ] JWT cookie is HttpOnly (not accessible via JS)

### 2.2 Signup Flow
**API:** `POST /api/auth/signup`
**File:** `src/app/api/auth/signup/route.ts`

**Process:**
1. Validate email, password, full_name, role_id
2. Block admin self-signup (role_id === 1)
3. Check for duplicate email
4. Hash password with bcrypt
5. Create user as `is_active = FALSE`, `approval_status = 'pending'`
6. Create `SIGNUP_REQUEST` audit log
7. Send email notification to ALL active admins
8. Create in-dashboard notification for all admins

**🔍 VERIFY:**
- [ ] Signup creates user with pending status
- [ ] Cannot signup as admin
- [ ] Duplicate email returns 409
- [ ] Admin receives email + dashboard notification
- [ ] New user cannot login until approved

### 2.3 Password Reset Flow
**API:** `POST /api/auth/forgot-password` (request) + `PUT /api/auth/forgot-password` (confirm)
**File:** `src/app/api/auth/forgot-password/route.ts`

**Process:**
1. **Request:** Generate crypto token → store in DB with 1-hour expiry → email link
2. **Confirm:** Validate token + expiry → hash new password → clear token
3. Security: Does NOT reveal if email exists (returns same message either way)

**🔍 VERIFY:**
- [ ] Password reset email is sent
- [ ] Token expires after 1 hour
- [ ] Password reset link works with valid token
- [ ] Expired token shows error
- [ ] Audit log entry created

### 2.4 Session Management
**API:** `GET /api/auth/me`, `POST /api/auth/logout`
- `/me` returns current user from JWT cookie
- `/logout` clears the cookie

**🔍 VERIFY:**
- [ ] `/me` returns correct user data when logged in
- [ ] `/me` returns 401 when no cookie
- [ ] Logout clears cookie and redirects to landing

### 2.5 Quick Login (Development)
**API:** `GET /api/auth/quick-logins`
- Returns one user per role (admin, manager, accounts) for quick-switch buttons on login page

**🔍 VERIFY:**
- [ ] Quick login buttons appear on login page
- [ ] Clicking them fills the email field
- [ ] IMPORTANT: Consider disabling in production

---

## 3. ROLE-BASED ACCESS CONTROL (RBAC)

### Roles (DB: `roles` table)
| Role ID | Role Name | Access Level |
|---------|-----------|-------------|
| 1 | admin | Full system access |
| 2 | manager | Team management, sales, batches |
| 3 | accounts | Financial operations, batch payments |
| 4 | salesperson | Own sales and notifications |

### Middleware RBAC (`middleware.ts`)
Routes are protected by role at the middleware level:
| Route | Allowed Roles |
|-------|-------------|
| `/dashboard/users` | admin, manager |
| `/dashboard/audit` | admin |
| `/dashboard/schemes` | admin, manager |
| `/dashboard/reports` | admin, manager, accounts |
| `/dashboard/adjustments` | admin, manager, accounts |
| `/dashboard/*` (general) | Any authenticated user |

### Sidebar Navigation (`dashboard/layout.tsx`)
| Menu Item | Roles |
|-----------|-------|
| Dashboard | admin, manager, accounts, salesperson |
| Settlements | admin, manager, accounts, salesperson |
| Sales Pipeline | admin, manager, salesperson |
| Adjustments | admin, manager, accounts |
| Analytics | admin, manager, accounts |
| Team Management | admin, manager |
| Commission Rules | admin, manager |
| System Audit | admin |

**🔍 VERIFY:**
- [ ] Each role only sees their permitted menu items
- [ ] Direct URL access to unauthorized routes redirects to `/dashboard`
- [ ] API endpoints enforce role checks independently of UI

---

## 4. LANDING PAGE / LOGIN

**File:** `src/app/page.tsx`

### Features:
1. **Login Tab** — Email + password with validation
2. **Signup Tab** — Email, password, name, role selection, department
3. **Forgot Password Tab** — Email input → sends reset email
4. **Reset Password Tab** — Token + new password (accessed via email link)
5. **Quick Login Links** — Fetches from `/api/auth/quick-logins` for dev convenience
6. **Feature Showcase** — 4 feature cards (commission tracking, batch processing, RBAC, audit)

**🔍 VERIFY:**
- [ ] Login tab works with valid credentials
- [ ] Signup tab validates all required fields
- [ ] Role dropdown excludes "Admin" option
- [ ] Forgot password sends email (check spam folder)
- [ ] Reset password flow works end-to-end
- [ ] Authenticated users are auto-redirected to `/dashboard`
- [ ] UI is responsive on mobile

---

## 5. DASHBOARD (HOME)

**Files:** `src/app/dashboard/page.tsx` + `src/app/api/dashboard/route.ts`

### Role-Specific KPIs:

#### Admin Dashboard
| KPI | Source |
|-----|--------|
| Total Users | `COUNT(*) FROM users` |
| Active Users | `COUNT(*) FROM users WHERE is_active=TRUE` |
| Total Sales Revenue | `SUM(deal_value) FROM sales_logs` |
| Total Commissions | `SUM(calculated_commission) FROM sales_logs` |
| Pending Batches | `COUNT(*) FROM incentive_batches WHERE status='pending_approval'` |
| Total Accrued | `SUM(commission+override) WHERE status='accrued'` |
| Active Schemes | `COUNT(*) FROM incentive_schemes` |
| Pending Reviews | `COUNT(*) FROM sales_logs WHERE status='pending_review'` |
| Pending Users | `COUNT(*) FROM users WHERE approval_status='pending'` |
| Recent Audit | Last 5 audit log entries |

#### Manager Dashboard
| KPI | Source |
|-----|--------|
| Team Members | Users where `manager_id = current_user.id` |
| Active Members | Same, filtered `is_active=TRUE` |
| Team Sales | Sum of deal values for team members |
| Override Commissions | Sum of manager override commissions |
| Pending Batches | Batches created by manager with `status='pending_approval'` |
| Pending Reviews | Pending sales logs from team |

#### Accounts Dashboard
| KPI | Source |
|-----|--------|
| Approved for Payment | Batches with `status='approved'` |
| Approved Amount | Sum of approved batch amounts |
| Total Liability | Sum of accrued commissions |

#### Salesperson Dashboard
| KPI | Source |
|-----|--------|
| Active Scheme | Current scheme assignment |
| Total Sales | All-time sales |
| Earned Incentives | Commissions in 'earned' status |
| Accrued Incentives | Commissions in 'accrued' status |
| Paid Incentives | Commissions in 'paid' status |
| Target Progress | Monthly sales vs quota target |

**🔍 VERIFY:**
- [ ] Admin sees all KPI cards
- [ ] Manager sees team-specific KPIs
- [ ] Accounts sees financial KPIs
- [ ] Salesperson sees personal KPIs
- [ ] Performance chart renders with data
- [ ] Quick action links navigate correctly
- [ ] KPI numbers match actual database counts

---

## 6. USER MANAGEMENT (TEAM MANAGEMENT)

**Files:** `src/app/dashboard/users/page.tsx` + `src/app/api/users/route.ts`

### Features:
1. **All Users Tab** — Full user list with search, role filter, status filter
2. **Approval Queue Tab** — Users with `approval_status = 'pending'`
3. **Create User** — Admin/Manager can create new users directly (bypasses signup queue)
4. **Edit User** — Modify name, email, role, department, manager, scheme, password, status
5. **Approve/Reject** — From approval queue
6. **Deactivate** — Soft delete (admin only marks `is_active = false`)
7. **Permanent Purge** — Hard delete with full cascade (admin only, ID 1 protected)
8. **Scheme Assignment** — When approving salesperson, scheme assignment is mandatory

### API Endpoints:
| Method | Route | Description | Roles |
|--------|-------|-------------|-------|
| GET | `/api/users` | List users (filtered by role) | All |
| GET | `/api/users?role=salesperson` | All active salespersons (for dropdowns) | admin, manager, accounts |
| POST | `/api/users` | Create user | admin, manager |
| PUT | `/api/users` | Update user | admin, manager, accounts |
| DELETE | `/api/users?id=X` | Deactivate user | admin |
| DELETE | `/api/users?id=X&purge=true` | Permanently delete | admin |

### Purge Cascade Order:
1. `user_scheme_assignments` → delete
2. `notifications` → delete
3. `adjustments` → delete
4. `batch_items` → delete
5. `sales_logs` → delete
6. `incentive_batches` → reassign `created_by` to ID 1
7. `incentive_batches` → nullify `approved_by`/`paid_by`
8. `users` → nullify `manager_id` references
9. `audit_logs` → delete
10. `users` → delete

### Business Rules:
- **Salesperson approval requires scheme assignment** — If no scheme, prompt to assign one
- **Manager creates users with `approval_status = 'approved'`** — Bypasses queue
- **Welcome email sent** when admin/manager creates user directly
- **Status update email** sent when user is approved/rejected
- **Admin notification email** when non-admin modifies a user profile

**🔍 VERIFY:**
- [ ] Admin sees all users; Manager sees only their team
- [ ] Approval queue shows only pending users
- [ ] Approve salesperson without scheme → shows error
- [ ] Approve salesperson with scheme → activates user + creates assignment
- [ ] Create user sends welcome email
- [ ] Edit user saves all fields correctly
- [ ] Deactivate → user cannot login
- [ ] Purge → all related data is cleaned up
- [ ] Master admin (ID 1) cannot be purged
- [ ] Salesperson dropdown in sales page shows ALL salespersons (fixed)
- [ ] Role filter dropdown works
- [ ] Search by name/email works

---

## 7. SALES PIPELINE

**Files:** `src/app/dashboard/sales/page.tsx` + `src/app/api/sales/route.ts` + `src/app/api/sales/[id]/route.ts`

### Features:
1. **Log New Sale** — Form with client name, deal value, product, date, salesperson, scheme
2. **Sales Log Table** — Sortable, filterable list of all sales
3. **Commission Calculation** — Auto-calculated based on scheme rules
4. **Custom Commission** — Admin/Manager can override with custom amount
5. **Status Management** — pending_review → earned → accrued → paid
6. **Approve/Reject Sale** — Manager/Admin can approve or reject pending sales
7. **Delete Sale** — Admin/Manager (only if not paid/accrued)
8. **Reference Number** — Auto-generated: `YYYYMMDD_CN_PROD_SP`

### Commission Calculation Types:
| Type | Formula |
|------|---------|
| `percentage` | `deal_value × base_rate` |
| `tier_based` | If `deal_value >= threshold` → `value × bonus_rate` else `value × base_rate` |
| `fixed_per_qty` | `base_rate × quantity` |
| `quantity_threshold` | If `qty >= threshold` → `bonus_rate × qty` else `base_rate × qty` |
| **Fallback** | 5% of deal_value (no scheme assigned) |

### Manager Override Commission:
- If salesperson has a manager → 10% of calculated commission goes as override

### API Endpoints:
| Method | Route | Description | Roles |
|--------|-------|-------------|-------|
| GET | `/api/sales` | List sales (role-filtered) | All |
| POST | `/api/sales` | Create sale log | admin, manager, salesperson |
| PATCH | `/api/sales/[id]` | Approve/Reject sale | admin, manager |
| DELETE | `/api/sales/[id]` | Delete sale log | admin, manager |

### Sales Visibility Rules:
- **Salesperson** → only sees own sales
- **Manager** → sees team sales (salesperson_id IN team)
- **Admin** → sees all sales

**🔍 VERIFY:**
- [ ] Log sale form shows all salespersons in dropdown (FIXED)
- [ ] Commission auto-calculates based on assigned scheme
- [ ] Custom commission works for admin/manager
- [ ] Reference number is auto-generated correctly
- [ ] Salesperson sees only own sales
- [ ] Manager sees team sales
- [ ] Admin sees all sales
- [ ] Approve/reject changes status correctly
- [ ] Approve sends notification + email to salesperson
- [ ] Delete blocks for paid/accrued sales
- [ ] Sort by date, amount, status works
- [ ] Filter by status works
- [ ] Manager override commission (10%) is calculated
- [ ] Scheme dropdown only appears when not custom commission

---

## 8. COMMISSION SCHEMES

**Files:** `src/app/dashboard/schemes/page.tsx` + `src/app/api/schemes/route.ts` + `src/app/api/schemes/[id]/route.ts`

### Features:
1. **List Schemes** — All incentive schemes with visual type indicators
2. **Create Scheme** — Name, type, rates, thresholds
3. **Edit Scheme** — Update all fields
4. **Delete Scheme** — Hard delete if unused, soft archive if has historical sales
5. **Live Preview** — Shows commission example with ₹10K deal value
6. **Export** — Excel and PDF export

### Scheme Types (4 types):
| Type | Icon | Description |
|------|------|-------------|
| Percentage | % | Fixed percentage of deal value |
| Tier-Based | 📊 | Different rates based on deal value threshold |
| Fixed Per Qty | # | Fixed amount per unit sold |
| Quantity Threshold | 🎯 | Different per-unit rates based on quantity threshold |

### API Endpoints:
| Method | Route | Description | Roles |
|--------|-------|-------------|-------|
| GET | `/api/schemes` | List all schemes | admin, manager, accounts |
| POST | `/api/schemes` | Create scheme | admin, manager |
| PUT | `/api/schemes/[id]` | Update scheme | admin, manager |
| DELETE | `/api/schemes/[id]` | Delete/Archive scheme | admin only |

### Delete Safety:
1. If scheme is currently assigned → block deletion
2. If scheme has historical sales → archive (set `status = 'inactive'`)
3. Otherwise → hard delete

**🔍 VERIFY:**
- [ ] All 4 scheme types can be created
- [ ] Edit saves correctly
- [ ] Delete blocks when scheme is assigned
- [ ] Delete archives when has historical data
- [ ] Delete hard-removes when unused
- [ ] Live preview calculates correctly for each type
- [ ] Export to Excel works
- [ ] Export to PDF works
- [ ] Audit log entry created

---

## 9. SETTLEMENTS (BATCH MANAGEMENT)

**Files:** `src/app/dashboard/batches/page.tsx` + `src/app/api/batches/route.ts` + `src/app/api/batches/[id]/route.ts`

### Complete Lifecycle:
```
   [earned sales] → CREATE BATCH → [draft]
                                      ↓
                     SUBMIT → [pending_approval]
                                      ↓
                     APPROVE → [approved]  ← OR → REJECT → [draft]
                                      ↓
              MARK_PAID (full) → [paid]
              PAY_SELECTED (partial) → new [paid] batch created
```

### Features:
1. **Create Batch** — Select earned sales → name batch → create
2. **Submit Batch** — Manager/Admin submits for approval
3. **Approve Batch** — Admin approves (notifies salespersons + accounts)
4. **Reject Batch** — Admin rejects with reason (returns to draft)
5. **Mark Paid (Full)** — Accounts/Admin marks entire batch as paid
6. **Pay Selected (Partial)** — Accounts picks specific items → creates new paid batch
7. **Delete Batch** — Admin/Manager (only draft/pending, not approved/paid)
8. **List/Calendar View** — Toggle between list and calendar views
9. **Status Filter** — Filter by batch status
10. **Detail Modal** — Full batch details with item selection for payment
11. **Inline Actions** — Action buttons in expanded list view (ADDED)

### Batch Creation:
- Fetches sales logs with `status = 'earned'`
- Updates selected sales log status to `accrued`
- Creates `batch_items` linking sales to batch
- Auto-generates reference number

### Notification Chain:
| Action | Notification To |
|--------|----------------|
| Submit | Admin (email + dashboard) |
| Approve | Salespersons (email + dashboard) + Accounts (email + dashboard) |
| Reject | Creator (dashboard) |
| Mark Paid | Salespersons (email + dashboard) |
| Pay Selected | Salespersons (email + dashboard) |

### Visibility Rules:
- **Admin** → sees all batches
- **Manager** → sees batches they created
- **Accounts** → sees approved + paid batches only
- **Salesperson** → sees batches containing their items

**🔍 VERIFY:**
- [ ] Only 'earned' sales appear in batch creation
- [ ] Batch creation changes sales status to 'accrued'
- [ ] Submit changes status to 'pending_approval'
- [ ] Admin notification email sent on submit
- [ ] Approve changes status to 'approved'
- [ ] Approval sends email to each salesperson
- [ ] Approval sends email to all accounts users
- [ ] Reject returns batch to 'draft' with reason
- [ ] Mark Paid changes status to 'paid' + updates sales logs
- [ ] Pay Selected creates new paid batch + adjusts parent amount
- [ ] If parent batch fully paid after partial → parent also becomes 'paid'
- [ ] Delete only works on draft/pending batches
- [ ] Delete resets sales logs back to 'earned'
- [ ] Inline action buttons work in list view (ADDED)
- [ ] Detail modal shows all items
- [ ] Calendar view shows batches on correct dates
- [ ] Status filter works correctly
- [ ] Accounts can see "Process Payment" button

---

## 10. ADJUSTMENTS

**Files:** `src/app/dashboard/adjustments/page.tsx` + `src/app/api/adjustments/route.ts` + `src/app/api/adjustments/[id]/route.ts`

### Features:
1. **Create Adjustment** — Bonus or manual correction for any salesperson
2. **Status Management** — pending → applied | cancelled
3. **Reference Number** — Auto-generated: `ADJ_YYYYMMDD_TYPE_SP`
4. **Email Notification** — Salesperson notified when adjustment created
5. **Approve/Cancel** — Admin/Manager/Accounts can apply or cancel
6. **Export** — CSV, Excel, PDF

### Adjustment Types:
| Type | Display |
|------|---------|
| `bonus` | Performance Bonus (green) |
| `correction` | Manual Correction (amber) |

### Visibility:
- **Salesperson** → only sees own adjustments
- **Admin/Manager/Accounts** → sees all (optionally filtered by userId)

**🔍 VERIFY:**
- [ ] Create adjustment with valid data
- [ ] Reference number generated correctly
- [ ] Salesperson receives email notification
- [ ] Apply status change works
- [ ] Cancel status change works
- [ ] Audit log entries created
- [ ] Correct negative/positive display for amounts
- [ ] Export CSV works
- [ ] Export Excel works
- [ ] Export PDF works

---

## 11. ANALYTICS / REPORTS

**Files:** `src/app/dashboard/reports/page.tsx` + `src/app/api/reports/route.ts`

### Report Sections:
1. **Monthly Revenue Trend** — Area chart showing revenue + incentives per month
2. **Top Performers** — Ranked list by total sales value
3. **Batch Status Distribution** — Count and value per status
4. **Batch Aging** — Days pending for each batch
5. **Revenue Forecast** — Projects end-of-month based on daily rate

### Forecasting Logic:
```
projectedEOM = (currentMonthSales / dayOfMonth) * daysInMonth
confidence = dayOfMonth > 20 ? "High" : "Medium"
```

### Date Filtering:
- Optional `from` and `to` query parameters for date range

**🔍 VERIFY:**
- [ ] Monthly chart renders with real data
- [ ] Top performers list shows correct rankings
- [ ] Status distribution matches actual batch counts
- [ ] Aging shows correct day calculations
- [ ] Forecast calculation is reasonable
- [ ] Date range filter works
- [ ] Export CSV/Excel/PDF works for each section
- [ ] No data state shows empty/placeholder correctly

---

## 12. NOTIFICATIONS

**Files:** `src/app/dashboard/notifications/page.tsx` + `src/app/api/notifications/route.ts`

### Features:
1. **Notification Center** — List of all notifications for current user
2. **Mark All Read** — Bulk mark as read
3. **Type Icons** — Different icons/colors for action_required, success, info, warning, promo
4. **Bell Badge** — Unread count indicator in header
5. **Search/Filter** — Text search + read/unread filter

### Notification Types:
| Type | Trigger |
|------|---------|
| `action_required` | New signup request (admin) |
| `success` | Sale approved, Batch paid |
| `info` | Batch approved by admin, pending disbursement (accounts) |
| `error` | Sale rejected |

**🔍 VERIFY:**
- [ ] Notifications appear in real-time after actions
- [ ] Mark all read updates correctly
- [ ] Bell badge shows unread count
- [ ] Search filters notifications
- [ ] Correct icon/color for each type
- [ ] Export notifications works

---

## 13. SYSTEM AUDIT

**Files:** `src/app/dashboard/audit/page.tsx` + `src/app/api/audit/route.ts`

### Features:
1. **Audit Log Table** — All system actions with user, action, entity, old/new values
2. **Date Filter** — Filter by date range
3. **Search** — Text search across entries
4. **Pagination** — 25 entries per page
5. **Export** — CSV, Excel, PDF
6. **Admin Only** — Restricted to admin role

### Logged Actions:
| Action | Trigger |
|--------|---------|
| LOGIN | Successful login |
| LOGIN_FAILED | Failed login attempt |
| SIGNUP_REQUEST | New user registration |
| CREATE | Sale logged, batch created, scheme created, adjustment created |
| UPDATE | User profile updated |
| UPDATE_STATUS | Adjustment status changed |
| LOG_REVIEW | Sale approved/rejected |
| SUBMIT/APPROVE/REJECT | Batch state transitions |
| DELETE | Entity permanently deleted |
| PASSWORD_RESET | Password reset completed |

**🔍 VERIFY:**
- [ ] Only admin can access `/dashboard/audit`
- [ ] All actions are logged
- [ ] Old and new values are captured
- [ ] Date filter works
- [ ] Search works
- [ ] Pagination works
- [ ] Export works
- [ ] Login/logout actions are tracked

---

## 14. EMAIL NOTIFICATION SYSTEM

**File:** `src/lib/email.ts`

### Email Templates:
| Function | Trigger | To |
|----------|---------|------|
| `sendWelcomeEmail` | Admin creates user | New user |
| `sendAdminSignupNotification` | User self-registers | All admins |
| `sendAdminBatchSubmissionNotification` | Manager submits batch | All admins |
| `sendUserStatusUpdate` | User approved/rejected | User |
| `sendAdminUserUpdateNotification` | Non-admin updates user | All admins |
| `sendPasswordResetEmail` | Password reset request | User |
| `sendIncentiveUpdate` | Adjustment created / Sale approved | Salesperson |
| `sendBatchApprovedEmail` | Admin approves batch | Each salesperson in batch |
| `sendBatchPaidEmail` | Batch marked as paid | Each salesperson |
| `sendAccountsBatchNotification` | Batch approved | All accounts users |

### SMTP Configuration:
- Host: `smtp.gmail.com` (port 465, SSL)
- From: `IncentiveProincentive@gmail.com`
- App Password: Configured in `.env`

**🔍 VERIFY:**
- [ ] Login welcome email format is correct
- [ ] Signup notification reaches admin
- [ ] Batch approval email reaches salespersons
- [ ] Payment notification email reaches salespersons
- [ ] Accounts gets notified of approved batches
- [ ] Password reset email contains valid link
- [ ] All emails have correct branding (IncentivePro)
- [ ] Email fails gracefully (doesn't crash the action)

---

## 15. DATA EXPORT SYSTEM

**File:** `src/lib/export-utils.ts`

### Export Formats:
| Format | Library | File Type |
|--------|---------|-----------|
| CSV | Native (Blob) | `.csv` |
| Excel | xlsx | `.xlsx` |
| PDF | jsPDF + jspdf-autotable | `.pdf` |

### Available Exports per Page:
| Page | CSV | Excel | PDF |
|------|-----|-------|-----|
| Sales Pipeline | ✅ | ✅ | ✅ |
| Adjustments | ✅ | ✅ | ✅ |
| Schemes | ❌ | ✅ | ✅ |
| Reports | ✅ | ✅ | ✅ |
| Notifications | ✅ | ✅ | ✅ |
| Audit | ✅ | ✅ | ✅ |

**🔍 VERIFY:**
- [ ] CSV downloads correctly with proper encoding (UTF-8 BOM)
- [ ] Excel opens in Microsoft Excel without errors
- [ ] PDF has correct layout and data
- [ ] Empty data handles gracefully (no crash)
- [ ] Filenames include date stamp

---

## 16. MIDDLEWARE & SECURITY HEADERS

**File:** `middleware.ts`

### Security Headers Applied:
| Header | Value |
|--------|-------|
| `X-DNS-Prefetch-Control` | on |
| `X-Frame-Options` | DENY (clickjacking protection) |
| `X-Content-Type-Options` | nosniff |
| `Referrer-Policy` | strict-origin-when-cross-origin |
| `Permissions-Policy` | camera=(), microphone=(), geolocation=() |
| `Strict-Transport-Security` | max-age=63072000; includeSubDomains; preload |

### Route Protection:
1. Public routes: `/`, `/login`, `/_next/*`, `/favicon*`
2. Dashboard routes: JWT validation + role-based routing
3. API routes: JWT validation (except `/api/auth/*` and `/api/debug/*`)

### Authenticated User Redirect:
- If user has valid JWT and visits `/` or `/login` → redirected to `/dashboard`

**🔍 VERIFY:**
- [ ] Security headers present in all responses
- [ ] Unauthenticated access to `/dashboard` → redirect to `/`
- [ ] Expired JWT → cookie cleared, redirect to login
- [ ] API without auth → returns 401
- [ ] Debug endpoints are accessible without auth (⚠️ SECURITY: Consider restricting in production)

---

## 17. DATABASE LAYER

**File:** `src/lib/db.ts`

### Two Database Access Patterns:
1. **`db.prepare().all/get/run()`** — Uses `exec_sql` RPC (Supabase function for raw SQL)
2. **`supabase.from().select()`** — Uses Supabase client directly (type-safe queries)

### Tables (Primary):
| Table | Purpose |
|-------|---------|
| `users` | User accounts (id, email, password_hash, role_id, manager_id, is_active, approval_status, etc.) |
| `roles` | Role definitions (1=admin, 2=manager, 3=accounts, 4=salesperson) |
| `sales_logs` | Individual sale records with commission calculations |
| `incentive_schemes` | Commission calculation rules |
| `user_scheme_assignments` | Links users to schemes (with start/end dates) |
| `incentive_batches` | Payout batches for commission settlement |
| `batch_items` | Individual items within a batch |
| `adjustments` | Manual bonuses/corrections |
| `notifications` | In-app notification queue |
| `audit_logs` | System-wide action audit trail |
| `quotas` | Monthly sales targets per user |

### SQL Injection Safety:
- Parameters escaped via `escapeSqlParam()` — single quotes doubled
- Booleans, numbers, dates, nulls handled correctly
- `?` placeholders replaced with escaped values

**🔍 VERIFY:**
- [ ] All database queries work correctly
- [ ] No SQL injection via input fields
- [ ] `exec_sql` RPC function exists in Supabase
- [ ] All tables exist with correct schemas
- [ ] Foreign key constraints are in place

---

## 18. KNOWN ISSUES & POTENTIAL LOOSE ENDS

### ⚠️ THINGS TO FIX/VERIFY BEFORE CLIENT DELIVERY:

#### Security Concerns:
1. **`/api/debug/*` endpoints are unprotected** — These should be disabled or auth-protected in production
2. **Quick Login feature** — Consider removing quick-login buttons in production build
3. **JWT fallback secret** — Development fallback secret should NEVER be used in production
4. **`.env` contains real credentials** — Ensure `.env` is in `.gitignore` and never committed to public repos
5. **Rate limiter is in-memory** — Resets on server restart; consider Redis for production

#### Potential Bugs to Investigate:
6. **Dashboard MOCK_PERFORMANCE data** — The performance chart uses `MOCK_PERFORMANCE` hardcoded data (line 89-98 in `dashboard/page.tsx`). Should this be fetched from real data?
7. **Notifications: `markOneRead` and `deleteNotif`** — These functions exist in the UI but the API only has `GET` (all) and `PATCH` (mark all read). Individual notification update/delete API endpoints may be missing.
8. **Quotas page** — There's an API (`/api/quotas`) but no dedicated UI page for managing quotas. Quota targets are only shown in the salesperson dashboard.
9. **Sales attachments** — There's a file at `src/app/api/sales/[id]/attachments/route.ts` suggesting file attachment support, but this wasn't verified in the sales UI.
10. **`better-sqlite3` is in dependencies** — This package is listed but the app uses Supabase/PostgreSQL, not SQLite. This may be a leftover from an earlier architecture.
11. **`resend` package** — Listed in dependencies but the app uses nodemailer. May be unused.
12. **`postgres` package** — Listed in dependencies but `db.ts` uses Supabase RPC, not direct postgres connection.
13. **Debug endpoints (`/api/debug/*`)** — 6 debug files exist (fix-schema, reset-admin, seed, etc.). These should be removed before production.

#### UI/UX Improvements:
14. **Date range picker on sales page** — Verify it works and filters correctly
15. **Calendar view in batches** — Verify batch dates display correctly on calendar
16. **Responsive design** — Test on mobile (especially sidebar, tables, modals)
17. **Loading states** — All pages should show loaders during data fetch
18. **Error handling** — Toast notifications should appear for all failed operations
19. **Empty states** — All tables/lists should show meaningful "No data" messages

#### Data Integrity:
20. **Orphaned batch items** — If a sale is deleted while in a batch, what happens to the batch item?
21. **Scheme deletion while in use** — Verify the cascade logic
22. **Concurrent batch creation** — Can two managers batch the same sale simultaneously?
23. **Commission recalculation** — If a scheme is updated, do existing sales recalculate?

---

## DEBUGGING SESSION CHECKLIST

### Phase 1: Build & Basic Sanity
- [ ] `npm run build` — No TypeScript errors
- [ ] `npm run dev` — Server starts cleanly
- [ ] Landing page loads without errors
- [ ] Login with admin credentials
- [ ] All sidebar links navigate correctly

### Phase 2: Auth & RBAC
- [ ] Test login with each role (admin, manager, accounts, salesperson)
- [ ] Verify each role sees correct menu items
- [ ] Test direct URL access to restricted routes
- [ ] Test signup → approval queue → approve flow
- [ ] Test password reset flow

### Phase 3: Core Features (Admin)
- [ ] Create a new user (each role)
- [ ] Approve a pending user
- [ ] Create a commission scheme (each type)
- [ ] Log a sale with auto-commission
- [ ] Create a batch from earned sales
- [ ] Submit → Approve batch
- [ ] Create an adjustment
- [ ] Check audit logs

### Phase 4: Core Features (Manager)
- [ ] Log a sale for team member
- [ ] Verify salesperson dropdown shows all salespersons
- [ ] Create and submit a batch
- [ ] View team-only sales
- [ ] Create a scheme
- [ ] Edit team member profile

### Phase 5: Core Features (Accounts)
- [ ] View approved batches
- [ ] Process full payment
- [ ] Process partial payment
- [ ] Verify paid status updates
- [ ] Verify salesperson email notifications

### Phase 6: Core Features (Salesperson)
- [ ] Log own sale
- [ ] View only own sales
- [ ] View dashboard KPIs
- [ ] Check notifications
- [ ] View settlements containing own items

### Phase 7: Cross-Cutting
- [ ] Verify all email templates render correctly
- [ ] Test all exports (CSV, Excel, PDF)
- [ ] Test search and filters on every page
- [ ] Test sort functionality on tables
- [ ] Verify notifications appear after actions
- [ ] Check audit trail completeness
- [ ] Test responsive/mobile layout

### Phase 8: Edge Cases
- [ ] Delete a user with existing sales/batches
- [ ] Try to delete a paid batch
- [ ] Try to batch an already-accrued sale
- [ ] Login with wrong password 11 times (rate limit)
- [ ] Access API with expired token
- [ ] Create sale without scheme assigned

---

> **Document Version:** 1.0
> **Last Updated:** 2026-03-06
> **Generated for:** IncentivePro Group — IncentivePro IMS
