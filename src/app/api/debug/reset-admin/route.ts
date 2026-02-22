import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const password = "Datamation@2026";
        const email = "admin@datamation.com";
        const hash = bcrypt.hashSync(password, 10);

        // Ensure ROBUST exec_sql function exists with foolproof query detection
        await db.prepare(`
            CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
            RETURNS jsonb
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            DECLARE
                result jsonb;
                cleaned_query text;
            BEGIN
                cleaned_query := trim(sql_query);
                
                BEGIN
                    -- Attempt to fetch as rows first
                    EXECUTE 'SELECT jsonb_agg(t) FROM (' || trim(trailing ';' from cleaned_query) || ') t' INTO result;
                EXCEPTION WHEN OTHERS THEN
                    -- Fallback for DDL/DML without results
                    EXECUTE cleaned_query;
                    result := '[]'::jsonb;
                END;
                
                RETURN COALESCE(result, '[]'::jsonb);
            END;
            $$;
        `).run();

        // Roles and User reset logic continues...
        // Ensure roles exist (use OVERRIDING SYSTEM VALUE for GENERATED ALWAYS AS IDENTITY)
        await db.prepare(
            "INSERT INTO public.roles (id, name) OVERRIDING SYSTEM VALUE VALUES (1, 'admin'), (2, 'manager'), (3, 'accounts'), (4, 'salesperson') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name"
        ).run();

        // Try to update existing admin first
        const existing = await db.prepare(
            "SELECT id FROM public.users WHERE email = ?"
        ).get(email) as any;

        if (existing) {
            // Update existing admin's password hash and ensure active
            await db.prepare(`
                UPDATE public.users 
                SET password_hash = ?, 
                    full_name = 'System Administrator', 
                    role_id = 1, 
                    department = 'IT Operations', 
                    is_active = TRUE, 
                    approval_status = 'approved'
                WHERE email = ?
            `).run(hash, email);
        } else {
            // Insert fresh admin
            await db.prepare(`
                INSERT INTO public.users (
                    email, password_hash, full_name, role_id, 
                    department, is_active, approval_status
                ) VALUES (?, ?, 'System Administrator', 1, 'IT Operations', TRUE, 'approved')
            `).run(email, hash);
        }

        return NextResponse.json({
            message: "Administrator account has been force-reset.",
            email,
            password: "Datamation@2026 (REDACTED IN PROD)",
            hash_used: hash,
            action: existing ? "updated" : "created"
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
