import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import { Lab } from '@/types/socratix';

interface Persona {
  id: string;
  name: string;
  seat: string;
}

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

    // 1. Fetch guest personas from the database dynamically
    const { data: dbGuests } = await supabase
      .from('profiles')
      .select('id, display_name, email, is_guest')
      .eq('is_guest', true)
      .eq('role', 'student')
      .order('display_name', { ascending: true });

    // Fallback personas if DB has no guest profiles
    const FALLBACK_PERSONAS: Persona[] = [
      { id: '22222222-2222-2222-2222-222222222222', name: 'Alice', seat: 'PC 01' },
      { id: '33333333-3333-3333-3333-333333333333', name: 'Bob', seat: 'PC 02' },
      { id: '55555555-5555-5555-5555-555555555555', name: 'Ines', seat: 'PC 05' },
      { id: '44444444-4444-4444-4444-444444444444', name: 'Guest Explorer', seat: 'PC 12' },
    ];

    const seatMap: Record<string, string> = {
      Alice: 'PC 01',
      Bob: 'PC 02',
      Ines: 'PC 05',
      'Guest Explorer': 'PC 12',
    };

    const personas: Persona[] = (dbGuests && dbGuests.length > 0)
      ? dbGuests.map((g, idx) => ({
          id: g.id,
          name: g.display_name || `Student ${idx + 1}`,
          seat: seatMap[g.display_name || ''] || `PC ${String(idx + 1).padStart(2, '0')}`,
        }))
      : FALLBACK_PERSONAS;

    // 2. Fetch the target course & lab dynamically from DB
    const [labRes, courseRes, chaptersRes] = await Promise.all([
      supabase.from('labs').select('*').eq('id', labId).single(),
      supabase.from('courses').select('id, code, title, file_extensions, content_language, tutor_language').eq('id', courseId).single(),
      supabase.from('course_chapters').select('id, code, title, chapter_number, pdf_url').eq('course_id', courseId).order('chapter_number', { ascending: true }),
    ]);

    if (labRes.error || !labRes.data) {
      return NextResponse.json({ error: 'Target lab not found.' }, { status: 404 });
    }

    const lab = labRes.data as Lab;
    const courseData = courseRes.data;
    const chapters = chaptersRes.data || [];

    const activities = lab.activities || [];
    const firstAct = activities[0];
    const firstActId = firstAct?.id || 'act_1';
    const m1Id = firstAct?.milestones?.[0]?.id || 'm1_1';
    const m2Id = firstAct?.milestones?.[1]?.id || 'm1_2';

    const coveredConcepts = (lab.covered_micro_concepts && lab.covered_micro_concepts.length > 0)
      ? lab.covered_micro_concepts
      : ['CORE_SYNTAX', 'INPUT_VALIDATION'];
    const concept1 = coveredConcepts[0] || 'CORE_SYNTAX';
    const concept2 = coveredConcepts[1] || 'INPUT_VALIDATION';

    // 3. Resolve chapter slide reference dynamically
    const targetChapter = chapters[0] || null;
    const resolvedPdfUrl = targetChapter?.pdf_url || null;
    const chapterLabel = targetChapter
      ? `Chapter ${targetChapter.chapter_number}: ${targetChapter.title}`
      : 'Course Curriculum';
    const chapterCode = targetChapter?.code || 'CHAPTER_1';

    // 4. Determine file names and realistic snippets dynamically based on course / lab
    const courseExts = courseData?.file_extensions || ['.java'];
    let primaryFile = 'Main.java';
    let failedSnippet = 'public class Main {\n  // Missing check\n}';

    const firstTargetFile = firstAct?.target_files?.[0];
    const firstPresetFile = lab.demo_presets?.[0]?.files?.[0]?.name;

    if (firstTargetFile) {
      primaryFile = firstTargetFile;
    } else if (firstPresetFile) {
      primaryFile = firstPresetFile;
    } else {
      const firstExt = courseExts[0]?.toLowerCase().replace(/^\./, '') || 'java';
      if (firstExt === 'html' || firstExt === 'htm') {
        primaryFile = 'index.html';
        failedSnippet = '<!DOCTYPE html>\n<html>\n<head></head>\n<body>\n  <!-- Missing required structure -->\n';
      } else if (firstExt === 'css') {
        primaryFile = 'styles.css';
        failedSnippet = '.container {\n  width: -100px;\n}';
      } else if (firstExt === 'kt' || firstExt === 'kts') {
        primaryFile = 'Main.kt';
        failedSnippet = 'class Solution {\n    fun execute(): String = TODO("Unimplemented")\n}';
      } else if (firstExt === 'tsx' || firstExt === 'jsx') {
        primaryFile = 'App.tsx';
        failedSnippet = 'import React from "react";\n\nexport default function App() {\n  return <View>Unclosed\n}';
      } else if (firstExt === 'js' || firstExt === 'ts') {
        primaryFile = 'app.js';
        failedSnippet = 'function calculateTotal(items) {\n  return items.price;\n}';
      } else if (firstExt === 'py') {
        primaryFile = 'main.py';
        failedSnippet = 'def process_records(items):\n    return items[999]\n';
      } else if (firstExt === 'c' || firstExt === 'h') {
        primaryFile = 'main.c';
        failedSnippet = '#include <stdio.h>\n\nint main(void) {\n    int *ptr = NULL;\n    *ptr = 42;\n    return 0;\n}';
      }
    }

    const nowIso = new Date().toISOString();

    // 5. Delete existing demo sessions for these personas on this lab
    const demoIds = personas.map((p) => p.id);
    await supabase
      .from('student_lab_sessions')
      .delete()
      .in('student_id', demoIds)
      .eq('lab_id', labId);

    // 6. Build realistic classroom cohort (1 COMPLETED, 2 BLOCKED to trigger Bottleneck Alert, 1 IN_PROGRESS)
    const p1 = personas[0] || FALLBACK_PERSONAS[0];
    const p2 = personas[1] || FALLBACK_PERSONAS[1];
    const p3 = personas[2] || FALLBACK_PERSONAS[2];
    const p4 = personas[3] || FALLBACK_PERSONAS[3];

    // Alice / Student 1: COMPLETED (100%)
    const aliceSession = {
      course_id: courseId,
      lab_id: labId,
      student_id: p1.id,
      seat_label: p1.seat,
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
          summary: `Mastered all criteria for ${concept1}.`,
          occurrences: [
            {
              activity_id: firstActId,
              file: primaryFile,
              location: `${primaryFile}:spec`,
              status: 'PASS',
              last_signal: 'POSITIVE',
              note: 'Requirements verified cleanly.',
            },
          ],
        },
        [concept2]: {
          status: 'MASTERED',
          score: 100,
          signal_count: 2,
          summary: `Mastered all criteria for ${concept2}.`,
          occurrences: [
            {
              activity_id: firstActId,
              file: primaryFile,
              location: `${primaryFile}:validate`,
              status: 'PASS',
              last_signal: 'POSITIVE',
              note: 'Validation check properly guards invariants.',
            },
          ],
        },
      },
      last_diagnostic_note: 'All milestone contracts verified with high code quality.',
      completion_report: {
        congratulations: `Superb work ${p1.name}! You have mastered all requirements for ${lab.title}.`,
        mastered_concepts: [concept1, concept2],
        friction_points: ['Initial syntax check resolved'],
        revision_recommendations: [`Review ${chapterLabel} for next chapter consolidation`],
      },
      started_at: nowIso,
      updated_at: nowIso,
    };

    // Bob / Student 2: BLOCKED on m2Id (PC 02)
    const bobSession = {
      course_id: courseId,
      lab_id: labId,
      student_id: p2.id,
      seat_label: p2.seat,
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
          summary: `Satisfied in ${primaryFile}.`,
          occurrences: [
            {
              activity_id: firstActId,
              file: primaryFile,
              location: `${primaryFile}:structure`,
              status: 'PASS',
              last_signal: 'POSITIVE',
              note: 'Structure verified.',
            },
          ],
        },
        [concept2]: {
          status: 'IN_PROGRESS',
          score: 50,
          signal_count: 2,
          summary: `Partial progress in ${primaryFile}. Needs attention on validation logic.`,
          occurrences: [
            {
              activity_id: firstActId,
              file: primaryFile,
              location: `${primaryFile}:guard`,
              status: 'FAIL',
              last_signal: 'NEGATIVE',
              note: 'Unhandled boundary condition in validation logic.',
            },
          ],
        },
      },
      last_diagnostic_note: `Unhandled boundary condition in ${primaryFile}.`,
      last_stuck_at: nowIso,
      started_at: nowIso,
      updated_at: nowIso,
    };

    // Ines / Student 3: BLOCKED on m2Id (PC 05) - Triggers Classroom Bottleneck Alert
    const inesSession = {
      course_id: courseId,
      lab_id: labId,
      student_id: p3.id,
      seat_label: p3.seat,
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
          summary: 'Structure verified.',
          occurrences: [
            {
              activity_id: firstActId,
              file: primaryFile,
              location: `${primaryFile}:main`,
              status: 'PASS',
              last_signal: 'POSITIVE',
              note: 'Main contract verified.',
            },
          ],
        },
        [concept2]: {
          status: 'STRUGGLING',
          score: 0,
          signal_count: 1,
          summary: `Struggling with ${concept2} requirements.`,
          occurrences: [
            {
              activity_id: firstActId,
              file: primaryFile,
              location: `${primaryFile}:check`,
              status: 'FAIL',
              last_signal: 'NEGATIVE',
              note: 'Missing defensive guard against edge cases.',
            },
          ],
        },
      },
      last_diagnostic_note: `Missing defensive guard against edge cases in ${primaryFile}.`,
      last_stuck_at: nowIso,
      started_at: nowIso,
      updated_at: nowIso,
    };

    // Guest Explorer / Student 4: IN_PROGRESS (PC 12)
    const guestSession = {
      course_id: courseId,
      lab_id: labId,
      student_id: p4.id,
      seat_label: p4.seat,
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
          summary: `Initial pass on ${concept1}.`,
          occurrences: [
            {
              activity_id: firstActId,
              file: primaryFile,
              location: `${primaryFile}:setup`,
              status: 'PASS',
              last_signal: 'POSITIVE',
              note: 'Workspace setup initiated.',
            },
          ],
        },
      },
      last_diagnostic_note: 'Starting lab exploration.',
      started_at: nowIso,
      updated_at: nowIso,
    };

    // 7. Insert all sessions into Supabase
    const { data: inserted, error: insertError } = await supabase
      .from('student_lab_sessions')
      .insert([aliceSession, bobSession, inesSession, guestSession])
      .select('*, profiles(display_name, is_guest, email)');

    if (insertError) {
      console.error('[Seed Demo Class] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to insert demo sessions.' }, { status: 500 });
    }

    // 8. Add sample chat messages tailored to the course
    const bobInserted = inserted?.find((s) => s.student_id === p2.id);
    if (bobInserted) {
      await supabase.from('chat_messages').insert([
        {
          student_lab_session_id: bobInserted.id,
          role: 'user',
          content: `I am encountering a bug in ${primaryFile} during Milestone 2. Could you give me a hint?`,
          code_snapshot: [
            {
              name: primaryFile,
              content: failedSnippet,
            },
          ],
        },
        {
          student_lab_session_id: bobInserted.id,
          role: 'assistant',
          content: `Look at the boundary conditions in \`${primaryFile}\`. Does your current logic handle edge cases properly? Check the reference from ${chapterLabel}!`,
          course_reference: {
            label: `${chapterLabel} (Slide Reference)`,
            chapter_code: chapterCode,
            page_number: 1,
            pdf_url: resolvedPdfUrl,
            content_language: courseData?.content_language || 'fr',
            en_note: `Review requirements for ${concept2} in ${primaryFile}.`,
            slide_markdown: {
              en: `**${concept2} Guideline**:\nEnsure all invariants and input constraints are properly verified.`,
              fr: `**Règle pour ${concept2}** :\nAssurez-vous que toutes les contraintes sont vérifiées avant validation.`,
            },
          },
          code_snapshot: [],
          latency_ms: 720,
        },
      ]);
    }

    return NextResponse.json({
      success: true,
      message: `Demo class populated with ${inserted?.length || 4} dynamic sessions for ${lab.title}.`,
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
