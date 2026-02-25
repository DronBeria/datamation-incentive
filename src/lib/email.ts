import nodemailer from 'nodemailer';

declare global {
  var _smtpTransporter: nodemailer.Transporter | undefined;
}

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_USER = process.env.SMTP_USER || 'datamationincentive@gmail.com';
const SMTP_PASS = (process.env.SMTP_PASS || '').replace(/^["']|["']$/g, '').trim();
const SMTP_FROM = process.env.SMTP_FROM || `"PayoutPower" <${SMTP_USER}>`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

function getTransporter(): nodemailer.Transporter {
  const useSSL = SMTP_PORT === 465;

  const config: nodemailer.TransportOptions = {
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: useSSL,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    connectionTimeout: 10000, // 10s
    greetingTimeout: 10000,
  } as any;

  if (process.env.NODE_ENV === 'production') {
    return nodemailer.createTransport(config);
  }

  if (!global._smtpTransporter) {
    console.log(`[SMTP] Initializing singleton transporter ${SMTP_HOST}:${SMTP_PORT}`);
    global._smtpTransporter = nodemailer.createTransport(config);
    global._smtpTransporter.verify((err) => {
      if (err) console.error('[SMTP] Verification failed:', err.message);
      else console.log('[SMTP] Ready — Connection verified');
    });
  }
  return global._smtpTransporter;
}

const BRAND_COLOR = '#4f46e5';
const DARK = '#0f172a';
const BORDER = '#e2e8f0';
const BG = '#f8fafc';

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:40px 20px;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${DARK};">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid ${BORDER};overflow:hidden;">
    <div style="background:${BRAND_COLOR};padding:28px 32px;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">PayoutPower</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Incentive Management System</p>
    </div>
    <div style="padding:32px;">
      ${content}
    </div>
    <div style="padding:20px 32px;background:${BG};border-top:1px solid ${BORDER};text-align:center;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        This is an automated message from PayoutPower. Please do not reply directly to this email.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function btn(label: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;margin-top:20px;padding:12px 28px;background:${BRAND_COLOR};color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">${label}</a>`;
}

// ─── Public send wrapper ─────────────────────────────────────────────────────

export async function sendMail({ to, subject, html }: { to: string; subject: string; html: string }) {
  console.log(`[MAIL] Dispatching to: ${to} | Subject: ${subject}`);
  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
    });

    console.log(`[MAIL] Success — MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error('[MAIL] SMTP Error:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, userName: string, tempPassword: string) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:${DARK};font-size:20px;">Welcome to PayoutPower, ${userName}!</h2>
    <p style="margin:0 0 24px;color:#475569;line-height:1.6;">Your account has been created and is ready to use. Here are your login credentials:</p>
    <div style="background:${BG};border:1px solid ${BORDER};border-radius:8px;padding:20px;margin:0 0 24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:100px;">Email</td><td style="padding:6px 0;font-weight:600;">${to}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Password</td><td style="padding:6px 0;font-weight:600;font-family:monospace;">${tempPassword}</td></tr>
      </table>
    </div>
    <p style="margin:0 0 8px;color:#475569;">Please log in and change your password immediately.</p>
    ${btn('Login to PayoutPower', `${APP_URL}/login`)}
    <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">If you did not expect this email, please contact your administrator.</p>
  `);
  return sendMail({ to, subject: 'Welcome to PayoutPower — Your Account is Ready', html });
}

export async function sendAdminSignupNotification(
  adminEmail: string,
  newUserName: string,
  newUserEmail: string,
  role: string
) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:${DARK};font-size:20px;">New Account Request</h2>
    <p style="margin:0 0 24px;color:#475569;line-height:1.6;">A new user has registered and is awaiting your approval.</p>
    <div style="background:${BG};border:1px solid ${BORDER};border-radius:8px;padding:20px;margin:0 0 24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:100px;">Name</td><td style="padding:6px 0;font-weight:600;">${newUserName}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Email</td><td style="padding:6px 0;">${newUserEmail}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Role</td><td style="padding:6px 0;">${role}</td></tr>
      </table>
    </div>
    <p style="margin:0;color:#475569;">Please review this request in the user management panel.</p>
    ${btn('Review in Dashboard', `${APP_URL}/dashboard/users`)}
  `);
  return sendMail({ to: adminEmail, subject: `New ${role} Registration Pending Approval — ${newUserName}`, html });
}

export async function sendUserStatusUpdate(
  userEmail: string,
  userName: string,
  status: 'approved' | 'rejected'
) {
  const isApproved = status === 'approved';
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:${DARK};font-size:20px;">
      Account ${isApproved ? 'Approved' : 'Not Approved'}
    </h2>
    <p style="margin:0 0 24px;color:#475569;line-height:1.6;">Hello ${userName},</p>
    ${isApproved
      ? `<p style="margin:0 0 24px;color:#475569;line-height:1.6;">
           Great news — your PayoutPower account has been <strong style="color:#10b981;">approved</strong>. 
           You can now log in and start tracking your incentives.
         </p>
         ${btn('Log In Now', `${APP_URL}/login`)}`
      : `<p style="margin:0 0 24px;color:#475569;line-height:1.6;">
           Unfortunately your account request was <strong style="color:#ef4444;">not approved</strong> at this time.
           Please contact your administrator if you believe this is an error.
         </p>`
    }
  `);
  return sendMail({
    to: userEmail,
    subject: `Your PayoutPower Account Has Been ${isApproved ? 'Approved' : 'Rejected'}`,
    html,
  });
}

export async function sendPasswordResetEmail(to: string, userName: string, token: string) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:${DARK};font-size:20px;">Password Reset Request</h2>
    <p style="margin:0 0 24px;color:#475569;line-height:1.6;">Hello ${userName},</p>
    <p style="margin:0 0 24px;color:#475569;line-height:1.6;">
      We received a request to reset your PayoutPower password. Click the button below to set a new password. 
      This link will expire in <strong>1 hour</strong>.
    </p>
    ${btn('Reset My Password', resetUrl)}
    <p style="margin:24px 0 8px;color:#64748b;font-size:13px;">Or copy this link into your browser:</p>
    <p style="margin:0;font-family:monospace;font-size:12px;color:#64748b;word-break:break-all;">${resetUrl}</p>
    <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">
      If you did not request a password reset, you can safely ignore this email. Your password will not change.
    </p>
  `);
  return sendMail({ to, subject: 'PayoutPower — Password Reset Instructions', html });
}

