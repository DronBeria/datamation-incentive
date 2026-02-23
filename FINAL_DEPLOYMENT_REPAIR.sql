-- =========================================================
-- PAYOUTPOWER PRODUCTION FINAL REPAIR & OPTIMIZATION
-- Run this in Supabase Dashboard > SQL Editor
-- =========================================================

-- 1. FIX RPC EXECUTOR (Critical for Batch/Scheme returns)
CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
RETURNS jsonB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    cleaned_query text;
BEGIN
    cleaned_query := trim(trailing ';' from trim(sql_query));
    
    -- If it's a SELECT or has a RETURNING clause, we use the CTE approach to get results.
    IF lower(cleaned_query) ~ '^select' OR cleaned_query ilike '%returning%' THEN
        EXECUTE 'WITH result_set AS (' || cleaned_query || ') SELECT jsonb_agg(t) FROM result_set t' INTO result;
    ELSE
        EXECUTE cleaned_query;
        result := '[]'::jsonb;
    END IF;
    
    RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- 2. ENSURE CORE TABLES EXIST (In case migrations were skipped)
CREATE TABLE IF NOT EXISTS public.roles (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS public.users (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id BIGINT NOT NULL REFERENCES public.roles(id),
  manager_id BIGINT REFERENCES public.users(id),
  department TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  approval_status TEXT DEFAULT 'approved' CHECK(approval_status IN ('pending', 'approved', 'rejected')),
  reset_token TEXT,
  reset_token_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.incentive_schemes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  calculation_type TEXT NOT NULL CHECK(calculation_type IN ('percentage','fixed_per_qty','tier_based', 'quantity_threshold')),
  base_rate NUMERIC DEFAULT 0,
  target_threshold NUMERIC DEFAULT 0,
  bonus_rate NUMERIC DEFAULT 0,
  max_payable NUMERIC,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_scheme_assignments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT NOT NULL REFERENCES public.users(id),
  scheme_id BIGINT NOT NULL REFERENCES public.incentive_schemes(id),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sales_logs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  salesperson_id BIGINT NOT NULL REFERENCES public.users(id),
  client_name TEXT NOT NULL,
  deal_value NUMERIC NOT NULL,
  product TEXT DEFAULT '',
  sale_date DATE NOT NULL,
  scheme_id BIGINT REFERENCES public.incentive_schemes(id),
  calculated_commission NUMERIC DEFAULT 0,
  override_commission NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'earned' CHECK(status IN ('earned','accrued','paid', 'pending_review')),
  notes TEXT DEFAULT '',
  quantity NUMERIC DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT NOT NULL REFERENCES public.users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.incentive_batches (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  batch_name TEXT NOT NULL,
  created_by BIGINT NOT NULL REFERENCES public.users(id),
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','pending_approval','approved','paid','rejected')),
  total_amount NUMERIC DEFAULT 0,
  period_start DATE,
  period_end DATE,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by BIGINT REFERENCES public.users(id),
  paid_at TIMESTAMPTZ,
  paid_by BIGINT REFERENCES public.users(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.batch_items (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  batch_id BIGINT NOT NULL REFERENCES public.incentive_batches(id),
  salesperson_id BIGINT NOT NULL REFERENCES public.users(id),
  sales_log_id BIGINT REFERENCES public.sales_logs(id),
  amount NUMERIC NOT NULL,
  description TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.adjustments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  salesperson_id BIGINT NOT NULL REFERENCES public.users(id),
  amount NUMERIC NOT NULL,
  type TEXT CHECK(type IN ('bonus', 'clawback', 'correction')),
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'applied', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  applied_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT,
  old_value TEXT,
  new_value TEXT,
  ip_address TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='old_value') THEN
        ALTER TABLE public.audit_logs ADD COLUMN old_value TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='new_value') THEN
        ALTER TABLE public.audit_logs ADD COLUMN new_value TEXT;
    END IF;
END $$;

-- 3. ENSURE SYSTEM ROLES EXIST
INSERT INTO public.roles (id, name) OVERRIDING SYSTEM VALUE VALUES 
(1, 'admin'),
(2, 'manager'),
(3, 'accounts'),
(4, 'salesperson')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 4. INITIALIZE MASTER ADMIN
-- Hash for 'Datamation@2026'
INSERT INTO public.users (email, password_hash, full_name, role_id, department, is_active, approval_status)
VALUES (
    'admin@datamation.com', 
    '$2b$10$Gr85SkGsiqXEyxrrqwi3R.T.tr4SYal1g3PQKi96bxKrrSbIxpt2i', 
    'System Administrator', 
    1, 
    'IT Operations', 
    TRUE,
    'approved'
) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = TRUE, approval_status = 'approved';

-- 5. PRODUCTION INDEXES FOR DASHBOARD SPEED
CREATE INDEX IF NOT EXISTS idx_sales_logs_composite_status 
ON public.sales_logs (salesperson_id, status, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_incentive_batches_status_date 
ON public.incentive_batches (status, created_at DESC);

-- 5. CONSTRAINTS FOR DATA INTEGRITY
ALTER TABLE public.batch_items DROP CONSTRAINT IF EXISTS unique_sales_log_batch;

ANALYZE public.users;
ANALYZE public.sales_logs;
ANALYZE public.incentive_batches;
