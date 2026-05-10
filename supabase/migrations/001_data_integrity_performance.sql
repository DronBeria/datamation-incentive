-- ============================================================
-- Migration 001: Data Integrity & Performance
-- Run this in the Supabase SQL editor BEFORE deploying the
-- corresponding code changes.
-- All statements use IF NOT EXISTS / IF EXISTS so re-running
-- is safe.
-- ============================================================

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
-- Wraps the entire batch creation in a single DB transaction:
-- insert batch → insert items → update sales_logs → update adjustments
-- Idempotency check is inside the transaction.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_incentive_batch(
  p_batch_name       TEXT,
  p_created_by       TEXT,          -- user id (uuid or int stored as text)
  p_status           TEXT,
  p_total_amount     NUMERIC,
  p_period_start     DATE,
  p_period_end       DATE,
  p_reference_number TEXT,
  p_idempotency_key  TEXT,
  p_submitted_at     TIMESTAMPTZ,
  p_approved_by      TEXT,
  p_approved_at      TIMESTAMPTZ,
  p_items            JSONB,          -- array of item objects
  p_log_ids          JSONB,          -- array of sales_log ids (integers)
  p_adj_ids          JSONB           -- array of adjustment ids (integers)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id    BIGINT;
  v_existing_id BIGINT;
  v_item        JSONB;
  v_log_id      BIGINT;
  v_adj_id      BIGINT;
BEGIN
  -- ── Idempotency guard ──────────────────────────────────────
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
      FROM incentive_batches
     WHERE idempotency_key = p_idempotency_key
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('id', v_existing_id, 'duplicate', true);
    END IF;
  END IF;

  -- ── Verify sales logs are still available ─────────────────
  IF jsonb_array_length(p_log_ids) > 0 THEN
    IF EXISTS (
      SELECT 1
        FROM sales_logs sl
       WHERE sl.id = ANY(
               SELECT (value::TEXT)::BIGINT
                 FROM jsonb_array_elements(p_log_ids)
             )
         AND (sl.status <> 'earned' OR sl.dispute_status = 'flagged')
    ) THEN
      RAISE EXCEPTION 'ITEMS_UNAVAILABLE: One or more commission items are no longer available for batching';
    END IF;
  END IF;

  -- ── Insert batch ───────────────────────────────────────────
  INSERT INTO incentive_batches (
    batch_name, created_by, status, total_amount,
    period_start, period_end, reference_number, idempotency_key,
    submitted_at, approved_by, approved_at
  )
  VALUES (
    p_batch_name,
    p_created_by::UUID,
    p_status,
    p_total_amount,
    p_period_start,
    p_period_end,
    p_reference_number,
    p_idempotency_key,
    p_submitted_at,
    CASE WHEN p_approved_by IS NOT NULL THEN p_approved_by::UUID ELSE NULL END,
    p_approved_at
  )
  RETURNING id INTO v_batch_id;

  -- ── Insert batch items ─────────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO batch_items (
      batch_id, salesperson_id, sales_log_id, adjustment_id, amount, description
    )
    VALUES (
      v_batch_id,
      (v_item->>'salesperson_id')::UUID,
      CASE WHEN v_item->>'sales_log_id' IS NOT NULL
           THEN (v_item->>'sales_log_id')::BIGINT ELSE NULL END,
      CASE WHEN v_item->>'adjustment_id' IS NOT NULL
           THEN (v_item->>'adjustment_id')::BIGINT ELSE NULL END,
      (v_item->>'amount')::NUMERIC,
      COALESCE(v_item->>'description', '')
    );
  END LOOP;

  -- ── Update sales log statuses → accrued ───────────────────
  IF jsonb_array_length(p_log_ids) > 0 THEN
    UPDATE sales_logs
       SET status = 'accrued', updated_at = NOW()
     WHERE id = ANY(
             SELECT (value::TEXT)::BIGINT
               FROM jsonb_array_elements(p_log_ids)
           );
  END IF;

  -- ── Update adjustment statuses → applied ──────────────────
  IF jsonb_array_length(p_adj_ids) > 0 THEN
    UPDATE adjustments
       SET status = 'applied', updated_at = NOW()
     WHERE id = ANY(
             SELECT (value::TEXT)::BIGINT
               FROM jsonb_array_elements(p_adj_ids)
           );
  END IF;

  RETURN jsonb_build_object('id', v_batch_id, 'duplicate', false);

EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise with context so the API route can return a proper error
    RAISE;
END;
$$;

-- Grant execute to service role (the key used by the API)
GRANT EXECUTE ON FUNCTION create_incentive_batch TO service_role;

-- ────────────────────────────────────────────────────────────
-- 7. QUOTA TABLE (for Priority 3 - Quota Management UI)
-- Create if it doesn't exist yet
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quotas (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  target_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_by    UUID REFERENCES public.users(id),
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
  uploaded_by  UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_sale ON public.sale_attachments (sales_log_id);

-- ────────────────────────────────────────────────────────────
-- DONE — confirm by querying:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'incentive_batches'
-- ORDER BY ordinal_position;
-- ────────────────────────────────────────────────────────────
