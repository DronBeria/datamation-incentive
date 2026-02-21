import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixConstraints() {
    console.log('🔄 Fixing Database Constraints for Industrial Logic...');

    const sql = `
    -- 1. Update incentive_schemes calculation_type constraint
    ALTER TABLE incentive_schemes DROP CONSTRAINT IF EXISTS incentive_schemes_calculation_type_check;
    ALTER TABLE incentive_schemes ADD CONSTRAINT incentive_schemes_calculation_type_check 
      CHECK (calculation_type IN ('percentage', 'fixed_per_qty', 'tier_based', 'quantity_threshold'));

    -- 2. Ensure sales_logs has proper status constraint (just in case)
    ALTER TABLE sales_logs DROP CONSTRAINT IF EXISTS sales_logs_status_check;
    ALTER TABLE sales_logs ADD CONSTRAINT sales_logs_status_check 
      CHECK (status IN ('pending_review', 'earned', 'accrued', 'paid', 'rejected'));

    -- 3. Update roles to ensure proper seeding if missing
    INSERT INTO roles (name, description) VALUES 
      ('admin', 'Executive Command'),
      ('manager', 'Operations Nexus'),
      ('accounts', 'Treasury Operations'),
      ('salesperson', 'Performer')
    ON CONFLICT (name) DO NOTHING;
  `;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('❌ Constraint Fix Failed:', error.message);
    } else {
        console.log('✅ Industrial Constraints successfully updated.');
    }
}

fixConstraints();
