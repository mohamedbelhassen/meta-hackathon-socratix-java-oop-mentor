export interface WelcomeEmailParams {
  displayName: string;
  confirmationUrl: string;
  role: 'teacher' | 'student';
}

export interface PasswordResetEmailParams {
  displayName: string;
  resetUrl: string;
}

export interface AdminNewUserEmailParams {
  userEmail: string;
  displayName: string;
  role: 'teacher' | 'student';
  registeredAt?: string;
  ipAddress?: string;
  dashboardUrl?: string;
}

/**
 * Returns an HTML email template for account verification / welcome on Socratix (100% in English for hackathon jury evaluation).
 */
export function getWelcomeVerificationTemplate(params: WelcomeEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { displayName, confirmationUrl, role } = params;
  const roleLabel = role === 'teacher' ? 'Instructor / Mentor' : 'Student';
  const subject = `🦉 Confirm your Socratix account — ${roleLabel}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0f19;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #f1f5f9;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #0b0f19;
      padding: 40px 16px;
      box-sizing: border-box;
    }
    .card {
      max-width: 580px;
      margin: 0 auto;
      background-color: #111827;
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid #1f2937;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7);
    }
    .header {
      background: linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%);
      padding: 36px 32px;
      text-align: center;
      color: #ffffff;
    }
    .brand-icon {
      font-size: 38px;
      margin-bottom: 8px;
    }
    .brand-title {
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .brand-subtitle {
      margin: 6px 0 0 0;
      font-size: 13px;
      font-weight: 500;
      color: #d1fae5;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .content {
      padding: 36px 32px 28px 32px;
    }
    .greeting {
      margin: 0 0 16px 0;
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
    }
    .role-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background-color: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
      margin-bottom: 18px;
    }
    .text {
      margin: 0 0 18px 0;
      font-size: 15px;
      line-height: 1.65;
      color: #94a3b8;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0;
    }
    .btn {
      display: inline-block;
      background-color: #10b981;
      color: #042f2e !important;
      font-size: 15px;
      font-weight: 800;
      text-decoration: none;
      padding: 16px 36px;
      border-radius: 12px;
      box-shadow: 0 10px 20px -5px rgba(16, 185, 129, 0.4);
      transition: all 0.2s ease;
    }
    .alert-box {
      margin-top: 24px;
      padding: 14px 18px;
      background-color: #06241b;
      border-left: 4px solid #10b981;
      border-radius: 8px;
      font-size: 13px;
      color: #a7f3d0;
      line-height: 1.5;
    }
    .fallback {
      margin-top: 24px;
      font-size: 12px;
      color: #64748b;
      word-break: break-all;
      line-height: 1.6;
    }
    .fallback a {
      color: #10b981;
      text-decoration: underline;
    }
    .footer {
      padding: 24px 32px;
      background-color: #0b0f19;
      border-top: 1px solid #1f2937;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="brand-icon">🦉</div>
        <h1 class="brand-title">Socratix AI</h1>
        <p class="brand-subtitle">Intelligent Pedagogical Platform</p>
      </div>
      <div class="content">
        <span class="role-badge">${roleLabel} Account</span>
        <h2 class="greeting">Welcome, ${displayName}!</h2>
        <p class="text">
          Your account has been initialized on Socratix. To finalize your registration and access your coding labs with the real-time Socratic AI mentor, please verify your email address:
        </p>
        <div class="btn-container">
          <a href="${confirmationUrl}" class="btn" target="_blank">Verify Email Address &rarr;</a>
        </div>
        <div class="alert-box">
          🔒 <strong>One-time secure link:</strong> This verification link will expire in 24 hours. If you did not create an account on Socratix, you can safely ignore this email.
        </div>
        <p class="fallback">
          If the button above does not work, copy and paste this direct link into your browser:<br>
          <a href="${confirmationUrl}">${confirmationUrl}</a>
        </p>
      </div>
      <div class="footer">
        <p style="margin: 0 0 6px 0;">Socratix AI — Java OOP Socratic Mentor &amp; Real-Time ERP</p>
        <p style="margin: 0;">Built for the Meta Global AI Developer Hackathon 2026</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Welcome to Socratix, ${displayName}!

Your ${roleLabel} account has been created. To verify your email address and access the platform, please click the link below:
${confirmationUrl}

This secure link is valid for 24 hours. If you did not request this, please ignore this email.
  `.trim();

  return { subject, html, text };
}

/**
 * Returns an HTML email template for password reset (100% in English for hackathon jury evaluation).
 */
