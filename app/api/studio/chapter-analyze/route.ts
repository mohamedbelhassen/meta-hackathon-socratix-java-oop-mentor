import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMIT_CONFIG,
  buildRateLimitHeaders,
} from '@/lib/rate-limiter';
import { cleanPdfPages, formatRawSlideTextToMarkdown, CleanedPage } from '@/lib/pdf-cleaner';
import { GOLDEN_CHAPTER_SYNTHESIS_SHOT } from '@/lib/meta-prompt-exemplars';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const META_API_KEY = process.env.META_API_KEY;

interface MetaChatChoice {
  message?: {
    content?: string;
  };
}

async function callMetaAI(systemPrompt: string, userPrompt: string, jsonSchema: unknown, cacheKey?: string, timeoutMs = 60_000) {
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
        json_schema: jsonSchema,
      },
      temperature: 0.1,
      reasoning_effort: 'low',
      ...(cacheKey ? { prompt_cache_key: cacheKey, prompt_cache_retention: '24h' } : {}),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!metaRes.ok) {
    const errText = await metaRes.text();
    throw new Error(`Meta API Error (${metaRes.status}): ${errText}`);
  }

  const metaData = await metaRes.json();
  const content = (metaData.choices as MetaChatChoice[])?.[0]?.message?.content;
  return typeof content === 'string' ? JSON.parse(content) : content;
}

