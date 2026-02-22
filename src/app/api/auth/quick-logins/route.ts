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
                r.name as role_name,
                ROW_NUMBER() OVER(PARTITION BY r.name ORDER BY u.created_at ASC) as rn
            FROM public.users u
            JOIN public.roles r ON u.role_id = r.id
            WHERE u.is_active = TRUE AND u.approval_status = 'approved'
        )
        SELECT email, role_name as label
        FROM RankedUsers
        WHERE rn = 1
        LIMIT 4
    `).all();

        if (!results || results.length === 0) {
            // Fallback if DB is empty/reset
            return NextResponse.json([
                { label: "Admin", email: "admin@datamation.com" }
            ]);
        }

        return NextResponse.json(results);
    } catch (error) {
        return NextResponse.json([{ label: "Admin", email: "admin@datamation.com" }]);
    }
}
