import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIp } from '@/lib/rate-limiter';
import { sendSystemEmail, notifyAdminNewUser } from '@/lib/email/sender';
import { getWelcomeVerificationTemplate } from '@/lib/email/templates';
import { getAppBaseUrl } from '@/lib/url-utils';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting by IP: maximum 5 registration requests per minute
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(`register:${clientIp}`, 5, 60);
    if (!rateCheck.success) {
      return NextResponse.json(
        {
          error: 'Too many registration attempts. Please wait a minute before retrying.',
          retryAfter: rateCheck.resetSeconds,
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const rawDisplayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    const role: 'teacher' | 'student' = body.role === 'teacher' ? 'teacher' : 'student';
    const teacherPin = typeof body.teacherPin === 'string' ? body.teacherPin.trim() : '';

    // 2. Validate input fields
    if (!rawEmail || !rawEmail.includes('@') || !rawEmail.includes('.')) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
    }

    const cleanDisplayName = rawDisplayName || rawEmail.split('@')[0] || 'User';

    // 3. Teacher PIN verification
    if (role === 'teacher') {
      const teacherPinEnv = process.env.TEACHER_SIGNUP_PIN || '2026';
      if (!teacherPin || teacherPin !== teacherPinEnv) {
        return NextResponse.json(
          { error: 'Invalid Teacher Secret PIN. Please verify the PIN to register as an instructor.' },
          { status: 403 }
        );
      }
    }

    const baseUrl = getAppBaseUrl();
    const nextPath = '/';
    const redirectTo = `${baseUrl}/auth/callback?next=${nextPath}`;

    // 4. Generate Supabase signup link via Admin Auth without triggering Supabase built-in mailer
    const adminSupabase = getServiceSupabase();

    const signupResult = await adminSupabase.auth.admin.generateLink({
      type: 'signup',
      email: rawEmail,
      password,
      options: {
        data: {
          name: cleanDisplayName,
          full_name: cleanDisplayName,
          display_name: cleanDisplayName,
          role,
          teacher_pin: role === 'teacher' ? teacherPin : undefined,
        },
        redirectTo,
      },
    });

    if (signupResult.error || !signupResult.data?.properties) {
      const err = signupResult.error;
      console.warn('[Register API] Admin signup error:', err);

      // Handle duplicate email case
      const isDuplicate =
        err?.code === 'email_exists' ||
        err?.message?.toLowerCase().includes('already been registered') ||
        err?.message?.toLowerCase().includes('already exists');

      if (isDuplicate) {
        return NextResponse.json(
          {
            error:
              'An account with this email address already exists. Please sign in or use the "Resend via Brevo" link below.',
            isExistingUser: true,
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: err?.message || 'Failed to create account. Please verify your details.' },
        { status: 400 }
      );
    }

    const linkData = signupResult.data;
    const userId = linkData.user?.id;

    // 5. Construct the direct verification URL
    let confirmationUrl: string;
    if (linkData.properties.hashed_token) {
      confirmationUrl = `${baseUrl}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=signup&next=${nextPath}`;
    } else if (linkData.properties.action_link) {
      confirmationUrl = linkData.properties.action_link;
    } else {
      return NextResponse.json({ error: 'Missing verification token in auth response.' }, { status: 500 });
    }

    // 6. Pre-seed public profile record
    if (userId) {
      try {
        await adminSupabase
          .from('profiles')
          .upsert(
            {
              id: userId,
              email: rawEmail,
              display_name: cleanDisplayName,
              role,
              is_guest: false,
            },
            { onConflict: 'id' }
          );
      } catch (dbErr) {
        console.warn('[Register API] Profile pre-creation warning:', dbErr);
      }
    }

    // 7. Render branded Socratix HTML template
    const template = getWelcomeVerificationTemplate({
      displayName: cleanDisplayName,
      confirmationUrl,
      role,
    });

    // 8. Send verification email via Brevo REST API gateway
    const sendResult = await sendSystemEmail({
      to: rawEmail,
      subject: template.subject,
      htmlContent: template.html,
      textContent: template.text,
      tags: ['socratix', 'auth', 'registration', role],
    });

    if (!sendResult.success) {
      console.warn('[Register API] Brevo dispatch warning:', sendResult.error);
    }

    // 9. Notify administrator of new registration
    notifyAdminNewUser({
      userEmail: rawEmail,
      displayName: cleanDisplayName,
      role,
      ipAddress: clientIp,
      dashboardUrl: `${baseUrl}/teacher`,
    }).catch((adminErr) => {
      console.warn('[Register API] Admin notification warning:', adminErr);
    });

    return NextResponse.json({
      success: true,
      message:
        'Account created! A confirmation email has been dispatched via Brevo. Please check your inbox (and spam folder) to activate your account.',
      emailSent: sendResult.success,
    });
  } catch (error: unknown) {
    console.error('[Register API] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
