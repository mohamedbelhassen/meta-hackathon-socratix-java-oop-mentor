import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import { invalidateCourseCache } from '@/lib/course-cache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { courseId, chapters } = body;

    if (!courseId || !Array.isArray(chapters) || chapters.length === 0) {
      return NextResponse.json({ error: 'Missing courseId or chapters array' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Update each chapter's sequence number
    for (const ch of chapters) {
      if (!ch.id || typeof ch.chapter_number !== 'number') continue;
      await supabase
        .from('course_chapters')
        .update({ chapter_number: ch.chapter_number })
        .eq('id', ch.id)
        .eq('course_id', courseId);
    }

    invalidateCourseCache(courseId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[Chapters Reorder Exception]:', err);
    const msg = err instanceof Error ? err.message : 'Failed to reorder chapters';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

