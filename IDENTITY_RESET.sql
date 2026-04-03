-- IncentivePro Master Identity Reset
-- Target Admin: admin@IncentivePro.com / IncentivePro@2026

BEGIN;

-- 1. DECOMMISSION ALL CURRENT USERS (EXCEPT ESSENTIALS IF ANY, BUT USER ASKED FOR WIPE)
-- We truncate with CASCADE to clear assignments, logs, etc. to ensure a clean slate
TRUNCATE public.users CASCADE;

-- 2. ENSURE ROLES ARE RE-INDEXED
INSERT INTO public.roles (id, name) OVERRIDING SYSTEM VALUE VALUES 
(1, 'admin'),
(2, 'manager'),
(3, 'accounts'),
(4, 'salesperson')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 3. INJECT MASTER ADMIN
-- Hash for 'IncentivePro@2026'
INSERT INTO public.users (email, password_hash, full_name, role_id, department, is_active, approval_status)
VALUES (
    'admin@IncentivePro.com', 
    '$2b$10$Gr85SkGsiqXEyxrrqwi3R.T.tr4SYal1g3PQKi96bxKrrSbIxpt2i', 
    'System Administrator', 
    1, 
    'IT Operations', 
    TRUE,
    'approved'
);

-- 4. ENSURE AUDIT LOG TABLE AND COLUMNS EXIST
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='approval_status') THEN
        ALTER TABLE public.users ADD COLUMN approval_status TEXT DEFAULT 'approved' CHECK(approval_status IN ('pending', 'approved', 'rejected'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='reset_token') THEN
        ALTER TABLE public.users ADD COLUMN reset_token TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='reset_token_expiry') THEN
        ALTER TABLE public.users ADD COLUMN reset_token_expiry TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='old_value') THEN
        ALTER TABLE public.audit_logs ADD COLUMN old_value TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='new_value') THEN
        ALTER TABLE public.audit_logs ADD COLUMN new_value TEXT;
    END IF;
END $$;

-- 5. VERIFICATION LOG
INSERT INTO public.audit_logs (action, entity_type, old_value, new_value)
VALUES ('SYSTEM_RESET', 'auth', 'ALL_USERS_PURGED', 'ADMIN_INITIALIZED_admin@IncentivePro.com');

COMMIT;
