import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { Lab } from '@/types/socratix';

const DEMO_PERSONAS = [
  { id: '22222222-2222-2222-2222-222222222222', name: 'Alice', seat: 'PC 01' },
  { id: '33333333-3333-3333-3333-333333333333', name: 'Bob', seat: 'PC 02' },
  { id: '55555555-5555-5555-5555-555555555555', name: 'Ines', seat: 'PC 05' },
  { id: '44444444-4444-4444-4444-444444444444', name: 'Guest Explorer', seat: 'PC 12' },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { courseId, labId } = body;

    if (!courseId || !labId) {
      return NextResponse.json(
        { error: 'courseId and labId are required to seed demo class.' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Fetch the target lab
    const { data: labData, error: labError } = await supabase
      .from('labs')
      .select('*')
      .eq('id', labId)
      .single();

    if (labError || !labData) {
      return NextResponse.json({ error: 'Target lab not found.' }, { status: 404 });
    }

    const lab = labData as Lab;
    const activities = lab.activities || [];
    const firstAct = activities[0];
    const firstActId = firstAct?.id || 'act_1';
    const m1Id = firstAct?.milestones?.[0]?.id || 'm1_1';
    const m2Id = firstAct?.milestones?.[1]?.id || 'm1_2';

    const coveredConcepts = lab.covered_micro_concepts || ['VISIBILITY_ENCAPSULATION', 'DEFENSIVE_SETTERS'];
    const concept1 = coveredConcepts[0] || 'VISIBILITY_ENCAPSULATION';
    const concept2 = coveredConcepts[1] || 'DEFENSIVE_SETTERS';

    const nowIso = new Date().toISOString();

    // Delete existing demo sessions for these 4 personas on this lab
    const demoIds = DEMO_PERSONAS.map((p) => p.id);
    await supabase
      .from('student_lab_sessions')
      .delete()
      .in('student_id', demoIds)
      .eq('lab_id', labId);

    // 1. Alice: COMPLETED (100%)
    const aliceSession = {
      course_id: courseId,
      lab_id: labId,
      student_id: DEMO_PERSONAS[0].id,
      seat_label: DEMO_PERSONAS[0].seat,
      status: 'COMPLETED',
      current_activity_id: firstActId,
      current_milestone_id: m2Id,
      completed_milestone_ids: [m1Id, m2Id],
      activities_progress: {
        [firstActId]: {
          title: firstAct?.title || 'Activity 1',
          completed_milestones: [m1Id, m2Id],
          total_milestones: 2,
          percent: 100,
          status: 'COMPLETED',
        },
      },
      progress_percent: 100,
      consecutive_errors: 0,
      micro_competencies_state: {
        [concept1]: {
          status: 'MASTERED',
          score: 100,
          signal_count: 2,
          summary: 'Mastered across all 2 inspected locations.',
          occurrences: [
            {
              activity_id: firstActId,
              file: 'Item.java',
              location: 'Item.java:price',
              status: 'PASS',
              last_signal: 'POSITIVE',
              note: 'Private field encapsulation correctly implemented.',
            },
            {
              activity_id: firstActId,
              file: 'Item.java',
              location: 'Item.java:name',
              status: 'PASS',
              last_signal: 'POSITIVE',
              note: 'Private field encapsulation correctly implemented.',
            },
          ],
        },
        [concept2]: {
          status: 'MASTERED',
          score: 100,
          signal_count: 2,
          summary: 'Mastered across all 2 inspected locations.',
          occurrences: [
            {
              activity_id: firstActId,
              file: 'Item.java',
              location: 'Item.java:setPrice',
              status: 'PASS',
              last_signal: 'POSITIVE',
              note: 'Defensive check throws IllegalArgumentException on negative price.',
            },
          ],
        },
      },
      last_diagnostic_note: 'All criteria satisfied with high code quality.',
      completion_report: {
        congratulations: 'Superb work Alice! You have mastered encapsulation and defensive invariants.',
        mastered_concepts: [concept1, concept2],
        friction_points: ['Minor syntax check initially'],
        revision_recommendations: ['Review Chapter 4 inheritance for next lab'],
      },
      started_at: nowIso,
      updated_at: nowIso,
    };

    // 2. Bob: BLOCKED on m2Id (PC 02)
    const bobSession = {
      course_id: courseId,
      lab_id: labId,
      student_id: DEMO_PERSONAS[1].id,
      seat_label: DEMO_PERSONAS[1].seat,
      status: 'BLOCKED',
      current_activity_id: firstActId,
      current_milestone_id: m2Id,
      completed_milestone_ids: [m1Id],
      activities_progress: {
        [firstActId]: {
          title: firstAct?.title || 'Activity 1',
          completed_milestones: [m1Id],
          total_milestones: 2,
          percent: 50,
          status: 'IN_PROGRESS',
        },
      },
      progress_percent: 33,
      consecutive_errors: 2,
      micro_competencies_state: {
        [concept1]: {
          status: 'MASTERED',
          score: 100,
          signal_count: 2,
          summary: 'Demonstrated across 2 inspected locations.',
          occurrences: [
            {
              activity_id: firstActId,
              file: 'Item.java',
              location: 'Item.java:price',
              status: 'PASS',
              last_signal: 'POSITIVE',
              note: 'Private modifier present.',
            },
            {
              activity_id: firstActId,
              file: 'Item.java',
              location: 'Item.java:name',
              status: 'PASS',
              last_signal: 'POSITIVE',
              note: 'Private modifier present.',
            },
          ],
        },
        [concept2]: {
          status: 'IN_PROGRESS',
          score: 50,
          signal_count: 2,
          summary: 'Partial (1/2): Passed in Item.java:setPrice, needs attention in Item.java:setQuantity.',
          occurrences: [
            {
              activity_id: firstActId,
              file: 'Item.java',
              location: 'Item.java:setPrice',
              status: 'PASS',
              last_signal: 'POSITIVE',
              note: 'Guard condition verifies price >= 0.',
            },
            {
              activity_id: firstActId,
              file: 'Item.java',
              location: 'Item.java:setQuantity',
              status: 'FAIL',
              last_signal: 'NEGATIVE',
              note: 'Negative quantities accepted without defensive validation.',
            },
          ],
        },
      },
      last_diagnostic_note: 'Negative quantities accepted in setQuantity without validation.',
      last_stuck_at: nowIso,
      started_at: nowIso,
      updated_at: nowIso,
    };

    // 3. Ines: BLOCKED on m2Id (PC 05) - Triggers classroom bottleneck alert!
    const inesSession = {
      course_id: courseId,
      lab_id: labId,
      student_id: DEMO_PERSONAS[2].id,
      seat_label: DEMO_PERSONAS[2].seat,
      status: 'BLOCKED',
      current_activity_id: firstActId,
      current_milestone_id: m2Id,
      completed_milestone_ids: [m1Id],
      activities_progress: {
        [firstActId]: {
          title: firstAct?.title || 'Activity 1',
          completed_milestones: [m1Id],
          total_milestones: 2,
          percent: 50,
          status: 'IN_PROGRESS',
        },
      },
      progress_percent: 33,
      consecutive_errors: 2,
      micro_competencies_state: {
        [concept1]: {
          status: 'MASTERED',
          score: 100,
          signal_count: 1,
          summary: 'Private modifier present.',
          occurrences: [
            {
              activity_id: firstActId,
              file: 'Item.java',
              location: 'Item.java:price',
              status: 'PASS',
              last_signal: 'POSITIVE',
              note: 'Encapsulation verified.',
            },
          ],
        },
        [concept2]: {
          status: 'STRUGGLING',
          score: 0,
          signal_count: 1,
          summary: 'Struggling with defensive setter invariants.',
          occurrences: [
            {
              activity_id: firstActId,
              file: 'Item.java',
              location: 'Item.java:setPrice',
              status: 'FAIL',
              last_signal: 'NEGATIVE',
              note: 'Missing defensive guard against negative numbers.',
            },
          ],
        },
      },
      last_diagnostic_note: 'Missing validation guard in setter.',
      last_stuck_at: nowIso,
      started_at: nowIso,
      updated_at: nowIso,
    };

    // 4. Guest Explorer: IN_PROGRESS (PC 12)
    const guestSession = {
      course_id: courseId,
      lab_id: labId,
      student_id: DEMO_PERSONAS[3].id,
      seat_label: DEMO_PERSONAS[3].seat,
      status: 'IN_PROGRESS',
      current_activity_id: firstActId,
      current_milestone_id: m1Id,
      completed_milestone_ids: [],
      activities_progress: {
        [firstActId]: {
          title: firstAct?.title || 'Activity 1',
          completed_milestones: [],
          total_milestones: 2,
          percent: 0,
          status: 'IN_PROGRESS',
        },
      },
      progress_percent: 15,
      consecutive_errors: 0,
      micro_competencies_state: {
        [concept1]: {
          status: 'IN_PROGRESS',
          score: 50,
          signal_count: 1,
          summary: 'One field lacks private modifier.',
          occurrences: [
            {
              activity_id: firstActId,
              file: 'Item.java',
              location: 'Item.java:price',
              status: 'FAIL',
              last_signal: 'NEGATIVE',
              note: 'Missing private modifier.',
            },
          ],
        },
      },
      last_diagnostic_note: 'Starting lab exploration.',
      started_at: nowIso,
      updated_at: nowIso,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('student_lab_sessions')
      .insert([aliceSession, bobSession, inesSession, guestSession])
      .select('*, profiles(display_name, is_guest, email)');

    if (insertError) {
      console.error('[Seed Demo Class] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to insert demo sessions.' }, { status: 500 });
    }

    // Add sample chat messages for Bob
    const bobInserted = inserted?.find((s) => s.student_id === DEMO_PERSONAS[1].id);
    if (bobInserted) {
      await supabase.from('chat_messages').insert([
        {
          student_lab_session_id: bobInserted.id,
          role: 'user',
          content: 'Why does my test fail when I pass a negative price or quantity?',
          code_snapshot: [
            {
              name: 'Item.java',
              content: 'public class Item {\n  private double price;\n  public void setPrice(double p) { this.price = p; }\n}',
            },
          ],
        },
        {
          student_lab_session_id: bobInserted.id,
          role: 'assistant',
          content: 'Look at your `setPrice` and `setQuantity` methods. Do they prevent an external caller from storing negative numbers? Remember the Oven invariant from Chapter 3 (Slide 42)!',
          course_reference: {
            label: 'Chapter 3 (Slide 42): Encapsulation and Invariants',
            chapter_code: 'CH3_CLASSES',
            page_number: 42,
            pdf_url: null,
            en_note: 'Allowing direct unchecked assignments breaks object invariants.',
          },
          code_snapshot: [],
          latency_ms: 840,
        },
      ]);
    }

    return NextResponse.json({
      success: true,
      message: 'Demo class populated with 4 realistic sessions on the selected lab.',
      sessions: inserted,
    });
  } catch (error) {
    console.error('[Seed Demo Class] Exception:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
