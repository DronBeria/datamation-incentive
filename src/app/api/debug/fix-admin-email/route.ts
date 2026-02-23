import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const targetEmail = process.env.SMTP_USER || "datamationincentive@gmail.com";
        await db.prepare("UPDATE public.users SET email = ? WHERE role_id = 1").run(targetEmail);

        const admins = await db.prepare("SELECT email FROM public.users WHERE role_id = 1").all();

        return NextResponse.json({
            success: true,
            message: "Admin emails synchronized with SMTP_USER",
            current_admins: admins
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
