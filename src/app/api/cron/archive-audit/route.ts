import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateApiKey, unauthorizedApiResponse } from "@/lib/api-keys";
import fs from "fs";
import path from "path";

// Vercel Cron Jobs standard (can be called via GET)
export const dynamic = "force-dynamic";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );
}

export async function GET(request: Request) {
    // Validate cron secret (middleware also checks, this is defense-in-depth)
    if (process.env.NODE_ENV === "production" && !validateApiKey(request, "CRON_SECRET")) {
        return unauthorizedApiResponse("Unauthorized cron access");
    }

    try {
        const supabase = getSupabase();

        // 1. Identify logs older than 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const cutoffDate = sixMonthsAgo.toISOString();

        const { data: oldLogs, error: fetchErr } = await supabase
            .from("audit_logs")
            .select("*")
            .lt("created_at", cutoffDate);

        if (fetchErr) throw fetchErr;

        if (!oldLogs || oldLogs.length === 0) {
            return NextResponse.json({ message: "No old logs to archive." });
        }

        // 2. Archive to Cold Storage (Simulated via Local FS / Prepared for S3)
        // In a real S3 implementation, you'd use @aws-sdk/client-s3 here
        const tmpDir = path.join(process.cwd(), "tmp", "archives");
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const archiveFile = path.join(tmpDir, `audit_archive_${timestamp}.json`);

        fs.writeFileSync(archiveFile, JSON.stringify(oldLogs, null, 2));
        console.log(`[CRON] ${oldLogs.length} logs securely archived to ${archiveFile}`);

        // 3. Purge from PostgreSQL
        const logIds = oldLogs.map(l => l.id);

        // Supabase has a max deletion limit in one request, so chunk if necessary.
        // For safe execution, delete in batches of 1000
        for (let i = 0; i < logIds.length; i += 1000) {
            const chunk = logIds.slice(i, i + 1000);
            const { error: delErr } = await supabase
                .from("audit_logs")
                .delete()
                .in("id", chunk);

            if (delErr) {
                console.error("[CRON] Deletion chunk failed:", delErr);
                throw delErr;
            }
        }

        return NextResponse.json({
            message: "Archival process complete",
            archived_count: oldLogs.length,
            archive_path: archiveFile // In prod: s3://bucket-name/audit_archive_XXXX.json
        });

    } catch (error: any) {
        console.error("Archive Failed:", error);
        return NextResponse.json({ error: "Archival failed" }, { status: 500 });
    }
}