export function getPasswordResetTemplate(params: PasswordResetEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { displayName, resetUrl } = params;
  const subject = `🔐 Reset your Socratix password — Socratix AI`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9; }
    .wrapper { width: 100%; background-color: #0b0f19; padding: 40px 16px; box-sizing: border-box; }
    .card { max-width: 580px; margin: 0 auto; background-color: #111827; border-radius: 20px; overflow: hidden; border: 1px solid #1f2937; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 36px 32px; text-align: center; color: #ffffff; }
    .content { padding: 36px 32px 28px 32px; }
    .greeting { margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #ffffff; }
    .text { margin: 0 0 18px 0; font-size: 15px; line-height: 1.65; color: #94a3b8; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; font-size: 15px; font-weight: 700; text-decoration: none; padding: 16px 36px; border-radius: 12px; }
    .alert-box { margin-top: 24px; padding: 14px 18px; background-color: #172554; border-left: 4px solid #3b82f6; border-radius: 8px; font-size: 13px; color: #bfdbfe; }
    .fallback { margin-top: 24px; font-size: 12px; color: #64748b; word-break: break-all; }
    .fallback a { color: #3b82f6; }
    .footer { padding: 24px 32px; background-color: #0b0f19; border-top: 1px solid #1f2937; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1 style="margin:0; font-size:24px;">Socratix AI</h1>
        <p style="margin:6px 0 0 0; font-size:13px; color:#bfdbfe; text-transform:uppercase;">Account Security</p>
      </div>
      <div class="content">
        <h2 class="greeting">Hello ${displayName},</h2>
        <p class="text">
          A password reset was requested for your Socratix account. Please click the button below to set a new password:
        </p>
        <div class="btn-container">
          <a href="${resetUrl}" class="btn" target="_blank">Reset Password &rarr;</a>
        </div>
        <div class="alert-box">
          🔒 This link will expire in 1 hour. If you did not initiate this request, no action is needed and your account remains secure.
        </div>
        <p class="fallback">
          Direct link: <a href="${resetUrl}">${resetUrl}</a>
        </p>
      </div>
      <div class="footer">
        <p style="margin:0;">Socratix AI Platform — Meta AI Hackathon 2026</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Hello ${displayName},

To reset your Socratix password, please follow this link:
${resetUrl}

This link is valid for 1 hour. If you did not request a password reset, you can safely ignore this message.
  `.trim();

  return { subject, html, text };
}

/**
 * Returns an HTML email template for notifying the administrator of a new user registration (100% in English for hackathon jury evaluation).
 */
export function getAdminNewUserNotificationTemplate(params: AdminNewUserEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { userEmail, displayName, role, registeredAt, ipAddress, dashboardUrl } = params;
  const roleLabel = role === 'teacher' ? 'Instructor / Mentor' : 'Student';
  const timestamp = registeredAt || new Date().toISOString();
  const subject = `🔔 New Socratix Registration: ${displayName} (${roleLabel})`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0f19;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #f1f5f9;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #0b0f19;
      padding: 40px 16px;
      box-sizing: border-box;
    }
    .card {
      max-width: 580px;
      margin: 0 auto;
      background-color: #111827;
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid #1f2937;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7);
    }
    .header {
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%);
      padding: 32px;
      text-align: center;
      color: #ffffff;
    }
    .brand-title {
      margin: 0;
      font-size: 22px;
      font-weight: 800;
    }
    .brand-subtitle {
      margin: 6px 0 0 0;
      font-size: 12px;
      font-weight: 600;
      color: #c7d2fe;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .content {
      padding: 32px;
    }
    .title {
      margin: 0 0 16px 0;
      font-size: 18px;
      font-weight: 700;
      color: #ffffff;
    }
    .table-info {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background: #0b0f19;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #1f2937;
    }
    .table-info td {
      padding: 12px 16px;
      font-size: 13px;
      border-bottom: 1px solid #1f2937;
    }
    .table-info tr:last-child td {
      border-bottom: none;
    }
    .label {
      color: #94a3b8;
      font-weight: 600;
      width: 38%;
    }
    .value {
      color: #f1f5f9;
      font-weight: 500;
    }
    .badge-teacher {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      background: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.4);
    }
    .badge-student {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      background: rgba(16, 185, 129, 0.2);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }
    .btn-container {
      text-align: center;
      margin: 28px 0 12px 0;
    }
    .btn {
      display: inline-block;
      background-color: #4f46e5;
      color: #ffffff !important;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      padding: 14px 30px;
      border-radius: 10px;
      box-shadow: 0 10px 20px -5px rgba(79, 70, 229, 0.4);
    }
    .footer {
      padding: 20px 32px;
      background-color: #0b0f19;
      border-top: 1px solid #1f2937;
      text-align: center;
      font-size: 11px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div style="font-size: 32px; margin-bottom: 6px;">🔔</div>
        <h1 class="brand-title">Socratix AI</h1>
        <p class="brand-subtitle">Administrator Notification</p>
      </div>
      <div class="content">
        <h2 class="title">New User Registered on Socratix</h2>
        <p style="font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 16px 0;">
          A new user account was just created on your Socratix instance:
        </p>

        <table class="table-info">
          <tr>
            <td class="label">Display Name</td>
            <td class="value"><strong>${displayName}</strong></td>
          </tr>
          <tr>
            <td class="label">Email Address</td>
            <td class="value"><a href="mailto:${userEmail}" style="color: #818cf8; text-decoration: none;">${userEmail}</a></td>
          </tr>
          <tr>
            <td class="label">Assigned Role</td>
            <td class="value">
              <span class="${role === 'teacher' ? 'badge-teacher' : 'badge-student'}">${roleLabel}</span>
            </td>
          </tr>
          <tr>
            <td class="label">Registration Date</td>
            <td class="value" style="font-family: monospace; font-size: 12px;">${timestamp}</td>
          </tr>
          ${
            ipAddress
              ? `<tr>
            <td class="label">IP Address</td>
            <td class="value" style="font-family: monospace; font-size: 12px;">${ipAddress}</td>
          </tr>`
              : ''
          }
        </table>

        ${
          dashboardUrl
            ? `<div class="btn-container">
          <a href="${dashboardUrl}" class="btn" target="_blank">Open Teacher Hub &rarr;</a>
        </div>`
            : ''
        }
      </div>
      <div class="footer">
        <p style="margin: 0 0 4px 0;">Automated notification sent to the system administrator.</p>
        <p style="margin: 0;">Socratix AI Mentor — Meta AI Hackathon 2026</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Socratix AI — New User Registration

Name: ${displayName}
Email: ${userEmail}
Role: ${roleLabel}
Date: ${timestamp}
IP: ${ipAddress || 'N/A'}
  `.trim();

  return { subject, html, text };
}
