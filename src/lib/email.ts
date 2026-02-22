import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_123456789');

// INDUSTRIAL THEME COLORS
const COLORS = {
  primary: '#4f46e5',   // Indigo 600
  dark: '#0f172a',      // Slate 900
  slate: '#64748b',     // Slate 500
  border: '#e2e8f0',    // Slate 200
  bg: '#f8fafc',        // Slate 50
  emerald: '#10b981',   // Emerald 500
  amber: '#f59e0b',     // Amber 500
};

const BASE_TEMPLATE = (content: string, previewText: string) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>PayoutPower | Automated Security Dispatch</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px 20px; background-color: ${COLORS.bg}; color: ${COLORS.dark}; line-height: 1.6; margin: 0;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); border: 1px solid ${COLORS.border};">
        
        <!-- Header -->
        <div style="background: ${COLORS.dark}; padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">PayoutPower</h1>
            <p style="color: ${COLORS.slate}; margin: 4px 0 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2em;">Industrial Incentive Suite</p>
        </div>

        <div style="padding: 40px;">
            ${content}
        </div>

        <!-- Footer -->
        <div style="background: ${COLORS.bg}; padding: 32px; border-top: 1px solid ${COLORS.border}; text-align: center;">
            <p style="margin: 0; font-size: 11px; font-weight: 700; color: ${COLORS.slate}; text-transform: uppercase; letter-spacing: 0.15em;">Automated Security Dispatch</p>
            <p style="margin: 8px 0 0; font-size: 12px; color: ${COLORS.slate}; font-weight: 500;">Sent via <strong>Datamation Inc.</strong> Professional Cloud Node</p>
            <div style="margin: 24px 0 0; padding-top: 24px; border-top: 1px solid ${COLORS.border};">
                <p style="margin: 0; font-size: 10px; color: #cbd5e1;">&copy; 2026 Datamation Inc. All rights reserved. <br/> This communication is intended solely for the authenticated user and contains confidential personnel data.</p>
            </div>
        </div>
    </div>
