export interface WelcomeEmailParams {
  displayName: string;
  confirmationUrl: string;
  role: 'teacher' | 'student';
}

export interface PasswordResetEmailParams {
  displayName: string;
  resetUrl: string;
}

export interface TeacherAlertEmailParams {
  teacherName: string;
  studentName: string;
  labTitle: string;
  issueDescription: string;
  dashboardUrl?: string;
}

/**
 * Returns an HTML email template for account verification / welcome on Socratix.
 */
export function getWelcomeVerificationTemplate(params: WelcomeEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { displayName, confirmationUrl, role } = params;
  const roleLabel = role === 'teacher' ? 'Enseignant / Mentor' : 'Étudiant';
  const subject = `🦉 Confirmez votre compte Socratix — ${roleLabel}`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
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
        <p class="brand-subtitle">Plateforme Pédagogique Intelligente</p>
      </div>
      <div class="content">
        <span class="role-badge">Profil ${roleLabel}</span>
        <h2 class="greeting">Bienvenue, ${displayName} !</h2>
        <p class="text">
          Votre compte a été initialisé sur Socratix. Pour finaliser votre inscription et accéder à vos espaces de TP avec le mentor IA socratique, veuillez confirmer votre adresse email :
        </p>
        <div class="btn-container">
          <a href="${confirmationUrl}" class="btn" target="_blank">Confirmer mon adresse email &rarr;</a>
        </div>
        <div class="alert-box">
          🔒 <strong>Lien sécurisé à usage unique :</strong> Ce lien expirera après 24 heures. Si vous n&apos;êtes pas à l&apos;origine de cette demande, vous pouvez ignorer ce message.
        </div>
        <p class="fallback">
          Si le bouton ne fonctionne pas, copiez et collez le lien direct suivant dans votre navigateur :<br>
          <a href="${confirmationUrl}">${confirmationUrl}</a>
        </p>
      </div>
      <div class="footer">
        <p style="margin: 0 0 6px 0;">Socratix AI — Mentor OOP &amp; Assistant Pédagogique Intelligent</p>
        <p style="margin: 0;">Développé pour le Hackathon Meta AI 2026</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Bienvenue sur Socratix, ${displayName} !

Votre compte (${roleLabel}) a été créé. Pour confirmer votre adresse email et accéder à la plateforme, veuillez cliquer sur ce lien :
${confirmationUrl}

Ce lien est sécurisé et valable 24 heures.
  `.trim();

  return { subject, html, text };
}

/**
 * Returns an HTML email template for password reset.
 */
export function getPasswordResetTemplate(params: PasswordResetEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { displayName, resetUrl } = params;
  const subject = `🔐 Réinitialisation de votre mot de passe — Socratix AI`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
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
        <p style="margin:6px 0 0 0; font-size:13px; color:#bfdbfe; text-transform:uppercase;">Sécurité du compte</p>
      </div>
      <div class="content">
        <h2 class="greeting">Bonjour ${displayName},</h2>
        <p class="text">
          Une demande de réinitialisation de mot de passe a été demandée pour votre compte Socratix.
        </p>
        <div class="btn-container">
          <a href="${resetUrl}" class="btn" target="_blank">Définir un nouveau mot de passe &rarr;</a>
        </div>
        <div class="alert-box">
          🔒 Ce lien expire après 1 heure. Si vous n&apos;avez pas initié cette demande, aucune action n&apos;est requise de votre part.
        </div>
        <p class="fallback">
          Lien direct : <a href="${resetUrl}">${resetUrl}</a>
        </p>
      </div>
      <div class="footer">
        <p style="margin:0;">Socratix AI Platform</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Bonjour ${displayName},

Pour réinitialiser votre mot de passe Socratix, suivez ce lien :
${resetUrl}

Ce lien est valable 1 heure.
  `.trim();

  return { subject, html, text };
}

/**
 * Returns an HTML email template for alerting a teacher when a student is stuck.
 */
export function getTeacherAlertTemplate(params: TeacherAlertEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { teacherName, studentName, labTitle, issueDescription, dashboardUrl } = params;
  const subject = `⚠️ Alerte Socratix : L'étudiant ${studentName} est bloqué sur « ${labTitle} »`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
</head>
<body style="font-family:sans-serif; background-color:#0b0f19; color:#f1f5f9; padding:24px;">
  <div style="max-width:560px; margin:0 auto; background:#111827; border:1px solid #1f2937; border-radius:16px; padding:28px;">
    <h2 style="color:#f59e0b; margin-top:0;">⚠️ Alerte Pédagogique Socratix</h2>
    <p>Bonjour <strong>${teacherName}</strong>,</p>
    <p>L&apos;étudiant <strong>${studentName}</strong> rencontre des difficultés répétées sur le TP <em>« ${labTitle} »</em> :</p>
    <div style="background:#1f2937; padding:14px; border-radius:8px; margin:16px 0; font-size:14px; color:#cbd5e1;">
      ${issueDescription}
    </div>
    ${
      dashboardUrl
        ? `<div style="text-align:center; margin:24px 0;">
            <a href="${dashboardUrl}" style="background:#10b981; color:#042f2e; font-weight:bold; padding:12px 24px; border-radius:8px; text-decoration:none;">
              Consulter la session en direct &rarr;
            </a>
          </div>`
        : ''
    }
    <p style="font-size:12px; color:#64748b; margin-top:24px;">Notification automatique émise par Socratix AI Mentor.</p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Bonjour ${teacherName},

L'étudiant ${studentName} est bloqué sur le TP "${labTitle}" :
${issueDescription}

Consultez le Teacher Live Sessions Tab pour intervenir.
  `.trim();

  return { subject, html, text };
}
