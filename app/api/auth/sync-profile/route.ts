import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, email, display_name, role } = body;

    if (!id || !email) {
      return NextResponse.json(
        { error: 'id and email are required to sync profile.' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id,
          email,
          display_name: display_name || email.split('@')[0],
          role: role === 'teacher' ? 'teacher' : 'student',
          is_guest: false,
        },
        { onConflict: 'id' }
      )
      .select()
      .single();

    if (error) {
      console.error('[Sync Profile] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
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

