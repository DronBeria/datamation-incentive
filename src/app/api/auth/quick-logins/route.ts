import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        // Get one active user for each core role for the quick switch
        const results = await db.prepare(`
        WITH RankedUsers AS (
            SELECT 
                u.email, 
                LOWER(r.name) as label,
                ROW_NUMBER() OVER(PARTITION BY r.name ORDER BY u.created_at DESC) as rn
            FROM public.users u
            JOIN public.roles r ON u.role_id = r.id
            WHERE u.is_active = TRUE 
              AND u.approval_status = 'approved'
              AND LOWER(r.name) IN ('admin', 'manager', 'accounts')
        )
        SELECT email, label
        FROM RankedUsers
        WHERE rn = 1
        ORDER BY 
            CASE label 
                WHEN 'admin' THEN 1 
                WHEN 'manager' THEN 2 
                WHEN 'accounts' THEN 3 
                ELSE 4 
            END
    `).all();

        if (!results || results.length === 0) {
            // Fallback if DB is empty/reset
            return NextResponse.json([
                { label: "admin", email: "admin@datamation.com" },
                { label: "manager", email: "manager@datamation.com" }
            ]);
        }

        return NextResponse.json(results);
    } catch (error) {
        return NextResponse.json([
            { label: "admin", email: "admin@datamation.com" },
            { label: "manager", email: "manager@datamation.com" }
        ]);
    }
}
