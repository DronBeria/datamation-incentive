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
    connectionTimeout: 10000,
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
  return global._smtpTransporter!;
}

const BRAND_COLOR = '#4f46e5';
const DARK = '#0f172a';
const BORDER = '#e2e8f0';
const BG = '#f8fafc';

const THEMES = {
  admin: {
    brand: '#1e293b', // slate-800
    bg: '#f1f5f9',    // slate-100
    text: '#0f172a',
    accent: '#3b82f6',
    label: 'ADMINISTRATIVE PANEL'
  },
  general: {
    brand: '#4f46e5', // indigo-600
    bg: '#f8fafc',    // slate-50
    text: '#0f172a',
    accent: '#4f46e5',
    label: 'INCENTIVE MANAGEMENT'
  }
};

function baseTemplate(content: string, requestedTheme: 'admin' | 'general' = 'general'): string {
  const theme = THEMES[requestedTheme] || THEMES.general;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:40px 20px;background:${theme.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${theme.text};">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid ${BORDER};overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
    <div style="background:${theme.brand};padding:28px 32px;border-bottom:4px solid ${theme.accent};">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">PayoutPower</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${theme.label}</p>
    </div>
    <div style="padding:40px 32px;">
      ${content}
    </div>
    <div style="padding:24px 32px;background:${theme.bg};border-top:1px solid ${BORDER};text-align:center;">
      <p style="margin:0;font-size:12px;color:#64748b;font-weight:500;">
        This is a secure automated transmission from PayoutPower.
      </p>
      <p style="margin:4px 0 0;font-size:11px;color:#94a3b8;">
        Datamation Group &copy; ${new Date().getFullYear()}
      </p>
    </div>
  </div>
</body>
</html>`;
}

function btn(label: string, url: string, theme: 'admin' | 'general' = 'general'): string {
  const color = THEMES[theme]?.accent || BRAND_COLOR;
  return `<a href="${url}" style="display:inline-block;margin-top:24px;padding:14px 32px;background:${color};color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);">${label}</a>`;
}

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

export async function sendWelcomeEmail(to: string, userName: string, tempPassword: string) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 12px;color:${DARK};font-size:20px;font-weight:800;">Welcome to PayoutPower, ${userName}!</h2>
    <p style="margin:0 0 24px;color:#475569;line-height:1.6;">Your professional incentive account is now active. Use the credentials below to access your dashboard.</p>
    <div style="background:#f1f5f9;border:1px solid ${BORDER};border-radius:12px;padding:24px;margin:0 0 24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;width:120px;">Email</td><td style="padding:8px 0;font-weight:700;color:${DARK};">${to}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Password</td><td style="padding:8px 0;font-weight:800;font-family:monospace;color:#3b82f6;font-size:16px;">${tempPassword}</td></tr>
      </table>
    </div>
    <p style="margin:0 0 8px;color:#475569;font-size:14px;font-weight:500;">Please secure your account by changing this password upon your first entry.</p>
    ${btn('Initial Login', `${APP_URL}/login`)}
  `, 'general');
  return sendMail({ to, subject: 'Welcome to PayoutPower — Your Account is Ready', html });
}

