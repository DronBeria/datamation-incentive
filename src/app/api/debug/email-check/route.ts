import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const host = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
    const port = Number(process.env.SMTP_PORT) || 465;
    const user = (process.env.SMTP_USER || "datamationincentive@gmail.com").trim();
    const passRaw = process.env.SMTP_PASS || "";
    const passClean = passRaw.replace(/["']/g, "").replace(/\s/g, "").trim();

    const envCheck = {
        SMTP_HOST: !!process.env.SMTP_HOST,
        SMTP_PORT: !!process.env.SMTP_PORT,
        SMTP_USER: !!process.env.SMTP_USER,
        SMTP_PASS: !!process.env.SMTP_PASS,
        SMTP_FROM: !!process.env.SMTP_FROM,
        DATABASE_URL: !!process.env.DATABASE_URL
    };

    try {
        const { db } = require("@/lib/db");
        // Check for admins who are supposed to receive these notifications
        const admins = await db.prepare("SELECT id, email, is_active FROM public.users WHERE role_id = 1").all();
        const activeAdmins = admins.filter((a: any) => a.is_active);

        const transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass: passClean },
            connectionTimeout: 15000,
            greetingTimeout: 15000,
        });

        const verifyResult = await transporter.verify().catch(e => e.message);

        const targetTo = req.nextUrl.searchParams.get("to") || user;

        let mailSent = false;
        let mailId = null;
        let mailError = null;

        try {
            const info = await transporter.sendMail({
                from: `"PayoutPower Diagnostic" <${user}>`,
                to: targetTo,
                subject: `Hosted Probe: ${new Date().toLocaleTimeString()}`,
                html: `<h3>Connectivity Verified</h3><p>Gate: ${host}:${port}</p><p>Target: ${targetTo}</p>`
            });
            mailSent = true;
            mailId = info.messageId;
        } catch (e: any) {
            mailError = e.message;
        }

        return NextResponse.json({
            success: true,
            status: mailSent ? "DISPATCHED" : "FAILED",
            messageId: mailId,
            mailError,
            gateway: verifyResult === true ? "ONLINE" : verifyResult,
            admins: {
                total: admins.length,
                active: activeAdmins.length,
                list: admins.map((a: any) => ({ email: a.email, active: a.is_active }))
            },
            envCheck,
            config: {
                host,
                port,
                user,
                pass_length: passRaw.length,
                pass_clean_length: passClean.length
            }
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack,
            envCheck
        }, { status: 500 });
    }
}
