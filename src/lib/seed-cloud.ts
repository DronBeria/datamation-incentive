import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seedAdmin() {
  console.log('🌱 Seeding Admin User...');

  const hash = bcrypt.hashSync('Datamation@2026', 10);

  const sql = `
    -- Ensure roles exist
    INSERT INTO roles (name, description) VALUES 
      ('admin', 'Full control'), ('manager', 'Team management'), 
      ('accounts', 'Finance'), ('salesperson', 'Sales')
    ON CONFLICT (name) DO NOTHING;

    -- Create/Update Admin
    DELETE FROM users WHERE email = 'admin@datamation.com';
    INSERT INTO users (email, password_hash, full_name, role_id) 
    SELECT 'admin@datamation.com', '${hash}', 'System Administrator', id 
    FROM roles WHERE name = 'admin';
  `;

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('❌ Seeding Failed:', error.message);
  } else {
    console.log('✅ Admin user created successfully!');
    console.log('📧 Login: admin@datamation.com');
    console.log('🔑 Password: Datamation@2026');
  }
}

seedAdmin();
