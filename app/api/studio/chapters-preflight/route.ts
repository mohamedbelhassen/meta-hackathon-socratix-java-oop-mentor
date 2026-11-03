import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMIT_CONFIG,
  buildRateLimitHeaders,
} from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const META_API_KEY = process.env.META_API_KEY;

interface MetaChatChoice {
  message?: {
    content?: string;
  };
}

export interface PreflightChapterItem {
  filename: string;
  order: number;
  chapter_number: number;
  module: string;
  title: string;
  title_en: string;
  code: string;
  reasoning: string;
  source_quote?: string;
  action_taken?: string;
}

export async function POST(req: NextRequest) {
  try {
    if (!META_API_KEY) {
      return NextResponse.json({ error: 'META_API_KEY is not configured on the server.' }, { status: 503 });
    }

    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(`studio_preflight_${clientIp}`, RATE_LIMIT_CONFIG.studioLimitPerMinute, 60);
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: `Trop de requêtes. Veuillez patienter ${rateCheck.resetSeconds}s.` },
        { status: 429, headers: buildRateLimitHeaders(rateCheck) }
      );
    }

    const body = await req.json();
    const { courseId, files } = body;

    if (!courseId || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'Missing courseId or files array.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('title, code, content_language, tutor_language, file_extensions')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    // Check existing chapters for sequence continuation
    const { data: existingChapters } = await supabase
      .from('course_chapters')
      .select('chapter_number')
      .eq('course_id', courseId)
      .order('chapter_number', { ascending: false })
      .limit(1);

    const startNumber = (existingChapters?.[0]?.chapter_number || 0) + 1;

    // Build concise manifest of files with first slide text
    const sanitizedFiles = files.map((f: { filename: string; firstSlideText?: string }) => ({
      filename: f.filename,
      firstSlideText: (f.firstSlideText || '').slice(0, 1500),
    }));

    const systemPrompt = `You are an elite academic curriculum architect for Socratix.
Course: "${course.title}" (${course.code}) — File extensions: ${JSON.stringify(course.file_extensions || [])}.
Starting chapter sequence number: ${startNumber}.

Analyze the uploaded lecture slide files. By inspecting their filenames and first slide texts, determine the optimal pedagogical progression of the curriculum.

### RULES:
1. Understand pedagogical progression (e.g. foundational structure before styling, basic selectors before layout, Flexbox/Grid before responsive animations; in OOP, basic types/syntax before classes, encapsulation before inheritance and exceptions).
2. Resolve multi-module numbering (e.g. if HTML has Ch 1-2 and CSS resets numbering to Ch 1-5, map them into a coherent global course sequence starting at ${startNumber}).
3. Extract source evidence: quote 10-25 words from the first slide proving that chapter's topic.
4. Document the normalization action applied (e.g., "Stripped prefix '1_', normalized relative Ch 1 to Global Ch 1, assigned code CH1_HTML_INTRO").
5. Assign for EACH file:
   - 'order': sequential ordering index (1, 2, 3...)
   - 'chapter_number': global chapter number (${startNumber}, ${startNumber + 1}, ...)
   - 'module': module name (e.g. "HTML", "CSS", "Core", "Advanced", etc.)
   - 'title': clean, official chapter title in French (or course content language)
   - 'title_en': clean English title for international jury
   - 'code': unique uppercase alphanumeric code e.g. "CH1_HTML_INTRO", "CH3_CSS_SELECTORS", etc.
   - 'reasoning': short 1-sentence pedagogical rationale explaining why this file occupies this position.
   - 'source_quote': short excerpt (10-25 words) from the first slide identifying the chapter.
   - 'action_taken': brief description of prefix stripping or relative-to-global sequence normalization.`;

    const userPrompt = `Classify and sequence these ${sanitizedFiles.length} course documents:
${JSON.stringify(sanitizedFiles, null, 2)}`;

    const schema = {
      name: 'chapters_preflight_plan',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          curriculum_summary: {
            type: 'string',
            description: 'A 2-sentence executive pedagogical summary of the entire curriculum organization, explaining why the modules and chapters are sequenced in this order.',
          },
          detected_modules: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of unique module/topic domains identified across these documents (e.g. ["HTML", "CSS"]).',
          },
          chapters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                filename: { type: 'string' },
                order: { type: 'integer' },
                chapter_number: { type: 'integer' },
                module: { type: 'string' },
                title: { type: 'string' },
                title_en: { type: 'string' },
                code: { type: 'string' },
                reasoning: { type: 'string' },
                source_quote: { type: 'string' },
                action_taken: { type: 'string' },
              },
              required: ['filename', 'order', 'chapter_number', 'module', 'title', 'title_en', 'code', 'reasoning', 'source_quote', 'action_taken'],
              additionalProperties: false,
            },
          },
        },
        required: ['curriculum_summary', 'detected_modules', 'chapters'],
        additionalProperties: false,
      },
    };

    const metaRes = await fetch('https://api.meta.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${META_API_KEY}`,
      },
      cache: 'no-store',
      body: JSON.stringify({
        model: 'muse-spark-1.3',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: schema,
        },
        temperature: 0.1,
        reasoning_effort: 'low',
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      throw new Error(`Meta API Preflight Error (${metaRes.status}): ${errText}`);
    }

    const metaData = await metaRes.json();
    const content = (metaData.choices as MetaChatChoice[])?.[0]?.message?.content;
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;

    const chapters: PreflightChapterItem[] = Array.isArray(parsed?.chapters)
      ? parsed.chapters.sort((a: PreflightChapterItem, b: PreflightChapterItem) => a.order - b.order)
      : [];

    return NextResponse.json({
      success: true,
      curriculum_summary:
        parsed?.curriculum_summary ||
        'Sequenced syllabus with verified prerequisite ordering, ensuring foundational concepts precede applied implementation.',
      detected_modules:
        Array.isArray(parsed?.detected_modules) && parsed.detected_modules.length > 0
          ? parsed.detected_modules
          : Array.from(new Set(chapters.map((c) => c.module).filter(Boolean))),
      chapters,
    });
  } catch (err: unknown) {
    console.error('[Chapters Preflight Error]:', err);
    const errMsg = err instanceof Error ? err.message : 'Curriculum pre-flight failed.';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

