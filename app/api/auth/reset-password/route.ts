import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
import { sendSystemEmail } from '@/lib/email/sender';
import { getPasswordResetTemplate } from '@/lib/email/templates';
import { getAppBaseUrl } from '@/lib/url-utils';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting by IP: maximum 3 requests per minute to prevent abuse
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(`reset-password:${clientIp}`, 3, 60);
    if (!rateCheck.success) {
      return NextResponse.json(
        {
          error: 'Too many password reset requests. Please wait a minute before retrying.',
          retryAfter: rateCheck.resetSeconds,
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!rawEmail || !rawEmail.includes('@') || !rawEmail.includes('.')) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const baseUrl = getAppBaseUrl();
    const redirectTo = `${baseUrl}/auth/callback?next=/reset-password`;

    // 2. Lookup existing profile to personalize email greeting
    const adminSupabase = getServiceSupabase();
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('display_name')
      .eq('email', rawEmail)
      .maybeSingle();

    const displayName = profile?.display_name || rawEmail.split('@')[0] || 'User';

    // 3. Generate secure recovery token link via Supabase Admin Auth
    const recoveryResult = await adminSupabase.auth.admin.generateLink({
      type: 'recovery',
      email: rawEmail,
      options: {
        redirectTo,
      },
    });

    if (recoveryResult.error || !recoveryResult.data?.properties) {
      console.warn('[Password Reset API] Recovery link generation error:', recoveryResult.error);
      return NextResponse.json(
        {
          error: recoveryResult.error?.message || 'Unable to generate password reset link for this email.',
          fallbackToClient: true,
        },
        { status: 400 }
      );
    }

    // 4. Construct direct recovery URL
    let resetUrl: string;
    if (recoveryResult.data.properties.hashed_token) {
      resetUrl = `${baseUrl}/auth/callback?token_hash=${recoveryResult.data.properties.hashed_token}&type=recovery&next=/reset-password`;
    } else if (recoveryResult.data.properties.action_link) {
      resetUrl = recoveryResult.data.properties.action_link;
    } else {
      return NextResponse.json(
        { error: 'Missing recovery token in auth response.', fallbackToClient: true },
        { status: 500 }
      );
    }

    // 5. Render branded Socratix HTML template
    const template = getPasswordResetTemplate({
      displayName,
      resetUrl,
    });

    // 6. Send via Brevo REST API gateway
    const sendResult = await sendSystemEmail({
      to: rawEmail,
      subject: template.subject,
      htmlContent: template.html,
      textContent: template.text,
      tags: ['socratix', 'auth', 'password-reset'],
    });

    if (sendResult.success) {
      return NextResponse.json({
        success: true,
        message: 'Password reset link sent successfully via Brevo.',
        messageId: sendResult.messageId,
      });
    } else {
      console.warn('[Password Reset API] Brevo dispatch failed, falling back:', sendResult.error);
      return NextResponse.json(
        {
          success: false,
          fallbackToClient: true,
          error: sendResult.error || 'Failed to dispatch password reset email via Brevo.',
        },
        { status: 200 }
      );
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[Password Reset API] Unhandled exception:', errorMsg);
    return NextResponse.json({ error: errorMsg, fallbackToClient: true }, { status: 500 });
  }
}

