import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/lib/email";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const envCheck = {
        SMTP_USER: !!process.env.SMTP_USER,
        SMTP_PASS: !!process.env.SMTP_PASS,
        SMTP_HOST: !!process.env.SMTP_HOST,
        SMTP_FROM: !!process.env.SMTP_FROM,
        NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
    };

    try {
        // Check for admins who are supposed to receive these notifications
        const admins = await db.prepare("SELECT id, email, is_active FROM users WHERE role_id = 1").all() as any[];
        const activeAdmins = admins.filter((a: any) => a.is_active);

        const targetTo = req.nextUrl.searchParams.get("to") || "vibhaberia@gmail.com";

        // Send test email via SMTP
        const result = await sendMail({
            to: targetTo,
            subject: `PayoutPower SMTP Probe: ${new Date().toLocaleTimeString()}`,
            html: `<h3>Email System Verified</h3><p>Provider: SMTP (Gmail)</p><p>Target: ${targetTo}</p><p>Timestamp: ${new Date().toISOString()}</p>`,
        });

        return NextResponse.json({
            success: true,
            status: result.success ? "DISPATCHED" : "FAILED",
            messageId: result.messageId || null,
            error: result.error || null,
            provider: "SMTP",
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
