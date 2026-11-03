import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import { invalidateCourseCache } from '@/lib/course-cache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { courseId, labs } = body;

    if (!courseId || !Array.isArray(labs) || labs.length === 0) {
      return NextResponse.json({ error: 'Missing courseId or labs array' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Update each lab's sequence number
    for (const lb of labs) {
      if (!lb.id || typeof lb.lab_number !== 'number') continue;
      await supabase
        .from('labs')
        .update({ lab_number: lb.lab_number })
        .eq('id', lb.id)
        .eq('course_id', courseId);
    }

    invalidateCourseCache(courseId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[Labs Reorder Exception]:', err);
    const msg = err instanceof Error ? err.message : 'Failed to reorder labs';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

