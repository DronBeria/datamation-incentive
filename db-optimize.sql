-- =========================================================
-- IncentivePro IMS — Performance Indexes & Security Hardening
-- Run this in Supabase Dashboard > SQL Editor
-- =========================================================

-- ── USERS ──
CREATE INDEX IF NOT EXISTS idx_users_email_active 
  ON users(email, is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_users_role_id 
  ON users(role_id);

CREATE INDEX IF NOT EXISTS idx_users_reset_token 
  ON users(reset_token) WHERE reset_token IS NOT NULL;

-- ── SALES LOGS ──
CREATE INDEX IF NOT EXISTS idx_sales_user_id 
  ON sales_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_sales_status 
  ON sales_logs(status);

CREATE INDEX IF NOT EXISTS idx_sales_created_at 
  ON sales_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_user_status 
  ON sales_logs(user_id, status);

-- ── BATCHES ──
CREATE INDEX IF NOT EXISTS idx_batches_status 
  ON batches(status);

CREATE INDEX IF NOT EXISTS idx_batches_created_by 
  ON batches(created_by);

CREATE INDEX IF NOT EXISTS idx_batches_created_at 
  ON batches(created_at DESC);

-- ── BATCH ITEMS ──
CREATE INDEX IF NOT EXISTS idx_batch_items_batch_id 
  ON batch_items(batch_id);

CREATE INDEX IF NOT EXISTS idx_batch_items_log_id 
  ON batch_items(log_id);

-- ── AUDIT LOGS ──
CREATE INDEX IF NOT EXISTS idx_audit_user_id 
  ON audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_created_at 
  ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_action 
  ON audit_logs(action);

-- ── NOTIFICATIONS ──
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON notifications(user_id, is_read) WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
  ON notifications(created_at DESC);

-- ── Row Level Security ──
-- Enables RLS on sensitive tables. The service role key bypasses RLS,
-- so your API continues to work. This blocks direct anon access.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies (allows your API to function)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'service_role_all')
  THEN CREATE POLICY service_role_all ON users FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'service_role_all')
  THEN CREATE POLICY service_role_all ON audit_logs FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sales_logs' AND policyname = 'service_role_all')
  THEN CREATE POLICY service_role_all ON sales_logs FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'batches' AND policyname = 'service_role_all')
  THEN CREATE POLICY service_role_all ON batches FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;

-- Update query planner statistics
ANALYZE users;
ANALYZE sales_logs;
ANALYZE batches;
ANALYZE audit_logs;
ANALYZE notifications;