</body>
</html>
`;

/**
 * 📊 INCENTIVE DISTRIBUTION NOTIFICATION
 */
export async function sendIncentiveUpdate(to: string, userName: string, action: string, amount: number) {
  const html = BASE_TEMPLATE(`
        <p style="margin: 0; font-size: 18px; font-weight: 700;">Hello, ${userName}</p>
        <p style="margin: 12px 0 0; color: ${COLORS.slate}; font-size: 15px;">A new administrative action has been logged regarding your incentive distributions.</p>
        
        <div style="background: ${COLORS.bg}; border-radius: 16px; padding: 24px; margin: 32px 0; border: 1px solid ${COLORS.border};">
            <table style="width: 100%;">
                <tr>
                    <td style="font-size: 11px; font-weight: 700; color: ${COLORS.slate}; text-transform: uppercase;">Protocol Action</td>
                    <td style="font-size: 11px; font-weight: 700; color: ${COLORS.slate}; text-transform: uppercase; text-align: right;">Impact Amount</td>
                </tr>
                <tr>
                    <td style="font-size: 15px; font-weight: 700;">${action}</td>
                    <td style="font-size: 20px; font-weight: 800; color: ${COLORS.primary}; text-align: right;">Rs. ${amount.toLocaleString()}</td>
                </tr>
            </table>
        </div>

        <div style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || '#'}" style="display: inline-block; padding: 14px 32px; background: ${COLORS.dark}; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 14px;">Verify in Dashboard</a>
        </div>
    `, `Protcol Update: ${action}`);

  return resend.emails.send({
    from: 'PayoutPower IMS <notifications@datamation.com>',
    to: [to],
    subject: `[PayoutPower] Incentive Update: ${action}`,
    html
  });
}

/**
 * 🔑 PASSWORD RESET DISPATCH
 */
export async function sendPasswordResetEmail(to: string, userName: string, token: string) {
  const html = BASE_TEMPLATE(`
        <p style="margin: 0; font-size: 18px; font-weight: 700;">Password Reset Request</p>
        <p style="margin: 12px 0 0; color: ${COLORS.slate}; font-size: 15px;">We received a request to reset the password for your account associated with <strong>${to}</strong>.</p>
        
        <div style="margin: 32px 0; padding: 20px; border-left: 4px solid ${COLORS.primary}; background: ${COLORS.bg}; text-align: center;">
            <p style="margin: 0 0 10px; font-size: 11px; font-weight: 700; color: ${COLORS.slate}; text-transform: uppercase;">Recovery Token</p>
            <code style="font-size: 14px; font-weight: 700; color: ${COLORS.dark}; background: #ffffff; padding: 8px 16px; border-radius: 8px; border: 1px solid ${COLORS.border};">${token}</code>
        </div>

        <div style="text-align: center;">
            <p style="margin-bottom: 24px; color: ${COLORS.slate}; font-size: 13px;">If you did not request this, please ignore this email. The token will expire in 1 hour.</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL || '#'}" style="display: inline-block; padding: 14px 32px; background: ${COLORS.primary}; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 14px;">Return to PayoutPower</a>
        </div>
    `, "Reset your PayoutPower password");

  return resend.emails.send({
    from: 'PayoutPower Security <security@datamation.com>',
    to: [to],
    subject: `[PayoutPower] Automated Recovery: Password Reset`,
    html
  });
}

/**
 * 🔔 ADMIN SIGNUP NOTIFICATION
 */
export async function sendAdminSignupNotification(adminEmail: string, userName: string, userEmail: string, role: string) {
  const html = BASE_TEMPLATE(`
        <p style="margin: 0; font-size: 18px; font-weight: 700;">New Access Request</p>
        <p style="margin: 12px 0 0; color: ${COLORS.slate}; font-size: 15px;">A new staff member has initiated a signup request and is awaiting administrative approval.</p>
        
        <div style="background: ${COLORS.bg}; border-radius: 16px; padding: 24px; margin: 32px 0; border: 1px solid ${COLORS.border};">
            <div style="margin-bottom: 12px;">
                <p style="margin: 0; font-size: 10px; font-weight: 700; color: ${COLORS.slate}; text-transform: uppercase;">Name</p>
                <p style="margin: 0; font-size: 15px; font-weight: 700;">${userName}</p>
            </div>
            <div style="margin-bottom: 12px;">
                <p style="margin: 0; font-size: 10px; font-weight: 700; color: ${COLORS.slate}; text-transform: uppercase;">Email</p>
                <p style="margin: 0; font-size: 15px; font-weight: 700;">${userEmail}</p>
            </div>
            <div>
                <p style="margin: 0; font-size: 10px; font-weight: 700; color: ${COLORS.slate}; text-transform: uppercase;">Requested Tier</p>
                <p style="margin: 0; font-size: 15px; font-weight: 700; color: ${COLORS.amber};">${role.toUpperCase()}</p>
            </div>
        </div>

        <div style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || '#'}/dashboard/users" style="display: inline-block; padding: 14px 32px; background: ${COLORS.dark}; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 14px;">Open Approval Queue</a>
        </div>
    `, `New Account Request: ${userName}`);

  return resend.emails.send({
    from: 'PayoutPower System <system@datamation.com>',
    to: [adminEmail],
    subject: `[PayoutPower] ACTION REQUIRED: New Registration Pending`,
    html
  });
}

/**
 * ✅ USER APPROVAL NOTIFICATION
 */
export async function sendUserStatusUpdate(userEmail: string, userName: string, status: 'approved' | 'rejected') {
  const isApproved = status === 'approved';
  const html = BASE_TEMPLATE(`
        <p style="margin: 0; font-size: 18px; font-weight: 700;">Protocol Status: ${status.toUpperCase()}</p>
        <p style="margin: 12px 0 0; color: ${COLORS.slate}; font-size: 15px;">
            ${isApproved
      ? `Your signup request has been successfully vetted and approved. Your account is now active.`
      : `Your access request to the system has been reviewed and declined at this time.`}
        </p>
        
        ${isApproved ? `
        <div style="margin: 32px 0; text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || '#'}" style="display: inline-block; padding: 14px 32px; background: ${COLORS.emerald}; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 14px;">Login to PayoutPower</a>
        </div>
        ` : ''}

        <p style="margin-top: 32px; font-size: 12px; color: ${COLORS.slate};">This logic-based decision was made by an authenticated organizational administrator.</p>
    `, `Account Status: ${status}`);

  return resend.emails.send({
    from: 'PayoutPower Identity <identity@datamation.com>',
    to: [userEmail],
    subject: `[PayoutPower] Identity Status Update: ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    html
  });
}
