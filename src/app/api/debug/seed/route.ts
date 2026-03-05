import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });

    const session = await getSession();
    if (!session || session.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // 1. Create Managers
        await db.prepare(`
            INSERT INTO public.users (email, password_hash, full_name, role_id, department, is_active)
            VALUES 
            ('vikram.manager@payoutpower.corp', '$2b$10$7Z6oT5.Qp9BfT4p8T3p1u.Vn/p8wG9m5Yp/Q/U/X/Z/R/Z/p/p/p/', 'Vikram Singh', 2, 'North Region', TRUE),
            ('sarah.manager@payoutpower.corp', '$2b$10$7Z6oT5.Qp9BfT4p8T3p1u.Vn/p8wG9m5Yp/Q/U/X/Z/R/Z/p/p/p/', 'Sarah D''souza', 2, 'South Region', TRUE)
            ON CONFLICT (email) DO NOTHING
        `).run();

        // 2. Create Commission Schemes
        await db.prepare(`
            INSERT INTO public.incentive_schemes (name, description, calculation_type, base_rate, target_threshold, bonus_rate, status)
            VALUES 
            ('Alpha Standard', 'Standard 5% commission on all deals', 'percentage', 0.05, 0, 0, 'active'),
            ('Beta Tiered', '5% base, 8% above 5 Lakhs target', 'tier_based', 0.05, 500000, 0.08, 'active'),
            ('Gamma Per Unit', '₹500 per unit base, ₹750 above 50 units', 'quantity_threshold', 500, 50, 750, 'active')
            ON CONFLICT (name) DO NOTHING
        `).run();

        // 3. Create Salespeople (Assigned to Vikram)
        await db.prepare(`
            INSERT INTO public.users (email, password_hash, full_name, role_id, manager_id, department, is_active)
            VALUES 
            ('rahul.sales@payoutpower.corp', '$2b$10$7Z6oT5.Qp9BfT4p8T3p1u.Vn/p8wG9m5Yp/Q/U/X/Z/R/Z/p/p/p/', 'Rahul Mehta', 4, (SELECT id FROM public.users WHERE email='vikram.manager@payoutpower.corp'), 'Sales', TRUE),
            ('priya.sales@payoutpower.corp', '$2b$10$7Z6oT5.Qp9BfT4p8T3p1u.Vn/p8wG9m5Yp/Q/U/X/Z/R/Z/p/p/p/', 'Priya Sharma', 4, (SELECT id FROM public.users WHERE email='vikram.manager@payoutpower.corp'), 'Sales', TRUE)
            ON CONFLICT (email) DO NOTHING
        `).run();

        // 4. Create Salespeople (Assigned to Sarah)
        await db.prepare(`
            INSERT INTO public.users (email, password_hash, full_name, role_id, manager_id, department, is_active)
            VALUES 
            ('amit.sales@payoutpower.corp', '$2b$10$7Z6oT5.Qp9BfT4p8T3p1u.Vn/p8wG9m5Yp/Q/U/X/Z/R/Z/p/p/p/', 'Amit Verma', 4, (SELECT id FROM public.users WHERE email='sarah.manager@payoutpower.corp'), 'Field Sales', TRUE)
            ON CONFLICT (email) DO NOTHING
        `).run();

        // 5. Assign Schemes
        await db.prepare(`
            INSERT INTO public.user_scheme_assignments (user_id, scheme_id, start_date)
            SELECT u.id, s.id, CURRENT_DATE
            FROM public.users u, public.incentive_schemes s
            WHERE u.email = 'rahul.sales@payoutpower.corp' AND s.name = 'Alpha Standard'
            UNION ALL
            SELECT u.id, s.id, CURRENT_DATE
            FROM public.users u, public.incentive_schemes s
            WHERE u.email = 'priya.sales@payoutpower.corp' AND s.name = 'Beta Tiered'
            UNION ALL
            SELECT u.id, s.id, CURRENT_DATE
            FROM public.users u, public.incentive_schemes s
            WHERE u.email = 'amit.sales@payoutpower.corp' AND s.name = 'Gamma Per Unit'
        `).run();

        // 6. Seed Sales Logs
        await db.prepare(`
            INSERT INTO public.sales_logs (salesperson_id, client_name, deal_value, product, sale_date, scheme_id, calculated_commission, status)
            SELECT u.id, 'Global Corp', 100000, 'Cloud Suite', CURRENT_DATE - INTERVAL '5 days', (SELECT id FROM public.incentive_schemes WHERE name='Alpha Standard'), 5000, 'earned'
            FROM public.users u WHERE u.email = 'rahul.sales@payoutpower.corp'
        `).run();

        await db.prepare(`
            INSERT INTO public.sales_logs (salesperson_id, client_name, deal_value, product, sale_date, scheme_id, calculated_commission, status)
            SELECT u.id, 'Mega Tech', 800000, 'ERP Enterprise', CURRENT_DATE - INTERVAL '8 days', (SELECT id FROM public.incentive_schemes WHERE name='Beta Tiered'), 64000, 'earned'
            FROM public.users u WHERE u.email = 'priya.sales@payoutpower.corp'
        `).run();

        return NextResponse.json({ message: "Demo biosphere successfully initialized. Log in as vikram.manager@payoutpower.corp or any salesperson to begin." });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

