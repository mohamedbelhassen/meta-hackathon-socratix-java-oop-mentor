import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { GOLDEN_CHAPTER_SYNTHESIS_SHOT } from '@/lib/meta-prompt-exemplars';

const META_API_KEY = process.env.META_API_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!META_API_KEY) {
      return NextResponse.json({ error: 'META_API_KEY is not configured on the server.' }, { status: 503 });
    }

    const body = await req.json();
    const { courseId, chapterNumber, code, title, pdfUrl, pages } = body;

    if (!courseId || !chapterNumber || !code || !title || !pages || !Array.isArray(pages)) {
      return NextResponse.json({ error: 'Missing required parameters for chapter analysis.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('content_language, tutor_language')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    // Format slide pages text concisely
    const pagesTextSample = pages
      .slice(0, 100)
      .map((p: { page: number; text: string }) => `[Slide ${p.page}] ${p.text.slice(0, 450)}`)
      .join('\n');

    const systemPrompt = `You are an elite educational AI curriculum engineer for Socratix.
Your role is to distill university slide decks into ultra-dense, mathematically precise course chapter syntheses.

### GOLDEN EXEMPLAR (HOW TO SUMMARIZE A CHAPTER):
Study the following exemplar extracted from a proven OOP curriculum. Notice the exact slide references "(Slides X-Y)", the precise class/analogy names, and the concrete anti-pattern warnings:

${GOLDEN_CHAPTER_SYNTHESIS_SHOT}

### INSTRUCTIONS:
1. Synthesize the provided slides in the course's content language (${course.content_language}).
2. Include exact slide number references "(Slide X)" or "(Slides X-Y)" for every concept.
3. Highlight concrete code identifiers (class names, methods, keywords) and explicit anti-patterns/dangers.
4. Extract key analogies (e.g. Oven, Animals, Download Manager, etc.) with their slide number.
5. Provide a concise English translation summary ("en_summary") for 2 to 4 key slides so they can be shown in the cross-lingual slide viewer.`;

    const userPrompt = `Distill Chapter ${chapterNumber}: "${title}" (${code}) based on the following extracted slides:

${pagesTextSample}`;

    const jsonSchema = {
      name: 'chapter_distillation_result',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          markdown_content: {
            type: 'string',
            description: 'Dense structured Markdown summary with slide references and code anti-patterns.',
          },
          key_analogies: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                slide: { type: 'integer' },
                concept: { type: 'string' },
                analogy_summary: { type: 'string' },
              },
              required: ['slide', 'concept', 'analogy_summary'],
              additionalProperties: false,
            },
          },
          pages_summary: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                en_summary: { type: 'string' },
              },
              required: ['page', 'en_summary'],
              additionalProperties: false,
            },
          },
        },
        required: ['markdown_content', 'key_analogies', 'pages_summary'],
        additionalProperties: false,
      },
    };

    const metaRes = await fetch('https://api.meta.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${META_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'muse-spark-1.3',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: jsonSchema,
        },
        temperature: 0.1,
      }),
    });

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      throw new Error(`Meta API Error (${metaRes.status}): ${errText}`);
    }

    const metaData = await metaRes.json();
    const content = metaData.choices?.[0]?.message?.content;
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;

    // Merge pages_summary with extracted pages
    const enrichedPages = pages.map((p: { page: number; text: string }) => {
      const found = parsed.pages_summary?.find((s: { page: number }) => s.page === p.page);
      return {
        page: p.page,
        text: p.text,
        en_summary: found?.en_summary || undefined,
      };
    });

    const chapterRecord = {
      course_id: courseId,
      chapter_number: Number(chapterNumber),
      code: code.trim().toUpperCase(),
      title: title.trim(),
      pdf_url: pdfUrl || null,
      markdown_content: parsed.markdown_content,
      pages_json: enrichedPages,
      key_analogies: parsed.key_analogies || [],
      created_at: new Date().toISOString(),
    };

    const { data: savedChapter, error: saveError } = await supabase
      .from('course_chapters')
      .upsert(chapterRecord, { onConflict: 'course_id,code' })
      .select()
      .single();

    if (saveError) throw saveError;

    return NextResponse.json({
      success: true,
      chapter: savedChapter,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Chapter analysis failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
