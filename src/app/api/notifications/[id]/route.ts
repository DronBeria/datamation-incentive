import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    );
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id } = await params;
        const supabase = getSupabase();

        // Verify ownership
        const { data: notif } = await supabase.from('notifications').select('user_id').eq('id', id).single();
        if (!notif || notif.user_id !== session.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { error } = await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("id", id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id } = await params;
        const supabase = getSupabase();

        // Verify ownership
        const { data: notif } = await supabase.from('notifications').select('user_id').eq('id', id).single();
        if (!notif || notif.user_id !== session.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { error } = await supabase
            .from("notifications")
            .delete()
            .eq("id", id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
