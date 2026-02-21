import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL!);

async function test() {
  try {
    const result = await sql`SELECT 1 as connected`;
    console.log('Successfully connected to Supabase!', result);
  } catch (err) {
    console.error('Connection failed:', err);
  } finally {
    process.exit(0);
  }
}
test();
