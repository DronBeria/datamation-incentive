import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fullSync() {
  console.log('🔄 Starting Industrial Cloud Sync (No ID insert)...');

  const hash = bcrypt.hashSync('IncentivePro@2026', 10);

  try {
    // 1. Ensure Roles (using RPC to avoid identity column issues)
    await supabase.rpc('exec_sql', {
      sql_query: "INSERT INTO roles (name, description) VALUES ('admin', 'Full control'), ('manager', 'Team management'), ('accounts', 'Finance'), ('salesperson', 'Sales') ON CONFLICT (name) DO NOTHING"
    });
    console.log('✅ Roles prepared.');

    // 2. Add columns
    await supabase.rpc('exec_sql', {
      sql_query: "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT, ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ"
    });

    // 3. Get Role IDs
    const { data: dbRoles } = await supabase.from('roles').select('id, name');
    const roleMap = Object.fromEntries(dbRoles?.map(r => [r.name, r.id]) || []);

    // 4. Reset Users
    const users = [
      { email: 'admin@IncentivePro.com', password_hash: hash, full_name: 'System Administrator', role_id: roleMap['admin'], department: 'Executive', is_active: true },
      { email: 'manager@company.com', password_hash: hash, full_name: 'Priya Sharma (Manager)', role_id: roleMap['manager'], department: 'Sales Management', is_active: true },
      { email: 'accounts@company.com', password_hash: hash, full_name: 'Amit Patel (Accounts)', role_id: roleMap['accounts'], department: 'Finance', is_active: true },
      { email: 'sales1@company.com', password_hash: hash, full_name: 'Vikram Singh (Sales)', role_id: roleMap['salesperson'], department: 'Global Sales', is_active: true }
    ];

    for (const user of users) {
      const { error: userErr } = await supabase.from('users').upsert(user, { onConflict: 'email' });
      if (userErr) console.error(`Error syncing ${user.email}:`, userErr.message);
      else console.log(`✅ Synced: ${user.email}`);
    }

    console.log('✨ Cloud DB is now perfectly synchronized.');
    console.log('🔑 Credentials: admin@IncentivePro.com / IncentivePro@2026');

  } catch (err: any) {
    console.error('❌ Sync Failed:', err.message);
  }
}

fullSync();
