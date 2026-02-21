import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: 'require'
});

async function test() {
  console.log('📡 Testing direct DATABASE_URL connection...');
  try {
    const result = await sql`SELECT current_database(), now()`;
    console.log('✅ DATABASE_URL Connection Successful!');
    console.log('Result:', result);
  } catch (err: any) {
    console.error('❌ Connection Failed:', err.message);
    if (err.message.includes('Tenant or user not found')) {
      console.log('💡 TIP: The Supabase pooler is rejecting the project ID. Try using the Direct Connection string (port 5432) from your dashboard Settings > Database.');
    }
  } finally {
    process.exit(0);
  }
}
test();
