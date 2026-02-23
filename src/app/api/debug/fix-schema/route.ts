import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const results = [];

        // 1. Add notes column if missing
        const { error: errNotes } = await supabase.rpc('exec_sql', {
            sql_query: `
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_logs' AND column_name='notes') THEN
            ALTER TABLE public.sales_logs ADD COLUMN notes TEXT DEFAULT '';
          END IF;
        END $$;
      `
        });
        results.push({ action: 'add_notes', success: !errNotes, error: errNotes?.message });

        // 2. Add quantity column if missing
        const { error: errQty } = await supabase.rpc('exec_sql', {
            sql_query: `
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_logs' AND column_name='quantity') THEN
            ALTER TABLE public.sales_logs ADD COLUMN quantity NUMERIC DEFAULT 1;
          END IF;
        END $$;
      `
        });
        results.push({ action: 'add_quantity', success: !errQty, error: errQty?.message });

        // 3. Reload Schema Cache
        const { error: errReload } = await supabase.rpc('exec_sql', {
            sql_query: "NOTIFY pgrst, 'reload schema';"
        });
        results.push({ action: 'reload_schema', success: !errReload, error: errReload?.message });

        return NextResponse.json({
            message: "Schema repair sequence executed",
            results
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
