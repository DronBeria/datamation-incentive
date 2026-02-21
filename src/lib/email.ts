import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_123456789');

export async function sendIncentiveUpdate(to: string, userName: string, action: string, amount: number) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'PayoutPower Executive <notifications@payoutpower.corp>',
      to: [to],
      subject: `[PayoutPower] Protocol Update: ${action}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; background-color: #f8fafc; color: #1e293b; line-height: 1.6;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
            <!-- Industrial Header -->
            <div style="background: #0f172a; padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">PayoutPower</h1>
              <p style="color: #94a3b8; margin: 4px 0 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2em;">Industrial Incentive Suite</p>
            </div>

            <div style="padding: 40px;">
              <p style="margin: 0; font-size: 18px; font-weight: 700; color: #0f172a;">Hello, ${userName}</p>
              <p style="margin: 12px 0 0; color: #64748b; font-size: 15px;">Our automated tracking systems have logged a new administrative action regarding your incentive performance. Please review the transaction details below.</p>
              
              <!-- Transaction Summary -->
              <div style="background: #f1f5f9; border-radius: 16px; padding: 24px; margin: 32px 0; border: 1px solid #e2e8f0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 0 0 12px; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">Action Logged</td>
                    <td style="padding: 0 0 12px; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; text-align: right;">Impact Amount</td>
                  </tr>
                  <tr>
                    <td style="font-size: 15px; font-weight: 700; color: #0f172a;">${action}</td>
                    <td style="font-size: 20px; font-weight: 800; color: #4f46e5; text-align: right;">Rs. ${amount.toLocaleString()}</td>
                  </tr>
                </table>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="https://arcwebworks.in" style="display: inline-block; padding: 14px 32px; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 14px; box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.3);">Access Command Center</a>
              </div>

              <p style="margin: 0; font-size: 13px; color: #94a3b8; font-style: italic;">If you believe this action was logged in error, please contact your organizational administrator or the PayoutPower support desk.</p>
            </div>

            <!-- Professional Footer -->
            <div style="background: #f8fafc; padding: 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.15em;">Automated Security Dispatch</p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #64748b; font-weight: 500;">Sent via <strong style="color: #0f172a;">Arc WebWorks</strong> Industrial Cloud Node</p>
              <div style="margin: 24px 0 0; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 10px; color: #cbd5e1;">&copy; 2026 Arc WebWorks. All rights reserved. <br/> This communication is intended solely for the authenticated user and contains confidential personnel data. No action is required unless specified.</p>
              </div>
            </div>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error("Email failed:", error);
      return { success: false, error };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Email exception:", err);
    return { success: false, error: err };
  }
}
