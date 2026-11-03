import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import { invalidateCourseCache } from '@/lib/course-cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const META_API_KEY = process.env.META_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chapterCode, pageNumber, frContent, courseId } = body;

    if (!chapterCode || !pageNumber) {
      return NextResponse.json({ error: 'Missing chapterCode or pageNumber' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // 1. Check if chapter exists and already has en_markdown cached
    let query = supabase
      .from('course_chapters')
      .select('id, course_id, code, title, pages_json');

    if (courseId) {
      query = query.eq('course_id', courseId);
    }
    const { data: chapters, error: chError } = await query.eq('code', chapterCode).limit(1);

    if (chError) {
      console.error('[Translate Slide] Chapter query error:', chError);
    }

    const chapter = chapters?.[0];
    const pageNum = Number(pageNumber);

    interface ChapterSlidePage {
      page: number;
      text?: string;
      fr_markdown?: string;
      en_markdown?: string;
    }

    const pages = (chapter?.pages_json || []) as ChapterSlidePage[];
    const existingSlide = pages.find((p) => p.page === pageNum);

    // If en_markdown already cached, return immediately
    if (existingSlide?.en_markdown && existingSlide.en_markdown.trim().length > 0) {
      return NextResponse.json({
        en_markdown: existingSlide.en_markdown,
        cached: true,
      });
    }

    // 2. Prepare French text to translate
    const textToTranslate =
      frContent?.trim() ||
      existingSlide?.fr_markdown?.trim() ||
      existingSlide?.text?.trim();

    if (!textToTranslate || textToTranslate.length === 0) {
      return NextResponse.json(
        { error: 'No content available to translate for this slide.' },
        { status: 400 }
      );
    }

    if (!META_API_KEY) {
      return NextResponse.json(
        { error: 'META_API_KEY is not configured on the server.' },
        { status: 503 }
      );
    }

    // 3. Call Meta AI for Just-in-Time 1:1 Translation
    const systemPrompt = `You are an elite bilingual technical curriculum translator for Socratix.
Your role is to translate university computer science lecture slides from French to clean, elegant, educational English Markdown.

STRICT INVARIANTS:
1. ALWAYS start with a concise descriptive Markdown header: ### Slide Title
2. Translate all prose, explanations, bullet points, and notes into natural, idiomatic academic English.
3. CRITICAL: Strictly PRESERVE all code snippets, tag names (e.g. <div>, <header>, <nav>, <main>, <footer>, <p>, <ul>, <li>), CSS properties, HTML attributes (e.g. class, id, alt, src), variable names, function names, and language keywords exactly as they are without translating them.
4. Output ONLY the clean Markdown content without surrounding conversational preambles or code fences.`;

    const userPrompt = `Translate the following French lecture slide (Chapter ${chapterCode}, Slide ${pageNum}) into clean English Markdown:\n\n${textToTranslate}`;

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
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      throw new Error(`Meta API Error (${metaRes.status}): ${errText}`);
    }

    const metaData = await metaRes.json();
    const rawEnContent = metaData.choices?.[0]?.message?.content?.trim();

    if (!rawEnContent) {
      throw new Error('Meta AI returned an empty translation.');
    }

    // Ensure header starts with ### if missing
    let cleanEnMarkdown = rawEnContent.replace(/^```markdown\s*/i, '').replace(/```$/i, '').trim();
    if (!/^#{1,4}\s+/m.test(cleanEnMarkdown)) {
      cleanEnMarkdown = `### ${chapter?.title || 'Slide Reference'}\n\n${cleanEnMarkdown}`;
    }

    // 4. Cache into Supabase course_chapters.pages_json
    if (chapter) {
      let updated = false;
      const updatedPages = pages.map((p) => {
        if (p.page === pageNum) {
          updated = true;
          return { ...p, en_markdown: cleanEnMarkdown };
        }
        return p;
      });

      if (!updated) {
        updatedPages.push({
          page: pageNum,
          text: existingSlide?.text || textToTranslate,
          fr_markdown: existingSlide?.fr_markdown || textToTranslate,
          en_markdown: cleanEnMarkdown,
        });
      }

      await supabase
        .from('course_chapters')
        .update({ pages_json: updatedPages })
        .eq('id', chapter.id);

      if (chapter.course_id) {
        invalidateCourseCache(chapter.course_id);
      }
    }

    return NextResponse.json({
      en_markdown: cleanEnMarkdown,
      cached: false,
    });
  } catch (err: unknown) {
    console.error('[Translate Slide Exception]:', err);
    const msg = err instanceof Error ? err.message : 'Translation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

