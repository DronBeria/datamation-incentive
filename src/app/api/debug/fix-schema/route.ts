import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });

  try {
    const results = [];

    // 1. Add notes column if missing
    const { error: errNotes } = await supabase.rpc('exec_sql', {
      sql_query: `
        DO $$ BEGIN
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
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_logs' AND column_name='quantity') THEN
            ALTER TABLE public.sales_logs ADD COLUMN quantity NUMERIC DEFAULT 1;
          END IF;
        END $$;
      `
    });
    results.push({ action: 'add_quantity', success: !errQty, error: errQty?.message });

    // 3. Add reference_number to sales_logs if missing
    const { error: errRef } = await supabase.rpc('exec_sql', {
      sql_query: `
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales_logs' AND column_name='reference_number') THEN
            ALTER TABLE public.sales_logs ADD COLUMN reference_number TEXT DEFAULT '';
          END IF;
        END $$;
      `
    });
    results.push({ action: 'add_sales_reference_number', success: !errRef, error: errRef?.message });

    // 4. Add rejection_reason to incentive_batches if missing
    const { error: errRej } = await supabase.rpc('exec_sql', {
      sql_query: `
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incentive_batches' AND column_name='rejection_reason') THEN
            ALTER TABLE public.incentive_batches ADD COLUMN rejection_reason TEXT DEFAULT '';
          END IF;
        END $$;
      `
    });
    results.push({ action: 'add_rejection_reason', success: !errRej, error: errRej?.message });

    // 5. Add reference_number to incentive_batches if missing
    const { error: errBatchRef } = await supabase.rpc('exec_sql', {
      sql_query: `
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incentive_batches' AND column_name='reference_number') THEN
            ALTER TABLE public.incentive_batches ADD COLUMN reference_number TEXT DEFAULT '';
          END IF;
        END $$;
      `
    });
    results.push({ action: 'add_batch_reference_number', success: !errBatchRef, error: errBatchRef?.message });

    // 6. Add reference_number to adjustments if missing
    const { error: errAdjRef } = await supabase.rpc('exec_sql', {
      sql_query: `
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='adjustments' AND column_name='reference_number') THEN
            ALTER TABLE public.adjustments ADD COLUMN reference_number TEXT DEFAULT '';
          END IF;
        END $$;
      `
    });
    results.push({ action: 'add_adj_reference_number', success: !errAdjRef, error: errAdjRef?.message });

    // 7. Add adjustment_id to batch_items if missing
    const { error: errBatchAdj } = await supabase.rpc('exec_sql', {
      sql_query: `
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='batch_items' AND column_name='adjustment_id') THEN
            ALTER TABLE public.batch_items ADD COLUMN adjustment_id INTEGER REFERENCES public.adjustments(id);
          END IF;
        END $$;
      `
    });
    results.push({ action: 'add_batch_adj_id', success: !errBatchAdj, error: errBatchAdj?.message });

    // 8. Add reset_token and reset_token_expiry to users if missing
    const { error: errReset } = await supabase.rpc('exec_sql', {
      sql_query: `
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='reset_token') THEN
            ALTER TABLE public.users ADD COLUMN reset_token TEXT DEFAULT NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='reset_token_expiry') THEN
            ALTER TABLE public.users ADD COLUMN reset_token_expiry TIMESTAMPTZ DEFAULT NULL;
          END IF;
        END $$;
      `
    });
    results.push({ action: 'add_reset_columns', success: !errReset, error: errReset?.message });

    // 9. Reload Schema Cache
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
