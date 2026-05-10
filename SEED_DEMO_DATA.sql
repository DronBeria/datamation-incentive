-- =========================================================
-- IncentivePro DEMO DATA PACK
-- Run this in Supabase Dashboard > SQL Editor
-- This will create managers, salespeople, schemes, and sales logs.
-- Passwords for all users is 'password123'
-- =========================================================

-- 1. Create Managers
INSERT INTO public.users (email, password_hash, full_name, role_id, department, is_active)
OVERRIDING SYSTEM VALUE
VALUES 
('vikram.manager@IncentivePro.corp', '$2b$10$7Z6oT5.Qp9BfT4p8T3p1u.Vn/p8wG9m5Yp/Q/U/X/Z/R/Z/p/p/p/', 'Vikram Singh', 2, 'North Region', TRUE),
('sarah.manager@IncentivePro.corp', '$2b$10$7Z6oT5.Qp9BfT4p8T3p1u.Vn/p8wG9m5Yp/Q/U/X/Z/R/Z/p/p/p/', 'Sarah D''souza', 2, 'South Region', TRUE)
ON CONFLICT (email) DO NOTHING;

-- 2. Create Commission Schemes
INSERT INTO public.incentive_schemes (name, description, calculation_type, base_rate, target_threshold, bonus_rate, status)
OVERRIDING SYSTEM VALUE
VALUES 
('Alpha Standard', 'Standard 5% commission on all deals', 'percentage', 0.05, 0, 0, 'active'),
('Beta Tiered', '5% base, 8% above 5 Lakhs target', 'tier_based', 0.05, 500000, 0.08, 'active'),
('Gamma Per Unit', '₹500 per unit base, ₹750 above 50 units', 'quantity_threshold', 500, 50, 750, 'active')
ON CONFLICT (name) DO NOTHING;

-- 3. Create Salespeople (Assigned to Vikram)
INSERT INTO public.users (email, password_hash, full_name, role_id, manager_id, department, is_active)
VALUES 
('rahul.sales@IncentivePro.corp', '$2b$10$7Z6oT5.Qp9BfT4p8T3p1u.Vn/p8wG9m5Yp/Q/U/X/Z/R/Z/p/p/p/', 'Rahul Mehta', 4, (SELECT id FROM public.users WHERE email='vikram.manager@IncentivePro.corp'), 'Sales', TRUE),
('priya.sales@IncentivePro.corp', '$2b$10$7Z6oT5.Qp9BfT4p8T3p1u.Vn/p8wG9m5Yp/Q/U/X/Z/R/Z/p/p/p/', 'Priya Sharma', 4, (SELECT id FROM public.users WHERE email='vikram.manager@IncentivePro.corp'), 'Sales', TRUE)
ON CONFLICT (email) DO NOTHING;

-- 4. Create Salespeople (Assigned to Sarah)
INSERT INTO public.users (email, password_hash, full_name, role_id, manager_id, department, is_active)
VALUES 
('amit.sales@IncentivePro.corp', '$2b$10$7Z6oT5.Qp9BfT4p8T3p1u.Vn/p8wG9m5Yp/Q/U/X/Z/R/Z/p/p/p/', 'Amit Verma', 4, (SELECT id FROM public.users WHERE email='sarah.manager@IncentivePro.corp'), 'Field Sales', TRUE)
ON CONFLICT (email) DO NOTHING;

-- 5. Assign Schemes
INSERT INTO public.user_scheme_assignments (user_id, scheme_id, start_date)
VALUES 
((SELECT id FROM public.users WHERE email='rahul.sales@IncentivePro.corp'), (SELECT id FROM public.incentive_schemes WHERE name='Alpha Standard'), CURRENT_DATE),
((SELECT id FROM public.users WHERE email='priya.sales@IncentivePro.corp'), (SELECT id FROM public.incentive_schemes WHERE name='Beta Tiered'), CURRENT_DATE),
((SELECT id FROM public.users WHERE email='amit.sales@IncentivePro.corp'), (SELECT id FROM public.incentive_schemes WHERE name='Gamma Per Unit'), CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- 6. Seed Sales Logs
-- Rahul's standard sales
INSERT INTO public.sales_logs (salesperson_id, client_name, deal_value, product, sale_date, scheme_id, calculated_commission, status)
VALUES 
((SELECT id FROM public.users WHERE email='rahul.sales@IncentivePro.corp'), 'Global Corp', 100000, 'Cloud Suite', CURRENT_DATE - INTERVAL '5 days', (SELECT id FROM public.incentive_schemes WHERE name='Alpha Standard'), 5000, 'earned'),
((SELECT id FROM public.users WHERE email='rahul.sales@IncentivePro.corp'), 'Nexus Ltd', 250000, 'Security Pack', CURRENT_DATE - INTERVAL '10 days', (SELECT id FROM public.incentive_schemes WHERE name='Alpha Standard'), 12500, 'earned');

-- Priya's tiered sales (One below threshold, one above)
INSERT INTO public.sales_logs (salesperson_id, client_name, deal_value, product, sale_date, scheme_id, calculated_commission, status)
VALUES 
((SELECT id FROM public.users WHERE email='priya.sales@IncentivePro.corp'), 'Small Biz Inc', 200000, 'ERP Basic', CURRENT_DATE - INTERVAL '3 days', (SELECT id FROM public.incentive_schemes WHERE name='Beta Tiered'), 10000, 'earned'),
((SELECT id FROM public.users WHERE email='priya.sales@IncentivePro.corp'), 'Mega Tech', 800000, 'ERP Enterprise', CURRENT_DATE - INTERVAL '8 days', (SELECT id FROM public.incentive_schemes WHERE name='Beta Tiered'), 64000, 'earned');

-- Amit's per unit sales
INSERT INTO public.sales_logs (salesperson_id, client_name, deal_value, product, sale_date, scheme_id, calculated_commission, status, quantity)
VALUES 
((SELECT id FROM public.users WHERE email='amit.sales@IncentivePro.corp'), 'Hardware Mart', 15000, 'Terminals', CURRENT_DATE - INTERVAL '12 days', (SELECT id FROM public.incentive_schemes WHERE name='Gamma Per Unit'), 10000, 'earned', 20);

-- 7. Analyze for stats
ANALYZE public.users;
ANALYZE public.sales_logs;
ANALYZE public.incentive_schemes;
