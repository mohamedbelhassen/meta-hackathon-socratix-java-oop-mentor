import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import { invalidateCourseCache } from '@/lib/course-cache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { courseId, labId } = body;

    if (!courseId || !labId) {
      return NextResponse.json({ error: 'Missing courseId or labId' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { error: delError } = await supabase
      .from('labs')
      .delete()
      .eq('id', labId)
      .eq('course_id', courseId);

    if (delError) {
      console.error('[Lab Delete Error]:', delError);
      return NextResponse.json({ error: delError.message }, { status: 500 });
    }

    // Invalidate course bundle cache
    invalidateCourseCache(courseId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[Lab Delete Exception]:', err);
    const msg = err instanceof Error ? err.message : 'Failed to delete lab';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