export async function sendAdminSignupNotification(
  adminEmail: string,
  newUserName: string,
  newUserEmail: string,
  role: string
) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 12px;color:${DARK};font-size:20px;font-weight:800;">Action Required: New Account Request</h2>
    <p style="margin:0 0 24px;color:#475569;line-height:1.6;font-size:15px;">A new staff member has registered and is awaiting administrative clearance.</p>
    <div style="background:#f8fafc;border:1px solid ${BORDER};border-radius:12px;padding:24px;margin:0 0 24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;width:120px;">Staff Name</td><td style="padding:8px 0;font-weight:700;color:${DARK};">${newUserName}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Email Address</td><td style="padding:8px 0;color:#1e293b;">${newUserEmail}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Proposed Role</td><td style="padding:8px 0;"><span style="background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:800;">${role.toUpperCase()}</span></td></tr>
      </table>
    </div>
    <p style="margin:0;color:#475569;font-size:14px;">Please authenticate and authorize this user in the User Control Center.</p>
    ${btn('Authorize User', `${APP_URL}/dashboard/users`, 'admin')}
  `, 'admin');
  return sendMail({ to: adminEmail, subject: `[ADMIN] Action Required: New ${role} Registration — ${newUserName}`, html });
}

export async function sendAdminBatchSubmissionNotification(
  adminEmail: string,
  managerName: string,
  batchName: string,
  itemCount: number,
  totalValue: number
) {
  const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalValue);
  const html = baseTemplate(`
    <h2 style="margin:0 0 12px;color:${DARK};font-size:20px;font-weight:800;">Incentive Batch Submission</h2>
    <p style="margin:0 0 24px;color:#475569;line-height:1.6;font-size:15px;"><strong>${managerName}</strong> has submitted a new incentive batch for your final approval.</p>
    <div style="background:#f8fafc;border:1px solid ${BORDER};border-radius:12px;padding:24px;margin:0 0 24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;width:120px;">Batch ID</td><td style="padding:8px 0;font-weight:700;color:${DARK};">${batchName}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Recipients</td><td style="padding:8px 0;color:#1e293b;">${itemCount} users</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Total Volume</td><td style="padding:8px 0;font-weight:800;color:#1e293b;font-size:18px;">${formattedAmount}</td></tr>
      </table>
    </div>
    <p style="margin:0;color:#475569;font-size:14px;">Review individual line items and approve for payout disbursement.</p>
    ${btn('Review Batch', `${APP_URL}/dashboard/batches`, 'admin')}
  `, 'admin');
  return sendMail({ to: adminEmail, subject: `[ADMIN] Batch Approval Needed: ${batchName} — ${formattedAmount}`, html });
}

export async function sendUserStatusUpdate(
  userEmail: string,
  userName: string,
  status: 'approved' | 'rejected'
) {
  const isApproved = status === 'approved';
  const html = baseTemplate(`
    <h2 style="margin:0 0 12px;color:${DARK};font-size:20px;font-weight:800;">Account ${isApproved ? 'Approved' : 'Not Approved'}</h2>
    <p style="margin:0 0 24px;color:#475569;line-height:1.6;">Hello ${userName},</p>
    ${isApproved
      ? `<p style="margin:0 0 24px;color:#475569;line-height:1.6;font-size:15px;">
           Great news — your PayoutPower account has been <strong style="color:#10b981;">successfully authorized</strong>. 
           You can now access all features of the incentive tracking system.
         </p>
         ${btn('Launch Dashboard', `${APP_URL}/login`, 'general')}`
      : `<p style="margin:0 0 24px;color:#475569;line-height:1.6;font-size:15px;">
           Your account request was <strong style="color:#ef4444;">not approved</strong> at this time.
           If you believe this is a misunderstanding, please contact your department head.
         </p>`
    }
  `, 'general');
  return sendMail({ to: userEmail, subject: `Your PayoutPower Account Has Been ${isApproved ? 'Approved' : 'Rejected'}`, html });
}

export async function sendAdminUserUpdateNotification(
  adminEmail: string,
  updatedUserName: string,
  fieldsChanged: string[]
) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 12px;color:${DARK};font-size:20px;font-weight:800;">Security: User Profile Modified</h2>
    <p style="margin:0 0 24px;color:#475569;line-height:1.6;font-size:15px;">Administrative notice: The profile for <strong>${updatedUserName}</strong> has been updated.</p>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:24px;margin:0 0 24px;">
      <p style="margin:0 0 12px;font-size:11px;color:#c2410c;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Modified Attributes</p>
      <ul style="margin:0;padding:0 0 0 20px;color:#9a3412;font-size:14px;font-weight:600;">
        ${fieldsChanged.map(f => `<li style="margin-bottom:4px;">${f}</li>`).join('')}
      </ul>
    </div>
    <p style="margin:0;color:#475569;font-size:14px;">Review these changes in the centralized audit log.</p>
    ${btn('Audit User Activity', `${APP_URL}/dashboard/users`, 'admin')}
  `, 'admin');
  return sendMail({ to: adminEmail, subject: `[SECURITY] User Profile Updated — ${updatedUserName}`, html });
}

export async function sendPasswordResetEmail(to: string, userName: string, token: string) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  const html = baseTemplate(`
    <h2 style="margin:0 0 12px;color:${DARK};font-size:20px;font-weight:800;">Password Reset Request</h2>
    <p style="margin:0 0 24px;color:#475569;line-height:1.6;font-size:15px;">
      Hello ${userName}, we received a request to securely reset your PayoutPower credentials. 
      This secure link expires in 60 minutes.
    </p>
    ${btn('Secure Password Reset', resetUrl, 'general')}
    <p style="margin:32px 0 12px;color:#64748b;font-size:11px;text-transform:uppercase;font-weight:700;letter-spacing:1px;">Direct Access Link</p>
    <div style="background:#f8fafc;padding:12px;border-radius:8px;border:1px solid #e2e8f0;word-break:break-all;font-family:monospace;font-size:11px;color:#64748b;">${resetUrl}</div>
  `, 'general');
  return sendMail({ to, subject: 'PayoutPower — Password Reset Instructions', html });
}

