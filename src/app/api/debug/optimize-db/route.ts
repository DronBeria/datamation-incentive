import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    // Security: Only allow in development or with a secret key
    const authHeader = req.headers.get("authorization");
    if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const results = [];

        const queries = [
            {
                name: "Performance Indexes",
                sql: `
          -- Sales Logs
          CREATE INDEX IF NOT EXISTS idx_sales_logs_salesperson_id ON public.sales_logs (salesperson_id);
          CREATE INDEX IF NOT EXISTS idx_sales_logs_status ON public.sales_logs (status);
          CREATE INDEX IF NOT EXISTS idx_sales_logs_sale_date ON public.sales_logs (sale_date DESC);
          CREATE INDEX IF NOT EXISTS idx_sales_logs_reference ON public.sales_logs (reference_number);
          
          -- Audit Logs
          CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
          CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON public.audit_logs (entity_type);
          CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
          
          -- Incentive Batches
          CREATE INDEX IF NOT EXISTS idx_batches_status ON public.incentive_batches (status);
          CREATE INDEX IF NOT EXISTS idx_batches_created_at ON public.incentive_batches (created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_batches_reference ON public.incentive_batches (reference_number);
          
          -- Notifications (High Volume)
          CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications (user_id, is_read);
          CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);
          
          -- Adjustments
          CREATE INDEX IF NOT EXISTS idx_adjustments_user_status ON public.adjustments (user_id, status);
          CREATE INDEX IF NOT EXISTS idx_adjustments_reference ON public.adjustments (reference_number);

          -- User assignments
          CREATE INDEX IF NOT EXISTS idx_user_scheme_assignments_user ON public.user_scheme_assignments (user_id);
          CREATE INDEX IF NOT EXISTS idx_user_scheme_assignments_active ON public.user_scheme_assignments (scheme_id) WHERE end_date IS NULL;
        `
            },
            {
                name: "Data Maintenance (Cleanup)",
                sql: `
          -- Delete read notifications older than 30 days
          DELETE FROM public.notifications 
          WHERE is_read = TRUE 
          AND created_at < NOW() - INTERVAL '30 days';

          -- Delete unread notifications older than 90 days (prevent bloat)
          DELETE FROM public.notifications 
          WHERE is_read = FALSE 
          AND created_at < NOW() - INTERVAL '90 days';
        `
            },
            {
                name: "Database Vacuum & Statistics",
                sql: `
          -- Update planner statistics
          ANALYZE public.sales_logs;
          ANALYZE public.audit_logs;
          ANALYZE public.incentive_batches;
          ANALYZE public.notifications;
          ANALYZE public.users;
        `
            }
        ];

        for (const q of queries) {
            const { error } = await supabase.rpc('exec_sql', { sql_query: q.sql });
            results.push({
                step: q.name,
                success: !error,
                error: error?.message || null
            });
        }

        return NextResponse.json({
            status: "Database optimization and long-term maintenance complete",
            timestamp: new Date().toISOString(),
            recommendations: [
                "Supabase Free Tier (500MB) can handle ~100k records comfortably.",
                "Retention policy applied: Read notifications cleared after 30 days.",
                "Indexes added for Sales, Batches, and Audit logs.",
                "Run this optimization monthly via Vercel Cron."
            ],
            results
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
