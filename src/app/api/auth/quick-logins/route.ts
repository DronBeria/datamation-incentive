import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );
}

export async function GET() {

    try {
        const supabase = getSupabase();

        // Fetch core staff members (Admin, Manager, Accounts) with their role names
        // Alignment with the dashboard: 1=admin, 2=manager, 3=accounts
        const { data: users, error } = await supabase
            .from('users')
            .select(`
                email, 
                full_name, 
                role_id,
                roles!inner(name)
            `)
            .in('role_id', [1, 2, 3])
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Group by role_id to ensure we only have ONE (the latest) per role
        const staffMap: Record<number, any> = {};
        for (const u of (users || [])) {
            const roleName = (u as any).roles?.name;
            if (!staffMap[u.role_id] && roleName) {
                staffMap[u.role_id] = {
                    email: u.email,
                    full_name: u.full_name,
                    label: roleName // Use the actual role name from DB
                };
            }
        }

        const results = Object.values(staffMap).sort((a, b) => {
            const order: Record<string, number> = { 'admin': 1, 'manager': 2, 'accounts': 3 };
            return (order[a.label] || 0) - (order[b.label] || 0);
        });

        if (results.length === 0) {
            console.log("[QUICK_SWITCH] No live data found. Using fallbacks.");
            return NextResponse.json([
                { label: "admin", email: "admin@datamation.com", full_name: "Master Admin" },
                { label: "manager", email: "manager@datamation.com", full_name: "Regional Manager" }
            ]);
        }

        console.log("[QUICK_SWITCH] Synchronized with dashboard data:", results.length, "links created");
        return NextResponse.json(results);

    } catch (e: any) {
        console.error("[QUICK_SWITCH] Handshake Error:", e.message);
        return NextResponse.json([
            { label: "admin", email: "admin@datamation.com", full_name: "Master Admin" },
            { label: "manager", email: "manager@datamation.com", full_name: "Regional Manager" }
        ]);
    }
}
