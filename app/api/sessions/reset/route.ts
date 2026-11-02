import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { verifyStudentSessionAccess } from '@/lib/auth-guard';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentId, labId } = body;

    if (!studentId || !labId) {
      return NextResponse.json(
        { error: 'studentId and labId are required to reset a session.' },
        { status: 400 }
      );
    }

    const access = await verifyStudentSessionAccess(req, studentId);
    if (!access.authorized) {
      return NextResponse.json(
        { error: access.error || 'Forbidden' },
        { status: access.actor === 'unauthorized' ? 401 : 403 }
      );
    }

    const supabase = getServiceSupabase();

    // Cascades automatically to chat_messages via ON DELETE CASCADE foreign key
    const { error } = await supabase
      .from('student_lab_sessions')
      .delete()
      .eq('student_id', studentId)
      .eq('lab_id', labId);

    if (error) {
      console.error('[Session Reset] Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to reset student session.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Student session and dialogue history successfully reset.',
    });
  } catch (error) {
    console.error('[Session Reset] Exception:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
