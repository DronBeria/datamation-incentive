import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
    const { data: users, error } = await supabase.from('users').select('email, full_name, password_hash');
    if (error) console.error(error);
    else {
        console.log('Users found:', users.length);
        users.forEach(u => console.log(`- ${u.email}: ${u.full_name} (Hash: ${u.password_hash?.substring(0, 10)}...)`));
    }
}
check();
