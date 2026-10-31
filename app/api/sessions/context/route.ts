import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { StudentLabSession, ChatMessage } from '@/types/socratix';

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

    return NextResponse.json({
      session,
      messages: (messagesData || []) as ChatMessage[],
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
