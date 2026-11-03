# Socratix AI — English Email Templates (Brevo & Supabase Dashboard)

> **Purpose:** Ensures all transactional emails received by the Meta AI Hackathon jury and students are formatted 100% in English, adhering to Socratix's Dark IDE aesthetic and Emerald accent branding.

---

## 1. Application-Level Templates (Brevo API Gateway)

These templates are defined in [`lib/email/templates.ts`](file:///c:/dev/_current_apps/meta-hackaton-socratix-java-oop-mentor/lib/email/templates.ts) and sent via [`lib/email/sender.ts`](file:///c:/dev/_current_apps/meta-hackaton-socratix-java-oop-mentor/lib/email/sender.ts) using the Brevo REST API v3:

1. **Account Verification / Welcome (`getWelcomeVerificationTemplate`)**:
   - **Subject:** `🦉 Confirm your Socratix account — [Instructor / Mentor | Student]`
   - **Content:** Branded welcome message, role badge, 1-click verification button (`Verify Email Address →`), security expiration notice (24h), and direct URL fallback.
2. **Password Reset (`getPasswordResetTemplate`)**:
   - **Subject:** `🔐 Reset your Socratix password — Socratix AI`
   - **Content:** Security notice, password reset button (`Reset Password →`), 1h expiration disclaimer.
3. **Admin Registration Notification (`getAdminNewUserNotificationTemplate`)**:
   - **Subject:** `🔔 New Socratix Registration: [DisplayName] ([Role])`
   - **Content:** Diagnostic table containing user full name, email, assigned role badge, ISO registration timestamp, client IP address, and 1-click button to the Teacher ERP Hub.

---

## 2. Native Supabase Dashboard Email Templates (Ready to Copy)

If you enable native Supabase SMTP or email confirmation in **Supabase Dashboard → Authentication → Email Templates**, copy and paste the following HTML templates directly into the dashboard.

---

### Template 1: Confirm Signup

- **Subject:** `🦉 Confirm your Socratix AI account`
- **Body (HTML):**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm your Socratix account</title>
  <style>
    body { margin:0; padding:0; background-color:#0b0f19; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#f1f5f9; }
    .wrapper { width:100%; background-color:#0b0f19; padding:40px 16px; box-sizing:border-box; }
    .card { max-width:580px; margin:0 auto; background-color:#111827; border-radius:20px; overflow:hidden; border:1px solid #1f2937; box-shadow:0 20px 40px -15px rgba(0,0,0,0.7); }
    .header { background:linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%); padding:36px 32px; text-align:center; color:#ffffff; }
    .brand-icon { font-size:38px; margin-bottom:8px; }
    .brand-title { margin:0; font-size:24px; font-weight:800; }
    .brand-subtitle { margin:6px 0 0 0; font-size:13px; font-weight:500; color:#d1fae5; text-transform:uppercase; letter-spacing:1px; }
    .content { padding:36px 32px 28px 32px; }
    .greeting { margin:0 0 16px 0; font-size:20px; font-weight:700; color:#ffffff; }
    .text { margin:0 0 18px 0; font-size:15px; line-height:1.65; color:#94a3b8; }
    .btn-container { text-align:center; margin:32px 0; }
    .btn { display:inline-block; background-color:#10b981; color:#042f2e !important; font-size:15px; font-weight:800; text-decoration:none; padding:16px 36px; border-radius:12px; box-shadow:0 10px 20px -5px rgba(16,185,129,0.4); }
    .alert-box { margin-top:24px; padding:14px 18px; background-color:#06241b; border-left:4px solid #10b981; border-radius:8px; font-size:13px; color:#a7f3d0; line-height:1.5; }
    .fallback { margin-top:24px; font-size:12px; color:#64748b; word-break:break-all; line-height:1.6; }
    .fallback a { color:#10b981; text-decoration:underline; }
    .footer { padding:24px 32px; background-color:#0b0f19; border-top:1px solid #1f2937; text-align:center; font-size:12px; color:#64748b; }
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
        <h2 class="greeting">Welcome to Socratix!</h2>
        <p class="text">
          Thank you for creating an account on Socratix. To complete your registration and begin your interactive Java OOP learning experience, please confirm your email:
        </p>
        <div class="btn-container">
          <a href="{{ .ConfirmationURL }}" class="btn" target="_blank">Confirm Email Address &rarr;</a>
        </div>
        <div class="alert-box">
          🔒 <strong>One-time verification link:</strong> This link is valid for 24 hours. If you did not create an account on Socratix, you can safely discard this email.
        </div>
        <p class="fallback">
          Direct link:<br>
          <a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a>
        </p>
      </div>
      <div class="footer">
        <p style="margin:0 0 6px 0;">Socratix AI — Java OOP Socratic Mentor &amp; Real-Time ERP</p>
        <p style="margin:0;">Built for the Meta Global AI Developer Hackathon 2026</p>
      </div>
    </div>
  </div>
</body>
</html>
```

---

### Template 2: Reset Password

- **Subject:** `🔐 Reset your Socratix AI password`
- **Body (HTML):**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your Socratix password</title>
  <style>
    body { margin:0; padding:0; background-color:#0b0f19; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#f1f5f9; }
    .wrapper { width:100%; background-color:#0b0f19; padding:40px 16px; box-sizing:border-box; }
    .card { max-width:580px; margin:0 auto; background-color:#111827; border-radius:20px; overflow:hidden; border:1px solid #1f2937; }
    .header { background:linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding:36px 32px; text-align:center; color:#ffffff; }
    .content { padding:36px 32px 28px 32px; }
    .greeting { margin:0 0 16px 0; font-size:20px; font-weight:700; color:#ffffff; }
    .text { margin:0 0 18px 0; font-size:15px; line-height:1.65; color:#94a3b8; }
    .btn-container { text-align:center; margin:32px 0; }
    .btn { display:inline-block; background-color:#2563eb; color:#ffffff !important; font-size:15px; font-weight:700; text-decoration:none; padding:16px 36px; border-radius:12px; }
    .alert-box { margin-top:24px; padding:14px 18px; background-color:#172554; border-left:4px solid #3b82f6; border-radius:8px; font-size:13px; color:#bfdbfe; }
    .fallback { margin-top:24px; font-size:12px; color:#64748b; word-break:break-all; }
    .fallback a { color:#3b82f6; }
    .footer { padding:24px 32px; background-color:#0b0f19; border-top:1px solid #1f2937; text-align:center; font-size:12px; color:#64748b; }
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
        <h2 class="greeting">Password Reset Request</h2>
        <p class="text">
          We received a request to reset your Socratix password. Click the button below to choose a new password:
        </p>
        <div class="btn-container">
          <a href="{{ .ConfirmationURL }}" class="btn" target="_blank">Reset Password &rarr;</a>
        </div>
        <div class="alert-box">
          🔒 This link expires in 1 hour. If you did not make this request, your account remains secure and you can ignore this email.
        </div>
        <p class="fallback">
          Direct link: <a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a>
        </p>
      </div>
      <div class="footer">
        <p style="margin:0;">Socratix AI Platform — Meta AI Hackathon 2026</p>
      </div>
    </div>
  </div>
</body>
</html>
```

---

### Template 3: Magic Link

- **Subject:** `✨ Your Socratix AI instant login link`
- **Body (HTML):**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Socratix Login Link</title>
  <style>
    body { margin:0; padding:0; background-color:#0b0f19; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#f1f5f9; }
    .wrapper { width:100%; background-color:#0b0f19; padding:40px 16px; box-sizing:border-box; }
    .card { max-width:580px; margin:0 auto; background-color:#111827; border-radius:20px; border:1px solid #1f2937; }
    .header { background:linear-gradient(135deg, #10b981 0%, #059669 100%); padding:32px; text-align:center; color:#ffffff; }
    .content { padding:32px; }
    .btn-container { text-align:center; margin:28px 0; }
    .btn { display:inline-block; background-color:#10b981; color:#042f2e !important; font-size:15px; font-weight:800; text-decoration:none; padding:15px 32px; border-radius:10px; }
    .footer { padding:20px; background-color:#0b0f19; border-top:1px solid #1f2937; text-align:center; font-size:12px; color:#64748b; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1 style="margin:0; font-size:22px;">Socratix AI</h1>
        <p style="margin:4px 0 0 0; font-size:12px; color:#d1fae5; text-transform:uppercase;">Instant Sign In</p>
      </div>
      <div class="content">
        <h2 style="font-size:18px; color:#ffffff; margin:0 0 12px 0;">Sign in to Socratix</h2>
        <p style="color:#94a3b8; font-size:14px; line-height:1.6;">Click the button below to sign in instantly without a password:</p>
        <div class="btn-container">
          <a href="{{ .ConfirmationURL }}" class="btn" target="_blank">Sign In Now &rarr;</a>
        </div>
        <p style="color:#64748b; font-size:12px; word-break:break-all;">Direct link: <a href="{{ .ConfirmationURL }}" style="color:#10b981;">{{ .ConfirmationURL }}</a></p>
      </div>
      <div class="footer">
        <p style="margin:0;">Socratix AI Platform — Meta AI Hackathon 2026</p>
      </div>
    </div>
  </div>
</body>
</html>
```

