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

export interface PreflightLabItem {
  filename: string;
  order: number;
  lab_number: number;
  module: string;
  title: string;
  title_en: string;
  code: string;
  reasoning: string;
  source_quote?: string;
  action_taken?: string;
  target_files?: string[];
}

export async function POST(req: NextRequest) {
  try {
    if (!META_API_KEY) {
      return NextResponse.json({ error: 'META_API_KEY is not configured on the server.' }, { status: 503 });
    }

    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(`studio_labs_preflight_${clientIp}`, RATE_LIMIT_CONFIG.studioLimitPerMinute, 60);
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
      .select('title, code, content_language, tutor_language, file_extensions, competency_matrix')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    // Check existing labs for sequence continuation
    const { data: existingLabs } = await supabase
      .from('labs')
      .select('lab_number')
      .eq('course_id', courseId)
      .order('lab_number', { ascending: false })
      .limit(1);

    const startNumber = (existingLabs?.[0]?.lab_number || 0) + 1;

    // Build concise manifest of files with first page text
    const sanitizedFiles = files.map((f: { filename: string; firstSlideText?: string }) => ({
      filename: f.filename,
      firstSlideText: (f.firstSlideText || '').slice(0, 1500),
    }));

    const systemPrompt = `You are an elite academic curriculum architect for Socratix specializing in hands-on computer science lab assignments (Travaux Pratiques / TDs / Projects).
Course: "${course.title}" (${course.code}) — File extensions: ${JSON.stringify(course.file_extensions || [])}.
Starting lab sequence number: ${startNumber}.

Analyze the uploaded lab assignment PDF files. By inspecting their filenames and first page texts, determine the optimal pedagogical progression of practical exercises.

### RULES:
1. Pedagogical progression: foundational syntax exercises before modular architecture, basic layouts before responsive design and complex animations.
2. Resolve lab variants (e.g. if you see 'TP 4' and 'TP 4 bis' / 'TP 4_bis', 'TP 4 bis' is an advanced practical workshop that immediately follows TP 4; assign it a unique code 'TP4_BIS' and order it right after TP 4 without overwriting).
3. Assign collision-proof codes: 'TP1', 'TP2', 'TP3', 'TP4', 'TP4_BIS', 'TP5', 'TP6', etc. NEVER duplicate codes.
4. Extract source evidence: quote 10-25 words from the assignment header/instructions proving the topic.
5. Document the normalization action applied (e.g. "Identified as advanced continuation of TP 4, assigned unique code 'TP4_BIS', positioned after TP 4").
6. Assign for EACH file:
   - 'order': sequential ordering index (1, 2, 3...)
   - 'lab_number': global sequence number (${startNumber}, ${startNumber + 1}, ...)
   - 'module': practical module/theme (e.g. "HTML Semantic Markup", "CSS Box Model", "Flexbox & Grid Layouts")
   - 'title': clean, official lab title in French (or course content language)
   - 'title_en': clean English title for international jury
   - 'code': unique uppercase alphanumeric code e.g. "TP1", "TP4_BIS"
   - 'reasoning': short 1-sentence pedagogical rationale explaining why this lab occupies this position
   - 'source_quote': short excerpt (10-25 words) from the first page identifying the lab
   - 'action_taken': brief description of variant detection, prefix removal, or collision resolution applied
   - 'target_files': array of 1-3 likely source code filenames using course extensions (e.g. ["index.html", "style.css"])`;

    const userPrompt = `Classify and sequence these ${sanitizedFiles.length} lab documents:
${JSON.stringify(sanitizedFiles, null, 2)}`;

    const schema = {
      name: 'labs_preflight_plan',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          curriculum_summary: {
            type: 'string',
            description: 'A 2-sentence executive pedagogical summary of the lab syllabus, explaining the progression from basic exercises to advanced projects.',
          },
          detected_modules: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of practical modules/themes identified across these lab assignments.',
          },
          labs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                filename: { type: 'string' },
                order: { type: 'integer' },
                lab_number: { type: 'integer' },
                module: { type: 'string' },
                title: { type: 'string' },
                title_en: { type: 'string' },
                code: { type: 'string' },
                reasoning: { type: 'string' },
                source_quote: { type: 'string' },
                action_taken: { type: 'string' },
                target_files: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: [
                'filename',
                'order',
                'lab_number',
                'module',
                'title',
                'title_en',
                'code',
                'reasoning',
                'source_quote',
                'action_taken',
                'target_files',
              ],
              additionalProperties: false,
            },
          },
        },
        required: ['curriculum_summary', 'detected_modules', 'labs'],
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
      throw new Error(`Meta API Labs Preflight Error (${metaRes.status}): ${errText}`);
    }

    const metaData = await metaRes.json();
    const content = (metaData.choices as MetaChatChoice[])?.[0]?.message?.content;
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;

    const labs: PreflightLabItem[] = Array.isArray(parsed?.labs)
      ? parsed.labs.sort((a: PreflightLabItem, b: PreflightLabItem) => a.order - b.order)
      : [];

    return NextResponse.json({
      success: true,
      curriculum_summary:
        parsed?.curriculum_summary ||
        'Hands-on lab syllabus structured to progressively build practical competencies from fundamentals to full implementation.',
      detected_modules:
        Array.isArray(parsed?.detected_modules) && parsed.detected_modules.length > 0
          ? parsed.detected_modules
          : Array.from(new Set(labs.map((l) => l.module).filter(Boolean))),
      labs,
    });
  } catch (err: unknown) {
    console.error('[Labs Preflight Error]:', err);
    const errMsg = err instanceof Error ? err.message : 'Labs pre-flight failed.';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

