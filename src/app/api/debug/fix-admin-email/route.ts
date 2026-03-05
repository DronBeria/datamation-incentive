import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });

    try {
        // Verify admin users exist
        const admins = await db.prepare("SELECT id, email, full_name, is_active, approval_status FROM users WHERE role_id = 1").all() as any[];

        return NextResponse.json({
            success: true,
            message: "Admin accounts diagnostic",
            admins: admins.map((a: any) => ({
                id: a.id,
                email: a.email,
                name: a.full_name,
                active: a.is_active,
                status: a.approval_status,
            })),
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

