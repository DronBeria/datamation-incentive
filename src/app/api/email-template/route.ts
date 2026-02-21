import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Incentive Approved</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">PayoutPower</h1>
                    <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">Incentive Management System</p>
                  </td>
                  <td align="right">
                    <span style="background-color:#059669;color:#ffffff;padding:6px 14px;border-radius:4px;font-size:12px;font-weight:600;">APPROVED</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 8px;color:#0f172a;font-size:18px;">Incentive Notification</h2>
              <p style="margin:0 0 24px;color:#64748b;font-size:14px;">Your incentive has been approved and sent for disbursement.</p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                          <span style="color:#64748b;font-size:13px;">Employee</span>
                        </td>
                        <td align="right" style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                          <strong style="color:#0f172a;font-size:13px;">{{employee_name}}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                          <span style="color:#64748b;font-size:13px;">Batch</span>
                        </td>
                        <td align="right" style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                          <strong style="color:#0f172a;font-size:13px;">{{batch_name}}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                          <span style="color:#64748b;font-size:13px;">Period</span>
                        </td>
                        <td align="right" style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                          <strong style="color:#0f172a;font-size:13px;">{{period}}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;">
                          <span style="color:#64748b;font-size:13px;">Incentive Amount</span>
                        </td>
                        <td align="right" style="padding:8px 0;">
                          <strong style="color:#059669;font-size:16px;">Rs. {{amount}}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:16px;">
                    <p style="margin:0;color:#166534;font-size:13px;">
                      <strong>Breakdown:</strong><br>
                      {{breakdown_items}}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="color:#64748b;font-size:13px;margin:0 0 24px;">
                Approved by <strong>{{approver_name}}</strong> on <strong>{{approved_date}}</strong>. 
                The amount has been forwarded to the Accounts department for processing.
              </p>

              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#0f172a;border-radius:6px;">
                    <a href="{{dashboard_url}}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">View Dashboard</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center;">
                This is an automated notification from PayoutPower IMS.<br>
                Please do not reply to this email. For queries, contact your manager or HR.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
