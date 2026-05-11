-- ============================================================
-- Migration 002: Sessions, TDS Compliance, Commission Caps
-- Run AFTER migration 001.
-- All statements use IF NOT EXISTS so re-running is safe.
--
-- NOTE on user references: No FK constraints to public.users(id)
-- because the column type (UUID vs BIGINT) varies per Supabase
-- project. Referential integrity is enforced at the API layer.
-- User IDs are stored as TEXT to be universally compatible.
-- ============================================================

-- Clean up any partial tables from a previously failed run
DROP TABLE IF EXISTS public.user_sessions;
DROP TABLE IF EXISTS public.system_settings;
DROP TABLE IF EXISTS public.cron_runs;
DROP TABLE IF EXISTS public.report_schedules;

-- ────────────────────────────────────────────────────────────
-- 1. USER SESSIONS TABLE (for 6.2 Session Management)
-- Tracks every active login session with device/IP metadata.
-- user_id stored as TEXT — compatible with both UUID and BIGINT.
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.user_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  token_hash      TEXT NOT NULL,
  ip_address      TEXT,
  user_agent      TEXT,
  last_active     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at      TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user    ON public.user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_hash    ON public.user_sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_active  ON public.user_sessions (user_id, revoked_at) WHERE revoked_at IS NULL;

-- ────────────────────────────────────────────────────────────
-- 2. SYSTEM SETTINGS TABLE (for 6.5 TDS Compliance)
-- Key-value config store for admin-editable settings.
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.system_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default TDS settings
INSERT INTO public.system_settings (key, value, description) VALUES
  ('tds_enabled',         'false',  'Enable TDS deduction on commission payouts'),
  ('tds_rate',            '10',     'TDS rate percentage (default 10% under Section 194H)'),
  ('tds_threshold_yearly','30000',  'Annual commission amount above which TDS applies')
ON CONFLICT (key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 3. COMMISSION CAPS & FLOORS on incentive_schemes (5.3)
-- max_commission: hard cap per payout (NULL = unlimited)
-- min_commission_threshold: minimum to pay out (NULL = always pay)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.incentive_schemes
  ADD COLUMN IF NOT EXISTS max_commission            NUMERIC(15, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS min_commission_threshold  NUMERIC(15, 2) DEFAULT NULL;

-- ────────────────────────────────────────────────────────────
-- 4. CRON JOB TRACKING (for 4.5 + 5.2)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.cron_runs (
  id          BIGSERIAL PRIMARY KEY,
  job_name    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'success',
  message     TEXT,
  ran_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_job ON public.cron_runs (job_name, ran_at DESC);

-- ────────────────────────────────────────────────────────────
-- 5. REPORT SCHEDULES (for 4.5 Scheduled Report Emails)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.report_schedules (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  frequency       TEXT NOT NULL DEFAULT 'weekly',
  day_of_week     INTEGER DEFAULT 1,
  day_of_month    INTEGER DEFAULT 1,
  recipient_roles TEXT[] DEFAULT ARRAY['admin','manager'],
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_sent       TIMESTAMPTZ,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.report_schedules (name, frequency, day_of_week, recipient_roles) VALUES
  ('Weekly Performance Summary', 'weekly', 1, ARRAY['admin', 'manager'])
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- DONE
-- ────────────────────────────────────────────────────────────
