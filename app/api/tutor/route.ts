import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { Course, CourseChapter, Lab, StudentLabSession, TutorRequestBody } from '@/types/socratix';
import { buildCourseSystemPrompt, buildDynamicSocratixSchema } from '@/lib/prompt-builder';
import { formatRawSlideTextToMarkdown } from '@/lib/pdf-cleaner';
import {
  computeActivitiesAndLabProgress,
  computeSessionStatus,
  mergeMicroCompetenciesState,
  RawConceptSignal,
} from '@/lib/telemetry-merger';

const META_API_KEY = process.env.META_API_KEY;
const META_BASE_URL = process.env.META_BASE_URL || 'https://api.meta.ai/v1';

// In-memory 60s TTL Cache for Course Bundles
interface CachedCourseBundle {
  course: Course;
  chapters: CourseChapter[];
  lab: Lab;
  cachedAt: number;
}
const COURSE_CACHE = new Map<string, CachedCourseBundle>();

async function getCourseBundle(
  courseId: string,
  labId: string
): Promise<{ course: Course; chapters: CourseChapter[]; lab: Lab } | null> {
  const cacheKey = `${courseId}_${labId}`;
  const now = Date.now();
  const cached = COURSE_CACHE.get(cacheKey);

  if (cached && now - cached.cachedAt < 60000) {
    return cached;
  }

  const supabase = getServiceSupabase();

  const [courseRes, chaptersRes, labRes] = await Promise.all([
    supabase.from('courses').select('*').eq('id', courseId).single(),
    supabase.from('course_chapters').select('*').eq('course_id', courseId).order('chapter_number', { ascending: true }),
    supabase.from('labs').select('*').eq('id', labId).single(),
  ]);

  if (courseRes.error || !courseRes.data || labRes.error || !labRes.data) {
    return null;
  }

  const bundle: CachedCourseBundle = {
    course: courseRes.data as Course,
    chapters: (chaptersRes.data || []) as CourseChapter[],
    lab: labRes.data as Lab,
    cachedAt: now,
  };

  COURSE_CACHE.set(cacheKey, bundle);
  return bundle;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    if (!META_API_KEY) {
      return NextResponse.json(
        { error: 'META_API_KEY is missing in server environment.' },
        { status: 503 }
      );
    }

    const body: TutorRequestBody = await req.json();
    const {
      courseId,
      labId,
      activityId,
      studentId,
      studentName,
      seatLabel,
      question,
      isHintRequest,
      files,
      history = [],
    } = body;

    if (!courseId || !labId || !studentId || !files || !Array.isArray(files)) {
      return NextResponse.json(
        { error: 'Missing required parameters (courseId, labId, studentId, files).' },
        { status: 400 }
      );
    }

    const bundle = await getCourseBundle(courseId, labId);
    if (!bundle) {
      return NextResponse.json(
        { error: 'Course or Lab not found in database.' },
        { status: 404 }
      );
    }

    const { course, chapters, lab } = bundle;
    const supabase = getServiceSupabase();

    // Identify active activity
    const activeActivity = lab.activities?.find((a) => a.id === activityId)
      || lab.activities?.[0]
      || null;

    // Fetch existing student session
    const { data: existingSessionData } = await supabase
      .from('student_lab_sessions')
      .select('*, profiles(display_name, is_guest)')
      .eq('student_id', studentId)
      .eq('lab_id', labId)
      .maybeSingle();

    const existingSession = existingSessionData as StudentLabSession | null;
    const resolvedStudentName = (studentName && studentName.trim())
      || (existingSessionData as unknown as { profiles?: { display_name?: string } })?.profiles?.display_name
      || 'Student';

    // Assemble dynamic 3-layer system prompt & strict schema
    const systemPrompt = buildCourseSystemPrompt(course, chapters, lab, activeActivity);
    const dynamicSchema = buildDynamicSocratixSchema(course, chapters, lab);

    // Format submitted files
    const filesContext = files
      .map((f) => `--- FILE: ${f.name} ---\n${f.content}`)
      .join('\n\n');

    const userMessageContent = `
STUDENT METADATA:
- Student Name: ${resolvedStudentName}
- Seat: ${seatLabel || existingSession?.seat_label || 'PC 01'}
- Active Activity: ${activeActivity ? `[${activeActivity.id}] ${activeActivity.title}` : 'General'}
- Is Hint Request: ${Boolean(isHintRequest)}
- Addressing Guideline: When addressing or congratulating the student in 'socratic_reply' or 'competency_report.congratulations', warmly address them by their name (e.g. "Bravo ${resolvedStudentName} (${seatLabel || 'PC 01'})!" or "Bravo ${resolvedStudentName}!"). Never refer to the student as only a machine number like "PC 05".

STUDENT CODE SNAPSHOT:
${filesContext}

STUDENT INPUT:
${isHintRequest ? '[STUDENT CLICKED "ASK FOR A HINT" - DIAGNOSE FIRST UNMET MILESTONE]' : (question?.trim() || 'Please inspect my code and guide me socratic-style on the next step.')}
`.trim();

    // Format dialogue history (last 6 messages)
    const formattedHistory = (history || []).slice(-6).map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    // Call Meta muse-spark-1.3 API
    const metaRes = await fetch(`${META_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${META_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'muse-spark-1.3',
        messages: [
          { role: 'system', content: systemPrompt },
          ...formattedHistory,
          { role: 'user', content: userMessageContent },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: dynamicSchema,
        },
        temperature: 0.2,
      }),
    });

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      console.error('[Tutor API] Meta API call failed:', metaRes.status, errText);
      return NextResponse.json(
        { error: `Meta AI invocation error (${metaRes.status})` },
        { status: 502 }
      );
    }

    const metaData = await metaRes.json();
    const rawContent = metaData.choices?.[0]?.message?.content;
    if (!rawContent) {
      return NextResponse.json(
        { error: 'Empty response returned by Meta model.' },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(rawContent);
    const latencyMs = Date.now() - startTime;

    // Resolve course_reference with actual PDF URL and slide details
    const refChapter = chapters.find(
      (c) => c.code === parsed.socratic_reply?.course_reference?.chapter_code
    );
    if (refChapter && parsed.socratic_reply?.course_reference) {
      parsed.socratic_reply.course_reference.pdf_url = refChapter.pdf_url || null;
      const slidePage = refChapter.pages_json?.find(
        (p) => p.page === parsed.socratic_reply.course_reference.page_number
      );
      if (slidePage) {
        const frClean = slidePage.fr_markdown?.trim() || (slidePage.text ? formatRawSlideTextToMarkdown(slidePage.text) : undefined);
        const enClean = slidePage.en_markdown?.trim() || undefined;

        parsed.socratic_reply.course_reference.slide_markdown = {
          en: enClean,
          fr: frClean,
        };
      }
    }

    // Normalize congratulations text to always address student by name
    if (parsed.competency_report?.congratulations) {
      const studentTag = seatLabel ? `${resolvedStudentName} (${seatLabel})` : resolvedStudentName;
      parsed.competency_report.congratulations = parsed.competency_report.congratulations.replace(
        /\b(?:Bravo|Congratulations|Good job)\s+(?:PC\s*\d+|PC\d+)\b!*/gi,
        `Bravo ${studentTag}!`
      );
    }

    // Merge multi-occurrence micro-competencies non-destructively
    const incomingSignals: RawConceptSignal[] = parsed.concept_signals || [];
    const updatedMicroCompetencies = mergeMicroCompetenciesState(
      existingSession?.micro_competencies_state || {},
      incomingSignals
    );

    // Compute progress for activities and global lab
    const newlyCompleted = parsed.newly_completed_milestone_ids || [];
    const progressData = computeActivitiesAndLabProgress(
      lab,
      existingSession?.completed_milestone_ids || [],
      newlyCompleted
    );

    // Compute deterministic milestone and activity completion flags strictly for THIS turn
    const hasUnresolvedError = Boolean(parsed.has_unresolved_error);
    const currentActivityProgress = activeActivity?.id ? progressData.activities_progress[activeActivity.id] : null;

    // An activity is newly completed in this turn ONLY when:
    // 1. Code has NO unresolved errors, AND
    // 2. Either the AI explicitly marks is_activity_completed, OR newly completed milestones brought this activity to 100%
    const isActivityNewlyCompleted = !hasUnresolvedError && Boolean(
      parsed.is_activity_completed ||
      (newlyCompleted.length > 0 && currentActivityProgress && currentActivityProgress.percent === 100)
    );

    const isLabNewlyCompleted = !hasUnresolvedError && Boolean(
      parsed.is_lab_completed ||
      (newlyCompleted.length > 0 && progressData.progress_percent === 100)
    );

    const isMilestoneNewlyCompleted = !hasUnresolvedError && Boolean(
      parsed.is_milestone_completed ||
      isActivityNewlyCompleted ||
      isLabNewlyCompleted ||
      newlyCompleted.length > 0
    );

    // Compute deterministic session status (IN_PROGRESS, BLOCKED, COMPLETED)
    const sessionStatus = computeSessionStatus(
      existingSession,
      course.stuck_threshold_turns || 2,
      isLabNewlyCompleted,
      progressData.progress_percent,
      parsed.has_unresolved_error,
      newlyCompleted.length
    );

    // Attach activity-specific completion report non-destructively
    if (activeActivity?.id && progressData.activities_progress[activeActivity.id]) {
      if (isActivityNewlyCompleted || isLabNewlyCompleted) {
        progressData.activities_progress[activeActivity.id].completion_report = parsed.competency_report;
      } else if (existingSession?.activities_progress?.[activeActivity.id]?.completion_report) {
        progressData.activities_progress[activeActivity.id].completion_report = existingSession.activities_progress[activeActivity.id].completion_report;
      }
    }

    // Persist session state via Supabase UPSERT
    const sessionUpsertPayload = {
      course_id: courseId,
      lab_id: labId,
      student_id: studentId,
      seat_label: seatLabel || existingSession?.seat_label || 'PC 01',
      status: sessionStatus.status,
      current_activity_id: activeActivity?.id || null,
      current_milestone_id: parsed.current_milestone_id || activeActivity?.milestones?.[0]?.id || null,
      completed_milestone_ids: progressData.completed_milestone_ids,
      activities_progress: progressData.activities_progress,
      progress_percent: progressData.progress_percent,
      consecutive_errors: sessionStatus.consecutive_errors,
      micro_competencies_state: updatedMicroCompetencies,
      last_diagnostic_note: incomingSignals[0]?.diagnostic_note || null,
      completion_report: (isActivityNewlyCompleted || isLabNewlyCompleted)
        ? parsed.competency_report
        : (existingSession?.completion_report || null),
      last_stuck_at: sessionStatus.last_stuck_at,
      updated_at: new Date().toISOString(),
    };

    const { data: savedSession, error: upsertError } = await supabase
      .from('student_lab_sessions')
      .upsert(sessionUpsertPayload, { onConflict: 'student_id,lab_id' })
      .select('*, profiles(display_name, is_guest, email)')
      .single();

    if (upsertError || !savedSession) {
      console.error('[Tutor API] Error upserting session:', upsertError);
      return NextResponse.json(
        { error: 'Database persistence failed for student session.' },
        { status: 500 }
      );
    }

    // Persist chat messages tagged with current activity_id
    const userMessageRecord = {
      student_lab_session_id: savedSession.id,
      activity_id: activeActivity?.id || null,
      role: 'user',
      content: isHintRequest ? '💡 [Asked for a Hint]' : question,
      code_snapshot: files,
    };

    const assistantMessageRecord = {
      student_lab_session_id: savedSession.id,
      activity_id: activeActivity?.id || null,
      role: 'assistant',
      content: parsed.socratic_reply?.message_markdown || '',
      course_reference: parsed.socratic_reply?.course_reference || null,
      code_snapshot: files,
      latency_ms: latencyMs,
    };

    const { error: chatError } = await supabase
      .from('chat_messages')
      .insert([userMessageRecord, assistantMessageRecord]);

    if (chatError) {
      console.error('[Tutor API] Error inserting chat messages:', chatError);
    }

    return NextResponse.json({
      socratic_reply: parsed.socratic_reply,
      session_state: savedSession,
      competency_report: isActivityNewlyCompleted || isLabNewlyCompleted ? parsed.competency_report : null,
      is_milestone_completed: isMilestoneNewlyCompleted,
      is_activity_completed: isActivityNewlyCompleted,
      is_lab_completed: isLabNewlyCompleted,
      newly_completed_milestone_ids: newlyCompleted,
      meta_usage: metaData.usage,
      latency_ms: latencyMs,
    });
  } catch (error) {
    console.error('[Tutor API] Unhandled exception:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
