import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { verifyDestructiveActionPermission } from '@/lib/auth-guard';

export async function GET() {
  try {
    const supabase = getServiceSupabase();
    const { data: courses, error } = await supabase
      .from('courses')
      .select(`
        *,
        course_chapters (id, chapter_number, code, title, pdf_url),
        labs (id, lab_number, code, title, is_active, covered_micro_concepts)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ courses });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch courses';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      code,
      title,
      description,
      content_language = 'fr',
      tutor_language = 'en',
      file_extensions = ['.java'],
      stuck_threshold_turns = 2,
    } = body;

    if (!code || !title) {
      return NextResponse.json({ error: 'Course code and title are required.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const payload = {
      code: code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
      title: title.trim(),
      description: description?.trim() || null,
      content_language,
      tutor_language,
      file_extensions,
      stuck_threshold_turns: Number(stuck_threshold_turns) || 2,
      is_published: true,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (id) {
      // Update
      const { data, error } = await supabase
        .from('courses')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      // Insert
      const { data, error } = await supabase
        .from('courses')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    return NextResponse.json({ course: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save course';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const guard = await verifyDestructiveActionPermission(req);
    if (!guard.authorized) {
      return NextResponse.json({ error: guard.error }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing course id parameter.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true, deletedCourseId: id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete course';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      courseId,
      action,
      conceptCode,
      chapterCode,
      targetConceptCode,
      title,
      slideRef,
      description,
      competency_matrix,
    } = body;

    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { data: course, error: fetchErr } = await supabase
      .from('courses')
      .select('id, competency_matrix')
      .eq('id', courseId)
      .single();

    if (fetchErr || !course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    type ChapterTaxonomy = {
      chapter_code: string;
      competency_title: string;
      micro_competencies: Array<{
        code: string;
        title: string;
        slide_ref?: string;
        description?: string;
        aliases?: string[];
      }>;
    };

    let matrix: ChapterTaxonomy[] = Array.isArray(course.competency_matrix)
      ? (course.competency_matrix as ChapterTaxonomy[])
      : [];

    if (action === 'assign_to_chapter') {
      if (!chapterCode || !conceptCode) {
        return NextResponse.json({ error: 'chapterCode and conceptCode are required.' }, { status: 400 });
      }

      const formattedCode = conceptCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      const humanTitle = title?.trim() || formattedCode.replace(/_/g, ' ');

      matrix = matrix.map((ch) => {
        if (ch.chapter_code === chapterCode) {
          const exists = ch.micro_competencies?.some((mc) => mc.code === formattedCode);
          if (!exists) {
            return {
              ...ch,
              micro_competencies: [
                ...(ch.micro_competencies || []),
                {
                  code: formattedCode,
                  title: humanTitle,
                  slide_ref: slideRef?.trim() || 'Assigned from Lab (Practical)',
                  description: description?.trim() || 'Practical competency from TP lab assigned to chapter syllabus.',
                  aliases: [],
                },
              ],
            };
          }
        }
        return ch;
      });
    } else if (action === 'link_alias') {
      if (!targetConceptCode || !conceptCode) {
        return NextResponse.json({ error: 'targetConceptCode and conceptCode are required.' }, { status: 400 });
      }

      const formattedAlias = conceptCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');

      matrix = matrix.map((ch) => ({
        ...ch,
        micro_competencies: (ch.micro_competencies || []).map((mc) => {
          if (mc.code === targetConceptCode) {
            const currentAliases = mc.aliases || [];
            if (!currentAliases.includes(formattedAlias) && formattedAlias !== mc.code) {
              return {
                ...mc,
                aliases: [...currentAliases, formattedAlias],
              };
            }
          }
          return mc;
        }),
      }));
    } else if (action === 'update_matrix' && Array.isArray(competency_matrix)) {
      matrix = competency_matrix;
    } else {
      return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await supabase
      .from('courses')
      .update({
        competency_matrix: matrix,
        updated_at: new Date().toISOString(),
      })
      .eq('id', courseId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({ course: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update competency matrix';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