export async function sendIncentiveUpdate(to: string, userName: string, action: string, amount: number) {
  const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  const html = baseTemplate(`
    <h2 style="margin:0 0 12px;color:${DARK};font-size:20px;font-weight:800;">Incentive Update Notification</h2>
    <div style="background:#f8fafc;border:1px solid ${BORDER};border-left:4px solid ${BRAND_COLOR};border-radius:12px;padding:24px;margin:0 0 24px;">
      <p style="margin:0 0 16px;color:${DARK};font-size:15px;font-weight:600;">${action}</p>
      <p style="margin:4px 0 0;font-size:32px;font-weight:800;color:${DARK};letter-spacing:-1px;">${formattedAmount}</p>
    </div>
    ${btn('Access Portal', `${APP_URL}/dashboard`, 'general')}
  `, 'general');
  return sendMail({ to, subject: `PayoutPower — ${action}`, html });
}

export async function sendBatchApprovedEmail(to: string, userName: string, batchName: string, amount: number) {
  const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  const html = baseTemplate(`
    <h2 style="margin:0 0 12px;color:#065f46;font-size:22px;font-weight:900;">Commission Authorized!</h2>
    <p style="margin:0 0 24px;color:#475569;line-height:1.6;font-size:15px;">Excellent news ${userName}, your payout for <strong>${batchName}</strong> has been authorized.</p>
    <div style="background:#ecfdf5;border:1px solid #10b981;border-radius:12px;padding:24px;margin:0 0 24px;">
      <p style="margin:4px 0 0;font-size:32px;font-weight:900;color:#064e3b;letter-spacing:-1.5px;">${formattedAmount}</p>
    </div>
    ${btn('Review Payout', `${APP_URL}/dashboard`, 'general')}
  `, 'general');
  return sendMail({ to, subject: `Incentive Approved — ${formattedAmount} from ${batchName}`, html });
}

export async function sendBatchPaidEmail(to: string, userName: string, batchName: string, amount: number) {
  const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  const html = baseTemplate(`
    <h2 style="margin:0 0 12px;color:#1e40af;font-size:22px;font-weight:900;">Disbursement Successful</h2>
    <div style="background:#eff6ff;border:1px solid #3b82f6;border-radius:12px;padding:24px;margin:0 0 24px;">
      <p style="margin:4px 0 0;font-size:32px;font-weight:900;color:#1e3a8a;letter-spacing:-1.5px;">${formattedAmount}</p>
    </div>
    ${btn('Download Statement', `${APP_URL}/dashboard`, 'general')}
  `, 'general');
  return sendMail({ to, subject: `Payout Processed — ${formattedAmount} from ${batchName}`, html });
}

export async function sendAccountsBatchNotification(
  accountsEmail: string,
  batchName: string,
  totalAmount: number,
  approvedBy: string
) {
  const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalAmount);
  const html = baseTemplate(`
    <h2 style="margin:0 0 12px;color:#1e293b;font-size:20px;font-weight:800;">Payout Authorization Notice</h2>
    <p style="margin:0 0 24px;color:#475569;line-height:1.6;font-size:15px;">Finance Team, a new commission batch has been <strong style="color:#059669;">fully authorized</strong> for disbursement by ${approvedBy}.</p>
    <div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin:0 0 24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;width:120px;">Batch Name</td><td style="padding:8px 0;font-weight:700;color:#0f172a;">${batchName}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Volume</td><td style="padding:8px 0;font-weight:800;color:#0f172a;font-size:18px;">${formattedAmount}</td></tr>
      </table>
    </div>
    <p style="margin:0;color:#475569;font-size:14px;">Please process these payments through the bulk payout portal.</p>
    ${btn('Open Payout Gateway', `${APP_URL}/dashboard/batches`, 'general')}
  `, 'general');
  return sendMail({ to: accountsEmail, subject: `[FINANCE] Payout Authorized: ${batchName} — ${formattedAmount}`, html });
}
