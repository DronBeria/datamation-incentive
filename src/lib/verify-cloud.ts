import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log('🔍 Verifying Supabase connection for:', supabaseUrl);

    // Try to fetch roles (assuming they were created)
    const { data, error } = await supabase.from('roles').select('count', { count: 'exact' });

    if (error) {
        if (error.message.includes('relation "roles" does not exist')) {
            console.log('✅ Connection Successful, but the "roles" table is missing.');
            console.log('👉 Please go to Supabase -> SQL Editor and run the table creation script I provided.');
        } else {
            console.error('❌ Connection Error:', error.message);
        }
    } else {
        console.log('✅ Connection Successful! Tables are verified.');
        console.log(`📊 Number of rows in 'roles': ${data?.[0]?.count ?? 0}`);
    }
}

verify();
