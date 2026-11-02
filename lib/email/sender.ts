import 'server-only';

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
  const apiKey = process.env.BREVO_API_KEY;
  const defaultSenderEmail = process.env.BREVO_SENDER_EMAIL;
  const defaultSenderName = process.env.BREVO_SENDER_NAME || 'Socratix AI Mentor';

  if (!apiKey || !defaultSenderEmail) {
    const errorMsg =
      'Brevo email configuration missing: please set BREVO_API_KEY and BREVO_SENDER_EMAIL in your environment variables.';
    console.warn(`[Brevo Email Gateway] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const recipients = normalizeRecipients(options.to);
  if (recipients.length === 0) {
    return { success: false, error: 'No valid recipient email provided.' };
  }

  const sender = {
    email: options.senderEmail || defaultSenderEmail,
    name: options.senderName || defaultSenderName,
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
      const errorDetail = result.message || JSON.stringify(result);
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