export async function POST(req: NextRequest) {
  try {
    if (!META_API_KEY) {
      return NextResponse.json({ error: 'META_API_KEY is not configured on the server.' }, { status: 503 });
    }

    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(`studio_chapter_${clientIp}`, RATE_LIMIT_CONFIG.studioLimitPerMinute, 60);
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: `Trop de requêtes d'analyse de chapitre. Veuillez patienter ${rateCheck.resetSeconds}s.` },
        { status: 429, headers: buildRateLimitHeaders(rateCheck) }
      );
    }

    const body = await req.json();
    const { courseId, chapterNumber, code, title, pdfUrl, pages } = body;

    if (!courseId || !chapterNumber || !code || !title || !pages || !Array.isArray(pages)) {
      return NextResponse.json({ error: 'Missing required parameters for chapter analysis.' }, { status: 400 });
    }

    if (pages.length > 100) {
      return NextResponse.json({ error: 'Le fichier PDF est trop volumineux (maximum 100 pages par chapitre).' }, { status: 400 });
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

    // 1. Clean PDF pages using frequency-based perimeter analyzer
    const MAX_PAGES = 200;
    const pagesSlice = pages.slice(0, MAX_PAGES);
    const { cleanedPages } = cleanPdfPages(pagesSlice);

    if (cleanedPages.length === 0) {
      return NextResponse.json({ error: 'No readable pages extracted from document.' }, { status: 400 });
    }

    // 2. Prepare sample for global chapter synthesis (markdown_content, title, key analogies)
    const MAX_CHARS_PER_PAGE = 8000;
    const MAX_TOTAL_CHARS = 180000;
    const totalRawChars = cleanedPages.reduce((sum: number, p: CleanedPage) => sum + (p.text?.length || 0), 0);
    const dynamicPerCharLimit = totalRawChars > MAX_TOTAL_CHARS
      ? Math.max(1200, Math.floor(MAX_TOTAL_CHARS / cleanedPages.length))
      : MAX_CHARS_PER_PAGE;

    const pagesTextSample = cleanedPages
      .map((p: CleanedPage) => `[Page/Slide ${p.page}] ${(p.text || '').slice(0, dynamicPerCharLimit)}`)
      .join('\n');

    // 3. Fast Resilient Chapter Distillation Flow
    // If document is concise (<= 12 pages & <= 8000 chars), single-pass extracts metadata + slide markdowns.
    // For standard/large slide decks (> 12 pages, e.g. 47 pages), single-pass produces deep global curriculum
    // synthesis with zero-timeout risk (~18-22s), and formatRawSlideTextToMarkdown formats all slides instantaneously.
    const isSmallDeck = cleanedPages.length <= 12 && totalRawChars <= 8000;
    const collectedSlideMarkdowns: Array<{ page: number; fr_markdown: string; en_markdown: string }> = [];

    let extractedTitle = { fr: title, en: title };
    let markdownContent = '';
    let keyAnalogies: Array<{ slide: number; concept: string; analogy_summary: string }> = [];

    if (isSmallDeck) {
      // ------------------------------------------------------------------------
      // CONCISE DECK: Document fits in one call (metadata + all slide markdowns)
      // ------------------------------------------------------------------------
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
4. Preserve and highlight exact code identifiers across any programming paradigm without translating code identifiers, and document explicit language-specific anti-patterns/dangers.
5. Extract key analogies (e.g. Oven, Animals, Download Manager, etc.) with their slide or page number.
6. Provide verbatim, faithful slide-by-slide transcriptions and translations in 'pages_markdown' for ALL pages/slides (from Page ${cleanedPages[0].page} to Page ${cleanedPages[cleanedPages.length - 1].page}).
   CRITICAL: Do NOT summarize multiple slides together (e.g. do NOT merge Slide 11 and 12). Each entry must strictly correspond to its single slide number.
   - 'fr_markdown': clean French markdown transcription. ALWAYS start with a descriptive header (### Titre de la diapositive). Include section headers, lists, and code blocks. Strictly omit dates, university footers, and page numbers.
   - 'en_markdown': faithful 1:1 English translation of this single slide. ALWAYS start with a descriptive header (### Slide Title). Maintain exact code identifiers without translating variable or class names.`;

      const userPrompt = `Distill Chapter ${chapterNumber}: "${title}" (${code}) based on the following extracted document text:

${pagesTextSample}`;

      const singlePassSchema = {
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
                  description: 'Le titre officiel du chapitre extrait du document en français.',
                },
                en: {
                  type: 'string',
                  description: 'The clean English translation of the chapter title for the international jury.',
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
            pages_markdown: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  fr_markdown: { type: 'string' },
                  en_markdown: { type: 'string' },
                },
                required: ['page', 'fr_markdown', 'en_markdown'],
                additionalProperties: false,
              },
            },
          },
          required: ['extracted_title', 'markdown_content', 'key_analogies', 'pages_markdown'],
          additionalProperties: false,
        },
      };

      const parsed = await callMetaAI(systemPrompt, userPrompt, singlePassSchema, `studio-chapter-single-${courseId}`);
      extractedTitle = parsed.extracted_title || extractedTitle;
      markdownContent = parsed.markdown_content || '';
      keyAnalogies = parsed.key_analogies || [];
      if (Array.isArray(parsed.pages_markdown)) {
        collectedSlideMarkdowns.push(...parsed.pages_markdown);
      }
    } else {
      // ------------------------------------------------------------------------
      // FULL SLIDE DECK / POLYCOPIÉ: High-density global synthesis across all pages
      // Completes in ~18-22s for up to 200 pages without any serverless timeout risk.
      // ------------------------------------------------------------------------
      const systemPromptGlobal = `You are an elite educational AI curriculum engineer for Socratix.
Course Context: "${course.title}" (${course.code}) — File extensions: ${JSON.stringify(course.file_extensions || ['.java'])}.
Your role is to distill university course material into an ultra-dense, mathematically precise course chapter synthesis.

${GOLDEN_CHAPTER_SYNTHESIS_SHOT}

### INSTRUCTIONS:
1. Extract official chapter title ('extracted_title') in French ('fr') and English ('en').
2. Synthesize the entire chapter into 'markdown_content' with "(Slide X)" or "(Page X)" anchors and concrete anti-patterns.
3. Extract key analogies into 'key_analogies' with their slide or page number.
4. Maintain exact code identifiers across any programming paradigm without translating variable or class names.`;

      const userPromptGlobal = `Distill Chapter ${chapterNumber}: "${title}" (${code}) based on the following extracted document text (${cleanedPages.length} pages):

${pagesTextSample}`;

      const globalSchema = {
        name: 'chapter_global_synthesis_result',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            extracted_title: {
              type: 'object',
              properties: {
                fr: { type: 'string' },
                en: { type: 'string' },
              },
              required: ['fr', 'en'],
              additionalProperties: false,
            },
            markdown_content: { type: 'string' },
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
          },
          required: ['extracted_title', 'markdown_content', 'key_analogies'],
          additionalProperties: false,
        },
      };

      const parsedGlobal = await callMetaAI(systemPromptGlobal, userPromptGlobal, globalSchema, `studio-chapter-meta-${courseId}`);
      extractedTitle = parsedGlobal.extracted_title || extractedTitle;
      markdownContent = parsedGlobal.markdown_content || '';
      keyAnalogies = parsedGlobal.key_analogies || [];
    }

    // 4. Merge collected pages_markdown with cleaned pages
    const slideMarkdownMap = new Map<number, { fr_markdown: string; en_markdown: string }>();
    for (const sm of collectedSlideMarkdowns) {
      if (typeof sm.page === 'number') {
        slideMarkdownMap.set(sm.page, {
          fr_markdown: sm.fr_markdown,
          en_markdown: sm.en_markdown,
        });
      }
    }

    const enrichedPages = cleanedPages.map((p: CleanedPage) => {
      const found = slideMarkdownMap.get(p.page);
      return {
        page: p.page,
        text: p.text,
        fr_markdown: found?.fr_markdown?.trim() || formatRawSlideTextToMarkdown(p.text, undefined, course.file_extensions),
        en_markdown: found?.en_markdown?.trim() || undefined,
      };
    });

    const rawEnTitle = extractedTitle?.en?.trim() || title.trim();
    const cleanEnTitle = rawEnTitle.toLowerCase().startsWith('ch') || rawEnTitle.toLowerCase().startsWith('chapter')
      ? rawEnTitle
      : `Chapter ${chapterNumber} — ${rawEnTitle}`;

    const rawFrTitle = extractedTitle?.fr?.trim() || title.trim();
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
      markdown_content: markdownContent,
      pages_json: enrichedPages,
      key_analogies: keyAnalogies,
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
      is_small_deck: isSmallDeck,
    });
  } catch (err: unknown) {
    console.error('[Chapter Analyze Error]:', err);
    const errMsg = err instanceof Error ? err.message : 'Chapter analysis failed. Please verify your PDF format or try again.';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
