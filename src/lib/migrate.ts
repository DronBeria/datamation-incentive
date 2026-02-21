import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log('🚀 Starting Supabase Migration via API...');

  const sql = `
    -- Create roles table
    CREATE TABLE IF NOT EXISTS roles (
      id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    );

    -- Create users table
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role_id BIGINT NOT NULL REFERENCES roles(id),
      manager_id BIGINT REFERENCES users(id),
      department TEXT DEFAULT '',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create incentive_schemes table
    CREATE TABLE IF NOT EXISTS incentive_schemes (
      id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      calculation_type TEXT NOT NULL CHECK(calculation_type IN ('percentage','fixed_per_qty','tier_based')),
      base_rate NUMERIC DEFAULT 0,
      target_threshold NUMERIC DEFAULT 0,
      bonus_rate NUMERIC DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create user_scheme_assignments table
    CREATE TABLE IF NOT EXISTS user_scheme_assignments (
      id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      scheme_id BIGINT NOT NULL REFERENCES incentive_schemes(id),
      start_date DATE DEFAULT CURRENT_DATE,
      end_date DATE
    );

    -- Create sales_logs table
    CREATE TABLE IF NOT EXISTS sales_logs (
      id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      salesperson_id BIGINT NOT NULL REFERENCES users(id),
      client_name TEXT NOT NULL,
      deal_value NUMERIC NOT NULL,
      product TEXT DEFAULT '',
      sale_date DATE NOT NULL,
      scheme_id BIGINT REFERENCES incentive_schemes(id),
      calculated_commission NUMERIC DEFAULT 0,
      override_commission NUMERIC DEFAULT 0,
      status TEXT DEFAULT 'earned' CHECK(status IN ('earned','accrued','paid')),
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create incentive_batches table
    CREATE TABLE IF NOT EXISTS incentive_batches (
      id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      batch_name TEXT NOT NULL,
      created_by BIGINT NOT NULL REFERENCES users(id),
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','pending_approval','approved','paid','rejected')),
      total_amount NUMERIC DEFAULT 0,
      period_start DATE,
      period_end DATE,
      submitted_at TIMESTAMPTZ,
      approved_at TIMESTAMPTZ,
      approved_by BIGINT REFERENCES users(id),
      paid_at TIMESTAMPTZ,
      paid_by BIGINT REFERENCES users(id),
      rejection_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create batch_items table
    CREATE TABLE IF NOT EXISTS batch_items (
      id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      batch_id BIGINT NOT NULL REFERENCES incentive_batches(id),
      salesperson_id BIGINT NOT NULL REFERENCES users(id),
      sales_log_id BIGINT REFERENCES sales_logs(id),
      amount NUMERIC NOT NULL,
      description TEXT DEFAULT ''
    );

    -- Create audit_logs table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      user_id BIGINT REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id BIGINT,
      old_value TEXT,
      new_value TEXT,
      ip_address TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create notifications table
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      type TEXT DEFAULT 'info',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create quotas table
    CREATE TABLE IF NOT EXISTS quotas (
      id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      target_amount NUMERIC NOT NULL,
      period_month INTEGER NOT NULL CHECK(period_month BETWEEN 1 AND 12),
      period_year INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, period_month, period_year)
    );

    -- Create adjustments table
    CREATE TABLE IF NOT EXISTS adjustments (
      id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      salesperson_id BIGINT NOT NULL REFERENCES users(id),
      amount NUMERIC NOT NULL,
      reason TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('clawback', 'bonus', 'manual_adjustment')),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'applied')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      applied_at TIMESTAMPTZ
    );

    -- Create attachments table
    CREATE TABLE IF NOT EXISTS attachments (
      id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      sales_log_id BIGINT NOT NULL REFERENCES sales_logs(id),
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size BIGINT,
      uploaded_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Seed initial roles
    INSERT INTO roles (name, description) VALUES 
      ('admin', 'Full system control, user management, final approval'),
      ('manager', 'Team oversight, data validation, batch submission'),
      ('accounts', 'Read-only approved incentives, payment processing, tax reporting'),
      ('salesperson', 'Personal dashboard, sales entry, incentive tracking')
    ON CONFLICT (name) DO NOTHING;
  `;

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    if (error.message.includes('function "exec_sql" does not exist')) {
      console.error('❌ Error: Manual SQL execution is blocked by default in Supabase.');
      console.log('💡 TIP: Please go to the Supabase SQL Editor and paste the schema manually, OR use the DATABASE_URL connection I set up in .env');
    } else {
      console.error('❌ Migration Failed:', error);
    }
  } else {
    console.log('✅ Migration Successful!');
  }
}

migrate();
