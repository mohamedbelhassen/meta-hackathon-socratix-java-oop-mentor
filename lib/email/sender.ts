import 'server-only';
import { getAdminNewUserNotificationTemplate } from './templates';

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailOptions {
  to: string | string[] | EmailRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  senderName?: string;
  senderEmail?: string;
  replyTo?: { email: string; name?: string };
  tags?: string[];
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Strips accidental wrapping quotes (single or double) and extra whitespace.
 */
function sanitizeEnv(val?: string): string {
  if (!val) return '';
  return val.trim().replace(/^["']|["']$/g, '').trim();
}

/**
 * Normalizes recipients into Brevo API format: [{ email: string, name?: string }]
 */
function normalizeRecipients(to: EmailOptions['to']): EmailRecipient[] {
  if (typeof to === 'string') {
    return [{ email: to.trim().toLowerCase() }];
  }
  if (Array.isArray(to)) {
    return to.map((item) => {
      if (typeof item === 'string') {
        return { email: item.trim().toLowerCase() };
      }
      return {
        email: item.email.trim().toLowerCase(),
        name: item.name?.trim(),
      };
    });
  }
  return [];
}

/**
 * Sends a transactional email through Brevo REST API v3.
 * Server-only module protected from client bundle inclusion.
 */
export async function sendSystemEmail(options: EmailOptions): Promise<EmailSendResult> {
  const apiKey = sanitizeEnv(process.env.BREVO_API_KEY);
  const defaultSenderEmail = sanitizeEnv(process.env.BREVO_SENDER_EMAIL);
  const defaultSenderName = sanitizeEnv(process.env.BREVO_SENDER_NAME) || 'Socratix AI Mentor';

  if (!apiKey || !defaultSenderEmail) {
    const errorMsg =
      'Brevo configuration missing: please set BREVO_API_KEY and BREVO_SENDER_EMAIL in your environment variables.';
    console.warn(`[Brevo Email Gateway] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  // Guard against unreplaced placeholder keys
  if (apiKey.includes('votre-cle') || apiKey.includes('your-brevo') || apiKey.startsWith('xsmtpsib-')) {
    const errorMsg = apiKey.startsWith('xsmtpsib-')
      ? 'BREVO_API_KEY starts with "xsmtpsib-" (SMTP key). For the REST API v3, use your Brevo API key "xkeysib-...".'
      : 'BREVO_API_KEY still contains a placeholder value. Please update it with your real Brevo v3 API key (xkeysib-...).';
    console.error(`[Brevo Email Gateway] Configuration Error: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const recipients = normalizeRecipients(options.to);
  if (recipients.length === 0) {
    return { success: false, error: 'No valid recipient specified.' };
  }

  const sender = {
    email: sanitizeEnv(options.senderEmail) || defaultSenderEmail,
    name: sanitizeEnv(options.senderName) || defaultSenderName,
  };

  const payload: Record<string, unknown> = {
    sender,
    to: recipients,
    subject: options.subject,
    htmlContent: options.htmlContent,
  };

  if (options.textContent) {
    payload.textContent = options.textContent;
  }

  if (options.replyTo) {
    payload.replyTo = options.replyTo;
  }

  if (options.tags && options.tags.length > 0) {
    payload.tags = options.tags;
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok) {
      console.log(
        `[Brevo Email Gateway] Successfully sent email "${options.subject}" to ${recipients.map((r) => r.email).join(', ')} (Message ID: ${result.messageId})`
      );
      return {
        success: true,
        messageId: result.messageId,
      };
    } else {
      let errorDetail = result.message || JSON.stringify(result);

      // Translate Brevo's standard unauthorized message into actionable guidance
      if (result.message === 'Key not found' || result.code === 'unauthorized') {
        errorDetail =
          'Brevo API key not found (Key not found). Verify that BREVO_API_KEY on Vercel is set to your v3 API key (xkeysib-...) without quotes, not an SMTP key.';
      }

      console.error(`[Brevo Email Gateway] API error (${response.status}): ${errorDetail}`);
      return {
        success: false,
        error: errorDetail,
      };
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown network error';
    console.error(`[Brevo Email Gateway] Network exception: ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Dispatches a notification to the administrator (configured via ADMIN_NOTIFICATION_EMAIL)
 * whenever a new user registers on the platform.
 */
export async function notifyAdminNewUser(params: {
  userEmail: string;
  displayName: string;
  role: 'teacher' | 'student';
  ipAddress?: string;
  dashboardUrl?: string;
}): Promise<EmailSendResult> {
  const adminEmail = sanitizeEnv(process.env.ADMIN_NOTIFICATION_EMAIL);
  if (!adminEmail) {
    console.log('[Admin Notification] ADMIN_NOTIFICATION_EMAIL is not configured in env, skipping admin alert.');
    return { success: false, error: 'ADMIN_NOTIFICATION_EMAIL not configured' };
  }

  const template = getAdminNewUserNotificationTemplate(params);
  return sendSystemEmail({
    to: adminEmail,
    subject: template.subject,
    htmlContent: template.html,
    textContent: template.text,
    tags: ['socratix', 'admin', 'new-registration', params.role],
  });
}
