import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
import { sendSystemEmail, notifyAdminNewUser } from '@/lib/email/sender';
import { getWelcomeVerificationTemplate } from '@/lib/email/templates';
import { getAppBaseUrl } from '@/lib/url-utils';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting by IP: maximum 3 requests per minute to prevent email flooding
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(`send-verification:${clientIp}`, 3, 60);
    if (!rateCheck.success) {
      return NextResponse.json(
        {
          error: 'Trop de demandes de vérification envoyées. Veuillez patienter une minute avant de réessayer.',
          retryAfter: rateCheck.resetSeconds,
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const displayName = typeof body.displayName === 'string' && body.displayName.trim() ? body.displayName.trim() : rawEmail.split('@')[0] || 'User';
    const role: 'teacher' | 'student' = body.role === 'teacher' ? 'teacher' : 'student';
    const isNewRegistration = body.isNewRegistration !== false;

    if (!rawEmail || !rawEmail.includes('@') || !rawEmail.includes('.')) {
      return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 });
    }

    const baseUrl = getAppBaseUrl();
    const nextPath = '/';
    const redirectTo = `${baseUrl}/auth/callback?next=${nextPath}`;

    // 2. Generate Supabase Admin link without triggering Supabase built-in mailer
    const adminSupabase = getServiceSupabase();

    // Try magiclink first (validates existing user & signs them in), fallback to invite/recovery if needed
    let linkData: { properties?: { hashed_token?: string; action_link?: string } } | null = null;
    let linkType = 'magiclink';

    const magicResult = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email: rawEmail,
      options: {
        redirectTo,
      },
    });

    if (!magicResult.error && magicResult.data?.properties) {
      linkData = magicResult.data;
      linkType = 'magiclink';
    } else {
      // Fallback: try recovery link if magiclink generation fails
      const recoveryResult = await adminSupabase.auth.admin.generateLink({
        type: 'recovery',
        email: rawEmail,
        options: {
          redirectTo,
        },
      });
      if (!recoveryResult.error && recoveryResult.data?.properties) {
        linkData = recoveryResult.data;
        linkType = 'recovery';
      } else {
        console.warn('[Send Verification API] Admin link generation error:', magicResult.error || recoveryResult.error);
        return NextResponse.json(
          {
            error:
              magicResult.error?.message ||
              recoveryResult.error?.message ||
              'Impossible de générer le jeton de sécurité pour cette adresse email.',
          },
          { status: 400 }
        );
      }
    }

    // 3. Construct the direct verification URL
    let confirmationUrl: string;
    if (linkData?.properties?.hashed_token) {
      confirmationUrl = `${baseUrl}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=${linkType}&next=${nextPath}`;
    } else if (linkData?.properties?.action_link) {
      confirmationUrl = linkData.properties.action_link;
    } else {
      return NextResponse.json({ error: 'Jeton de vérification manquant dans la réponse.' }, { status: 500 });
    }

    // 4. Render branded Socratix HTML template
    const template = getWelcomeVerificationTemplate({
      displayName,
      confirmationUrl,
      role,
    });

    // 5. Send via Brevo REST API gateway
    const sendResult = await sendSystemEmail({
      to: rawEmail,
      subject: template.subject,
      htmlContent: template.html,
      textContent: template.text,
      tags: ['socratix', 'auth', 'verification', role],
    });

    // 6. Notify administrator of new registration (if enabled and applicable)
    if (isNewRegistration) {
      notifyAdminNewUser({
        userEmail: rawEmail,
        displayName,
        role,
        ipAddress: clientIp,
        dashboardUrl: `${baseUrl}/teacher`,
      }).catch((adminErr) => {
        console.warn('[Send Verification API] Admin notification warning:', adminErr);
      });
    }

    if (sendResult.success) {
      return NextResponse.json({
        success: true,
        message: 'Email de vérification envoyé avec succès via Brevo.',
        messageId: sendResult.messageId,
      });
    } else {
      // If Brevo is not configured in env, indicate gracefully
      const isMissingConfig = sendResult.error?.includes('missing');
      return NextResponse.json(
        {
          success: false,
          configured: !isMissingConfig,
          error: sendResult.error || "Erreur lors de l'envoi de l'email via Brevo.",
        },
        { status: isMissingConfig ? 200 : 502 }
      );
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[Send Verification API] Unhandled exception:', errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
