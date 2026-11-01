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

    // Smart Context Budget: support both slides (short pages) and full course syllabi (dense pages)
    const MAX_PAGES = 200;
    const MAX_CHARS_PER_PAGE = 8000;
    const MAX_TOTAL_CHARS = 180000;

    const pagesSlice = pages.slice(0, MAX_PAGES);
    const totalRawChars = pagesSlice.reduce((sum: number, p: { text: string }) => sum + (p.text?.length || 0), 0);
    const dynamicPerCharLimit = totalRawChars > MAX_TOTAL_CHARS
      ? Math.max(1200, Math.floor(MAX_TOTAL_CHARS / pagesSlice.length))
      : MAX_CHARS_PER_PAGE;

    const pagesTextSample = pagesSlice
      .map((p: { page: number; text: string }) => `[Page/Slide ${p.page}] ${(p.text || '').slice(0, dynamicPerCharLimit)}`)
      .join('\n');

    const systemPrompt = `You are an elite educational AI curriculum engineer for Socratix.
Your role is to distill university course material (lecture slides or full lecture notes/polycopié) into ultra-dense, mathematically precise course chapter syntheses.

### GOLDEN EXEMPLAR (HOW TO SUMMARIZE A CHAPTER):
Study the following exemplar extracted from a proven OOP curriculum. Notice the exact slide references "(Slides X-Y)", the precise class/analogy names, and the concrete anti-pattern warnings:

${GOLDEN_CHAPTER_SYNTHESIS_SHOT}

### INSTRUCTIONS:
1. Extract the official chapter title from the document title slide/header in both French ('fr') and English ('en') ('extracted_title').
2. Synthesize the provided material in the course's content language (${course.content_language}).
3. Include exact reference anchors "(Slide X)" or "(Page X)" (or "(Slides X-Y)" / "(Pages X-Y)") for every concept.
4. Highlight concrete code identifiers (class names, methods, keywords) and explicit anti-patterns/dangers.
5. Extract key analogies (e.g. Oven, Animals, Download Manager, etc.) with their slide or page number.
6. Provide a concise English translation summary ("en_summary") for 2 to 4 key slides/pages so they can be shown in the cross-lingual slide viewer.`;

    const userPrompt = `Distill Chapter ${chapterNumber}: "${title}" (${code}) based on the following extracted document text:

${pagesTextSample}`;

    const jsonSchema = {
      name: 'chapter_distillation_result',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          extracted_title: {
            type: 'object',
            properties: {
              fr: {
                type: 'string',
                description: 'Le titre officiel du chapitre extrait du document en français (ex: Chapitre 5 : Les Interfaces en Java).',
              },
              en: {
                type: 'string',
                description: 'The clean English translation of the chapter title for the international jury (e.g., Chapter 5: Interfaces in Java).',
              },
            },
            required: ['fr', 'en'],
            additionalProperties: false,
          },
          markdown_content: {
            type: 'string',
            description: 'Dense structured Markdown summary with slide/page references and code anti-patterns.',
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
        required: ['extracted_title', 'markdown_content', 'key_analogies', 'pages_summary'],
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

    const rawEnTitle = parsed.extracted_title?.en?.trim() || title.trim();
    const cleanEnTitle = rawEnTitle.toLowerCase().startsWith('ch') || rawEnTitle.toLowerCase().startsWith('chapter')
      ? rawEnTitle
      : `Chapter ${chapterNumber} — ${rawEnTitle}`;

    const rawFrTitle = parsed.extracted_title?.fr?.trim() || title.trim();
    const cleanFrTitle = rawFrTitle.toLowerCase().startsWith('ch') || rawFrTitle.toLowerCase().startsWith('chapitre')
      ? rawFrTitle
      : `Chapitre ${chapterNumber} : ${rawFrTitle}`;

    const chapterRecord = {
      course_id: courseId,
      chapter_number: Number(chapterNumber),
      code: code.trim().toUpperCase(),
      title: cleanEnTitle,
      title_i18n: {
        en: cleanEnTitle,
        fr: cleanFrTitle,
      },
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
