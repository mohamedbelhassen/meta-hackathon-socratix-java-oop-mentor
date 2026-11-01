import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { cleanPdfPages } from '@/lib/pdf-cleaner';
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
      .select('title, code, content_language, tutor_language, file_extensions')
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
    const { cleanedPages } = cleanPdfPages(pagesSlice);

    const totalRawChars = cleanedPages.reduce((sum: number, p: { text: string }) => sum + (p.text?.length || 0), 0);
    const dynamicPerCharLimit = totalRawChars > MAX_TOTAL_CHARS
      ? Math.max(1200, Math.floor(MAX_TOTAL_CHARS / cleanedPages.length))
      : MAX_CHARS_PER_PAGE;

    const pagesTextSample = cleanedPages
      .map((p: { page: number; text: string }) => `[Page/Slide ${p.page}] ${(p.text || '').slice(0, dynamicPerCharLimit)}`)
      .join('\n');

    const systemPrompt = `You are an elite educational AI curriculum engineer for Socratix.
Course Context: "${course.title}" (${course.code}) — File extensions: ${JSON.stringify(course.file_extensions || ['.java'])}.
Your role is to distill university course material (lecture slides or full lecture notes/polycopié) into ultra-dense, mathematically precise course chapter syntheses.

### GOLDEN EXEMPLAR (HOW TO SUMMARIZE A CHAPTER):
Study the following exemplar extracted from a proven OOP curriculum. Notice the exact slide references "(Slides X-Y)", the precise class/analogy names, and the concrete anti-pattern warnings:

${GOLDEN_CHAPTER_SYNTHESIS_SHOT}

### INSTRUCTIONS:
1. Extract the official chapter title from the document title slide/header in both French ('fr') and English ('en') ('extracted_title').
2. Synthesize the provided material in the course's content language (${course.content_language}).
3. Include exact reference anchors "(Slide X)" or "(Page X)" (or "(Slides X-Y)" / "(Pages X-Y)") for every concept.
4. Preserve and highlight exact code identifiers across any programming paradigm (classes, interfaces, methods, exceptions in OOP; structs, pointers, macros, headers in C/C++; functions, modules, decorators, $variables, schema keys in Python/PHP/JS/SQL) without translating code identifiers, and document explicit language-specific anti-patterns/dangers.
5. Extract key analogies (e.g. Oven, Animals, Download Manager, etc.) with their slide or page number.
6. Provide slide-by-slide pedagogical summaries and translations in 'pages_summary' for key slides:
   - 'en_summary': a concise 1-2 sentence English pedagogical takeaway.
   - 'en_markdown': a clean, beautifully formatted English Markdown transcription of the slide with code in \`\`\`java blocks, strictly omitting dates, professor names, or footer page numbers.
   - 'fr_markdown': a clean, formatted French Markdown transcription of the slide with code in \`\`\`java blocks, strictly omitting dates, professor names, or footer page numbers.`;

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
                en_markdown: { type: 'string' },
                fr_markdown: { type: 'string' },
              },
              required: ['page', 'en_summary', 'en_markdown', 'fr_markdown'],
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

    // Merge pages_summary with cleaned pages
    const enrichedPages = cleanedPages.map((p: { page: number; text: string }) => {
      const found = parsed.pages_summary?.find((s: { page: number }) => s.page === p.page);
      return {
        page: p.page,
        text: p.text,
        en_summary: found?.en_summary || undefined,
        en_markdown: found?.en_markdown || undefined,
        fr_markdown: found?.fr_markdown || undefined,
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
