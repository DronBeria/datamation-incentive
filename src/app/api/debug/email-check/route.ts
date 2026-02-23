import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/lib/email";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const envCheck = {
        RESEND_API_KEY: !!process.env.RESEND_API_KEY,
        SMTP_FROM: !!process.env.SMTP_FROM,
        NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
        DATABASE_URL: !!process.env.DATABASE_URL,
    };

    try {
        // Check for admins who are supposed to receive these notifications
        const admins = await db.prepare("SELECT id, email, is_active FROM users WHERE role_id = 1").all() as any[];
        const activeAdmins = admins.filter((a: any) => a.is_active);

        const targetTo = req.nextUrl.searchParams.get("to") || "delivered@resend.dev";

        // Send test email via Resend
        const result = await sendMail({
            to: targetTo,
            subject: `PayoutPower Email Probe: ${new Date().toLocaleTimeString()}`,
            html: `<h3>Email System Verified</h3><p>Provider: Resend API</p><p>Target: ${targetTo}</p><p>Timestamp: ${new Date().toISOString()}</p>`,
        });

        return NextResponse.json({
            success: true,
            status: result.success ? "DISPATCHED" : "FAILED",
            messageId: result.messageId || null,
            error: result.error || null,
            provider: "Resend",
            admins: {
                total: admins.length,
                active: activeAdmins.length,
                list: admins.map((a: any) => ({ email: a.email, active: a.is_active })),
            },
            envCheck,
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack,
            envCheck,
        }, { status: 500 });
    }
}
