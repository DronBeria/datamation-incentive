import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function updateSchema() {
    console.log('🔄 Updating system to include "Pending Review" status for sales logs...');

    const sql = `
    -- 1. Update sales_logs status check constraint and add quantity
    ALTER TABLE sales_logs DROP CONSTRAINT IF EXISTS sales_logs_status_check;
    ALTER TABLE sales_logs ADD CONSTRAINT sales_logs_status_check 
      CHECK (status IN ('pending_review', 'earned', 'accrued', 'paid', 'rejected'));

    ALTER TABLE sales_logs ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 1;

    -- 2. Update default status for new logs
    ALTER TABLE sales_logs ALTER COLUMN status SET DEFAULT 'pending_review';

    -- 3. Ensure Manager ID field exists (for team logic)
    -- This was already in migrate.ts but good to be sure
    -- ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id BIGINT REFERENCES users(id);
  `;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('❌ Update Failed:', error.message);
    } else {
        console.log('✅ System status logic updated to "Manager Review" model.');
    }
}

updateSchema();
