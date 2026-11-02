import { NextRequest, NextResponse } from 'next/server';
import { getTypedServiceSupabase } from '@/lib/supabase-admin';
import { notifyAdminNewUser } from '@/lib/email/sender';
import { getAppBaseUrl } from '@/lib/url-utils';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing or malformed authorization header.' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: Empty bearer token.' },
        { status: 401 }
      );
    }

    const supabase = getTypedServiceSupabase();
    const { data: authData, error: authErr } = await supabase.auth.getUser(token);

    if (authErr || !authData?.user) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or expired session token.' },
        { status: 401 }
      );
    }

    const user = authData.user;
    if (!user.id || !user.email) {
      return NextResponse.json(
        { error: 'User identity incomplete.' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));

    // Sanitize display_name: prefer body if non-empty string, fallback to user_metadata or email prefix
    const rawDisplayName =
      typeof body.display_name === 'string' && body.display_name.trim().length > 0
        ? body.display_name.trim()
        : typeof user.user_metadata?.display_name === 'string' &&
            user.user_metadata.display_name.trim().length > 0
          ? user.user_metadata.display_name.trim()
          : user.email.split('@')[0];
    const cleanName = rawDisplayName.slice(0, 80);

    // Look up existing profile to preserve legitimate permissions and protect demo personas
    const { data: existing, error: fetchErr } = await supabase
      .from('profiles')
      .select('id, role, is_guest')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchErr) {
      console.error('[Sync Profile] Fetch existing error:', fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    // Protection 1: Demo guest personas (Bob, Alice, Ines, Explorer) must not be mutated via sync-profile
    if (existing?.is_guest) {
      return NextResponse.json(
        { error: 'Cannot mutate guest demo persona profile.' },
        { status: 403 }
      );
    }

    // Protection 2: Never trust arbitrary client role promotion.
    // - If the account already holds 'teacher' in profiles, preserve it.
    // - If creating a brand new profile without an existing record, only grant 'teacher' if teacher_pin matches '2026'.
    // - Otherwise, default strictly to 'student'.
    const teacherPinEnv = process.env.TEACHER_SIGNUP_PIN || '2026';
    const providedPin = body.teacher_pin || user.user_metadata?.teacher_pin;
    const isTeacherAuthorized =
      existing?.role === 'teacher' ||
      (!existing &&
        (user.user_metadata?.role === 'teacher' || body.role === 'teacher') &&
        providedPin === teacherPinEnv);

    const safeRole: 'student' | 'teacher' = isTeacherAuthorized ? 'teacher' : 'student';

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: user.email,
          display_name: cleanName,
          role: safeRole,
          is_guest: false,
        },
        { onConflict: 'id' }
      )
      .select('id, email, display_name, role, is_guest')
      .single();

    if (error) {
      console.error('[Sync Profile] Supabase upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (body.is_new_signup) {
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
      const baseUrl = getAppBaseUrl();
      notifyAdminNewUser({
        userEmail: user.email,
        displayName: cleanName,
        role: safeRole,
        ipAddress: clientIp,
        dashboardUrl: `${baseUrl}/teacher`,
      }).catch((adminErr) => {
        console.warn('[Sync Profile] Admin notification warning:', adminErr);
      });
    }

    return NextResponse.json({ success: true, profile: data });
  } catch (err: unknown) {
    console.error('[Sync Profile] Exception:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
