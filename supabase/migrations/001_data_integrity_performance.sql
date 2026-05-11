-- ============================================================
-- Migration 001: Data Integrity & Performance
-- Run this in the Supabase SQL editor BEFORE deploying the
-- corresponding code changes.
-- All statements use IF NOT EXISTS / IF EXISTS so re-running
-- is safe.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. ENSURE REQUIRED COLUMNS EXIST ON incentive_batches
-- These may or may not already exist depending on your schema
-- version. All are safe to run multiple times.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.incentive_batches
  ADD COLUMN IF NOT EXISTS period_start   DATE             DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS period_end     DATE             DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS submitted_at   TIMESTAMPTZ      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approved_by    BIGINT           DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approved_at    TIMESTAMPTZ      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS paid_at        TIMESTAMPTZ      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS paid_by        BIGINT           DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT           DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reference_number TEXT           DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ      DEFAULT NOW();

-- ────────────────────────────────────────────────────────────
-- 1. SOFT DELETES
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.incentive_batches
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.adjustments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ────────────────────────────────────────────────────────────
-- 2. OPTIMISTIC LOCKING (version counter)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.incentive_batches
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Auto-increment version on every UPDATE
CREATE OR REPLACE FUNCTION increment_batch_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_batch_version ON public.incentive_batches;
CREATE TRIGGER trg_batch_version
  BEFORE UPDATE ON public.incentive_batches
  FOR EACH ROW EXECUTE FUNCTION increment_batch_version();

-- ────────────────────────────────────────────────────────────
-- 3. IDEMPOTENCY KEY (prevents double-creation on retry)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.incentive_batches
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_batches_idempotency
  ON public.incentive_batches (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 4. AUDIT LOG TAMPER PROTECTION
-- Enable RLS and allow only INSERT + SELECT (no DELETE/UPDATE)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — only restrict the anon/authenticated roles
DROP POLICY IF EXISTS audit_allow_insert ON public.audit_logs;
CREATE POLICY audit_allow_insert ON public.audit_logs
  FOR INSERT TO authenticated, anon WITH CHECK (true);

DROP POLICY IF EXISTS audit_allow_select ON public.audit_logs;
CREATE POLICY audit_allow_select ON public.audit_logs
  FOR SELECT TO authenticated, anon USING (true);

-- No DELETE or UPDATE policy = those operations are blocked for non-service roles

-- ────────────────────────────────────────────────────────────
-- 5. PERFORMANCE INDEXES
-- ────────────────────────────────────────────────────────────

-- sales_logs
CREATE INDEX IF NOT EXISTS idx_sales_status       ON public.sales_logs (status);
CREATE INDEX IF NOT EXISTS idx_sales_salesperson  ON public.sales_logs (salesperson_id);
CREATE INDEX IF NOT EXISTS idx_sales_created      ON public.sales_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_date         ON public.sales_logs (sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_dispute      ON public.sales_logs (dispute_status) WHERE dispute_status IS NOT NULL;

-- incentive_batches
CREATE INDEX IF NOT EXISTS idx_batches_status     ON public.incentive_batches (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_batches_created_by ON public.incentive_batches (created_by);
CREATE INDEX IF NOT EXISTS idx_batches_created_at ON public.incentive_batches (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batches_not_deleted ON public.incentive_batches (deleted_at) WHERE deleted_at IS NULL;

-- batch_items
CREATE INDEX IF NOT EXISTS idx_batch_items_batch  ON public.batch_items (batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_sp     ON public.batch_items (salesperson_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_log    ON public.batch_items (sales_log_id) WHERE sales_log_id IS NOT NULL;

-- adjustments
CREATE INDEX IF NOT EXISTS idx_adj_status         ON public.adjustments (status);
CREATE INDEX IF NOT EXISTS idx_adj_user           ON public.adjustments (user_id);
CREATE INDEX IF NOT EXISTS idx_adj_created        ON public.adjustments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_adj_not_deleted    ON public.adjustments (deleted_at) WHERE deleted_at IS NULL;

-- notifications
CREATE INDEX IF NOT EXISTS idx_notif_user_read    ON public.notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notif_created      ON public.notifications (created_at DESC);

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_user         ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity       ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created      ON public.audit_logs (created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 6. ATOMIC BATCH CREATION STORED PROCEDURE
-- SKIPPED — column types (created_by, salesperson_id) vary per
-- Supabase project. The API has a full sequential fallback that
-- activates automatically when this function is absent (code 42883).
-- The idempotency key on incentive_batches (section 3) prevents
-- double-creation even without the stored procedure.
-- ────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────
-- 7. QUOTA TABLE (for Priority 3 - Quota Management UI)
-- Create if it doesn't exist yet
-- ────────────────────────────────────────────────────────────
-- NOTE: No FK to users(id) — users.id type varies across Supabase setups.
-- Referential integrity is enforced at the API layer.
CREATE TABLE IF NOT EXISTS public.quotas (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  target_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_quotas_user   ON public.quotas (user_id);
CREATE INDEX IF NOT EXISTS idx_quotas_period ON public.quotas (period_start, period_end);

-- ────────────────────────────────────────────────────────────
-- 8. SALE ATTACHMENTS TABLE (for Priority 3 - Attachments UI)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sale_attachments (
  id           BIGSERIAL PRIMARY KEY,
  sales_log_id BIGINT NOT NULL REFERENCES public.sales_logs(id) ON DELETE CASCADE,
  file_name    TEXT NOT NULL,
  file_url     TEXT NOT NULL,
  file_size    BIGINT DEFAULT 0,
  uploaded_by  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_sale ON public.sale_attachments (sales_log_id);

-- ────────────────────────────────────────────────────────────
-- DONE — confirm by querying:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'incentive_batches'
-- ORDER BY ordinal_position;
-- ────────────────────────────────────────────────────────────
