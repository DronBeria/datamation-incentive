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
                u.full_name,
                u.role_id,
                ROW_NUMBER() OVER(PARTITION BY u.role_id ORDER BY u.created_at DESC) as rn
            FROM public.users u
            WHERE u.is_active = TRUE 
              AND u.role_id IN (1, 2, 3)
        )
        SELECT 
            email, 
            full_name,
            CASE role_id 
                WHEN 1 THEN 'admin'
                WHEN 2 THEN 'manager'
                WHEN 3 THEN 'accounts'
            END as label
        FROM RankedUsers
        WHERE rn = 1
        ORDER BY role_id ASC
    `).all();

        if (!results || results.length === 0) {
            // Fallback if DB is empty/reset
            return NextResponse.json([
                { label: "admin", email: "admin@datamation.com", full_name: "Master Admin" },
                { label: "manager", email: "manager@datamation.com", full_name: "Regional Manager" }
            ]);
        }

        return NextResponse.json(results);
    } catch (error) {
        return NextResponse.json([
            { label: "admin", email: "admin@datamation.com", full_name: "Master Admin" },
            { label: "manager", email: "manager@datamation.com", full_name: "Regional Manager" }
        ]);
    }
}
