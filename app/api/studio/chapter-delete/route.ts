import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import { invalidateCourseCache } from '@/lib/course-cache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { courseId, chapterId } = body;

    if (!courseId || !chapterId) {
      return NextResponse.json({ error: 'Missing courseId or chapterId' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { error: delError } = await supabase
      .from('course_chapters')
      .delete()
      .eq('id', chapterId)
      .eq('course_id', courseId);

    if (delError) {
      console.error('[Chapter Delete Error]:', delError);
      return NextResponse.json({ error: delError.message }, { status: 500 });
    }

    // Invalidate course bundle cache
    invalidateCourseCache(courseId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[Chapter Delete Exception]:', err);
    const msg = err instanceof Error ? err.message : 'Failed to delete chapter';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