export async function sendIncentiveUpdate(
  to: string,
  userName: string,
  action: string,
  amount: number
) {
  const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:${DARK};font-size:20px;">Incentive Update</h2>
    <p style="margin:0 0 24px;color:#475569;line-height:1.6;">Hello ${userName},</p>
    <p style="margin:0 0 16px;color:#475569;line-height:1.6;">${action}</p>
    <div style="background:${BG};border:1px solid ${BORDER};border-left:4px solid ${BRAND_COLOR};border-radius:8px;padding:20px;margin:0 0 24px;">
      <p style="margin:0;font-size:13px;color:#64748b;">Amount</p>
      <p style="margin:4px 0 0;font-size:28px;font-weight:700;color:${DARK};">${formattedAmount}</p>
    </div>
    ${btn('View My Dashboard', `${APP_URL}/dashboard`)}
  `);
  return sendMail({ to, subject: `PayoutPower — ${action}`, html });
}

export async function sendBatchApprovedEmail(
  to: string,
  userName: string,
  batchName: string,
  amount: number
) {
  const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:${DARK};font-size:20px;">Commission Approved!</h2>
    <p style="margin:0 0 24px;color:#475569;line-height:1.6;">Hello ${userName},</p>
    <p style="margin:0 0 16px;color:#475569;line-height:1.6;">
      Your incentive payout from batch <strong>${batchName}</strong> has been approved by management 
      and forwarded to the Accounts team for disbursement.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #10b981;border-radius:8px;padding:20px;margin:0 0 24px;">
      <p style="margin:0;font-size:13px;color:#059669;">Approved Amount</p>
      <p style="margin:4px 0 0;font-size:28px;font-weight:700;color:#065f46;">${formattedAmount}</p>
    </div>
    ${btn('View in Dashboard', `${APP_URL}/dashboard`)}
  `);
  return sendMail({ to, subject: `Incentive Approved — ${formattedAmount} from ${batchName}`, html });
}

export async function sendBatchPaidEmail(
  to: string,
  userName: string,
  batchName: string,
  amount: number
) {
  const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;color:${DARK};font-size:20px;">Payout Disbursed!</h2>
    <p style="margin:0 0 24px;color:#475569;line-height:1.6;">Hello ${userName},</p>
    <p style="margin:0 0 16px;color:#475569;line-height:1.6;">
      Your incentive payment from batch <strong>${batchName}</strong> has been processed and disbursed by the Accounts team.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #10b981;border-radius:8px;padding:20px;margin:0 0 24px;">
      <p style="margin:0;font-size:13px;color:#059669;">Amount Paid</p>
      <p style="margin:4px 0 0;font-size:28px;font-weight:700;color:#065f46;">${formattedAmount}</p>
    </div>
    ${btn('View Payment History', `${APP_URL}/dashboard`)}
    <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">Please check your bank account or pay slip for confirmation. Contact HR if you have any questions.</p>
  `);
  return sendMail({ to, subject: `Payout Processed — ${formattedAmount} from ${batchName}`, html });
}
