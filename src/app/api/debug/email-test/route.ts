import { NextRequest, NextResponse } from "next/server";
import { sendWelcomeEmail, sendIncentiveUpdate, sendBatchApprovedEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });

    const targetTo = req.nextUrl.searchParams.get("to") || "delivered@resend.dev";
    const template = req.nextUrl.searchParams.get("template") || "welcome";

    try {
        let result;

        switch (template) {
            case "welcome":
                result = await sendWelcomeEmail(targetTo, "Test User", "TempP@ss123");
                break;
            case "incentive":
                result = await sendIncentiveUpdate(targetTo, "Test User", "A performance bonus has been applied", 25000);
                break;
            case "batch_approved":
                result = await sendBatchApprovedEmail(targetTo, "Test User", "Feb-2026 Batch", 75000);
                break;
            default:
                return NextResponse.json({ error: `Unknown template: ${template}. Use: welcome, incentive, batch_approved` }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            template,
            to: targetTo,
            provider: "Resend",
            result,
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 });
    }
}

