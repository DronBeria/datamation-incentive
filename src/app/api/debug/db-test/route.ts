import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        // Test 1: Can we reach Supabase at all?
        const { data: healthData, error: healthError } = await supabase
            .from("roles")
            .select("id, name")
            .limit(10);

        // Test 2: Does exec_sql RPC exist and work?
        const { data: rpcData, error: rpcError } = await supabase.rpc("exec_sql", {
            sql_query: "SELECT id, email, full_name, role_id, is_active, approval_status FROM users LIMIT 5",
        });

        // Test 3: Try the exact users query that the dashboard uses
        const usersQuery = `
            SELECT 
                u.id, u.email, u.full_name, u.department, u.is_active, u.approval_status, u.created_at, u.manager_id,
                r.name as role,
                sch.name as scheme_name,
                m.full_name as manager_name
            FROM users u 
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN users m ON u.manager_id = m.id
            LEFT JOIN user_scheme_assignments usa ON u.id = usa.user_id AND (usa.end_date IS NULL OR usa.end_date >= CURRENT_DATE)
            LEFT JOIN incentive_schemes sch ON usa.scheme_id = sch.id
            ORDER BY u.id
        `;
        const { data: usersData, error: usersError } = await supabase.rpc("exec_sql", {
            sql_query: usersQuery.trim(),
        });

        // Parse rpc results
        let parsedRpc: any = rpcData;
        if (Array.isArray(rpcData) && rpcData.length > 0 && rpcData[0] && "exec_sql" in rpcData[0]) {
            parsedRpc = rpcData[0].exec_sql;
        }

        let parsedUsers: any = usersData;
        if (Array.isArray(usersData) && usersData.length > 0 && usersData[0] && "exec_sql" in usersData[0]) {
            parsedUsers = usersData[0].exec_sql;
        }

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            test1_direct_table: {
                success: !healthError,
                error: healthError?.message || null,
                data: healthData,
            },
            test2_rpc_simple: {
                success: !rpcError,
                error: rpcError?.message || null,
                rawType: typeof rpcData,
                isArray: Array.isArray(rpcData),
                rawLength: Array.isArray(rpcData) ? rpcData.length : null,
                rawFirstKeys: rpcData && typeof rpcData === "object" ? Object.keys(Array.isArray(rpcData) && rpcData[0] ? rpcData[0] : rpcData) : null,
                parsed: parsedRpc,
            },
            test3_users_join: {
                success: !usersError,
                error: usersError?.message || null,
                rawType: typeof usersData,
                isArray: Array.isArray(usersData),
                parsed: parsedUsers,
                count: Array.isArray(parsedUsers) ? parsedUsers.length : null,
            },
            env: {
                SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
                SERVICE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
                SERVICE_KEY_PREFIX: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + "...",
            },
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack?.substring(0, 500),
        }, { status: 500 });
    }
}
