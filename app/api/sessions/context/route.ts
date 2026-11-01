import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { StudentLabSession, ChatMessage, CourseChapter } from '@/types/socratix';
import { formatRawSlideTextToMarkdown } from '@/lib/pdf-cleaner';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('studentId');
    const labId = searchParams.get('labId');

    if (!studentId || !labId) {
      return NextResponse.json(
        { error: 'studentId and labId query parameters are required.' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Fetch session
    const { data: sessionData, error: sessionError } = await supabase
      .from('student_lab_sessions')
      .select('*, profiles(display_name, is_guest, email)')
      .eq('student_id', studentId)
      .eq('lab_id', labId)
      .maybeSingle();

    if (sessionError) {
      console.error('[Session Context GET] Error:', sessionError);
      return NextResponse.json({ error: 'Failed to fetch session.' }, { status: 500 });
    }

    if (!sessionData) {
      return NextResponse.json({ session: null, messages: [] });
    }

    const session = sessionData as StudentLabSession;

    // Fetch chat history for this session
    const { data: messagesData, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('student_lab_session_id', session.id)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('[Session Context GET] Chat messages error:', messagesError);
    }

    const rawMessages = (messagesData || []) as ChatMessage[];
    let hydratedMessages = rawMessages;

    // Check if any message has course_reference that needs slide_markdown enrichment
    const hasRefs = rawMessages.some((m) => m.course_reference?.chapter_code && m.course_reference?.page_number);
    if (hasRefs) {
      const { data: chaptersData } = await supabase
        .from('course_chapters')
        .select('code, pdf_url, pages_json')
        .eq('course_id', session.course_id);

      const chapters = (chaptersData || []) as CourseChapter[];
      if (chapters.length > 0) {
        hydratedMessages = rawMessages.map((msg) => {
          if (!msg.course_reference?.chapter_code || !msg.course_reference?.page_number) {
            return msg;
          }
          const refChap = chapters.find((c) => c.code === msg.course_reference!.chapter_code);
          if (!refChap) return msg;

          const slidePage = refChap.pages_json?.find((p) => p.page === msg.course_reference!.page_number);
          const pdfUrl = refChap.pdf_url || msg.course_reference.pdf_url;
          const currentSlideMd = msg.course_reference.slide_markdown;

          const frClean = currentSlideMd?.fr || slidePage?.fr_markdown?.trim() || (slidePage?.text ? formatRawSlideTextToMarkdown(slidePage.text) : undefined);
          const enClean = currentSlideMd?.en || slidePage?.en_markdown?.trim() || undefined;

          return {
            ...msg,
            course_reference: {
              ...msg.course_reference,
              pdf_url: pdfUrl,
              slide_markdown: {
                en: enClean,
                fr: frClean,
              },
            },
          };
        });
      }
    }

    return NextResponse.json({
      session,
      messages: hydratedMessages,
    });
  } catch (error) {
    console.error('[Session Context GET] Exception:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentId, labId, seatLabel, currentActivityId } = body;

    if (!studentId || !labId) {
      return NextResponse.json(
        { error: 'studentId and labId are required.' },
        { status: 400 }
      );
    }

    const updateFields: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof seatLabel === 'string' && seatLabel.trim()) {
      updateFields.seat_label = seatLabel.trim();
    }
    if (typeof currentActivityId === 'string' && currentActivityId.trim()) {
      updateFields.current_activity_id = currentActivityId.trim();
    }

    const supabase = getServiceSupabase();

    const { data: updatedSession, error } = await supabase
      .from('student_lab_sessions')
      .update(updateFields)
      .eq('student_id', studentId)
      .eq('lab_id', labId)
      .select('*, profiles(display_name, is_guest, email)')
      .maybeSingle();

    if (error) {
      console.error('[Session Context PATCH] Error:', error);
      return NextResponse.json({ error: 'Failed to update session context.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      session: updatedSession as StudentLabSession | null,
    });
  } catch (error) {
    console.error('[Session Context PATCH] Exception:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
