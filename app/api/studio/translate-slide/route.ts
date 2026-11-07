import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import { invalidateCourseCache } from '@/lib/course-cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const META_API_KEY = process.env.META_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      chapterCode,
      pageNumber,
      content,
      frContent,
      sourceLang,
      targetLang,
      courseId,
    } = body;

    if (!chapterCode || !pageNumber) {
      return NextResponse.json({ error: 'Missing chapterCode or pageNumber' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // 1. Fetch chapter and course metadata
    let query = supabase
      .from('course_chapters')
      .select('id, course_id, code, title, title_i18n, pages_json');

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

    // Determine course content language
    let courseContentLang = 'fr';
    if (chapter?.course_id) {
      const { data: cData } = await supabase
        .from('courses')
        .select('content_language')
        .eq('id', chapter.course_id)
        .maybeSingle();
      if (cData?.content_language) {
        courseContentLang = cData.content_language.toLowerCase();
      }
    }

    const isEnglishCourse = courseContentLang === 'en';

    // Determine resolved target and source languages
    // If course is English, default target is 'fr' (unless specified).
    // If course is French, default target is 'en' (unless specified).
    const resolvedTargetLang: 'en' | 'fr' = (
      targetLang || (isEnglishCourse ? 'fr' : 'en')
    ).toLowerCase() as 'en' | 'fr';

    const resolvedSourceLang: 'en' | 'fr' = (
      sourceLang || (resolvedTargetLang === 'en' ? 'fr' : 'en')
    ).toLowerCase() as 'en' | 'fr';

    // 2. Cache check
    if (resolvedTargetLang === 'en') {
      if (existingSlide?.en_markdown && existingSlide.en_markdown.trim().length > 0) {
        return NextResponse.json({
          en_markdown: existingSlide.en_markdown,
          markdown: existingSlide.en_markdown,
          sourceLang: resolvedSourceLang,
          targetLang: 'en',
          cached: true,
        });
      }
    } else {
      // resolvedTargetLang === 'fr'
      // If course is English, fr_markdown is only genuine French if en_markdown also exists
      const isGenuineFrench = isEnglishCourse
        ? Boolean(existingSlide?.fr_markdown && existingSlide?.en_markdown)
        : Boolean(existingSlide?.fr_markdown);

      if (isGenuineFrench && existingSlide?.fr_markdown && existingSlide.fr_markdown.trim().length > 0) {
        return NextResponse.json({
          fr_markdown: existingSlide.fr_markdown,
          markdown: existingSlide.fr_markdown,
          sourceLang: resolvedSourceLang,
          targetLang: 'fr',
          cached: true,
        });
      }
    }

    // 3. Prepare text to translate
    let textToTranslate = '';
    if (resolvedTargetLang === 'en') {
      textToTranslate =
        content?.trim() ||
        frContent?.trim() ||
        existingSlide?.fr_markdown?.trim() ||
        existingSlide?.text?.trim() ||
        '';
    } else {
      // Translating to French
      textToTranslate =
        content?.trim() ||
        existingSlide?.en_markdown?.trim() ||
        (isEnglishCourse ? existingSlide?.fr_markdown?.trim() : undefined) ||
        existingSlide?.text?.trim() ||
        '';
    }

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

    // 4. Configure bidirectional Meta AI prompt
    let systemPrompt = '';
    let userPrompt = '';

    if (resolvedTargetLang === 'en') {
      systemPrompt = `You are an elite bilingual technical curriculum translator for Socratix.
Your role is to translate university computer science lecture slides from French to clean, elegant, educational English Markdown.

STRICT INVARIANTS:
1. ALWAYS start with a concise descriptive Markdown header: ### Slide Title
2. Translate all prose, explanations, bullet points, and notes into natural, idiomatic academic English.
3. CRITICAL: Strictly PRESERVE all code snippets, tag names (e.g. <div>, <header>, <nav>, <main>, <footer>, <p>, <ul>, <li>), CSS properties, HTML attributes (e.g. class, id, alt, src), variable names, function names, and language keywords exactly as they are without translating them.
4. Output ONLY the clean Markdown content without surrounding conversational preambles or code fences.`;

      userPrompt = `Translate the following French lecture slide (Chapter ${chapterCode}, Slide ${pageNum}) into clean English Markdown:\n\n${textToTranslate}`;
    } else {
      systemPrompt = `You are an elite bilingual technical curriculum translator for Socratix.
Your role is to translate university computer science lecture slides from English to clean, elegant, educational French Markdown.

STRICT INVARIANTS:
1. ALWAYS start with a concise descriptive Markdown header: ### Titre de la diapositive
2. Translate all prose, explanations, bullet points, and notes into natural, idiomatic academic French.
3. CRITICAL: Strictly PRESERVE all code snippets, tag names (e.g. <div>, <header>, <nav>, <main>, <footer>, <p>, <ul>, <li>), CSS properties, HTML attributes (e.g. class, id, alt, src), variable names, function names, and language keywords exactly as they are without translating them.
4. Output ONLY the clean Markdown content without surrounding conversational preambles or code fences.`;

      userPrompt = `Translate the following English lecture slide (Chapter ${chapterCode}, Slide ${pageNum}) into clean French Markdown:\n\n${textToTranslate}`;
    }

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
    const rawTranslatedContent = metaData.choices?.[0]?.message?.content?.trim();

    if (!rawTranslatedContent) {
      throw new Error('Meta AI returned an empty translation.');
    }

    // Ensure header starts with ### if missing
    let cleanTranslatedMarkdown = rawTranslatedContent
      .replace(/^```markdown\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    if (!/^#{1,4}\s+/m.test(cleanTranslatedMarkdown)) {
      const defaultTitle = resolvedTargetLang === 'en'
        ? (chapter?.title_i18n?.en || chapter?.title || 'Slide Reference')
        : (chapter?.title_i18n?.fr || chapter?.title || 'Référence Diapositive');
      cleanTranslatedMarkdown = `### ${defaultTitle}\n\n${cleanTranslatedMarkdown}`;
    }

    // 5. Cache into Supabase course_chapters.pages_json
    if (chapter) {
      let updated = false;
      const updatedPages = pages.map((p) => {
        if (p.page === pageNum) {
          updated = true;
          if (resolvedTargetLang === 'en') {
            return {
              ...p,
              en_markdown: cleanTranslatedMarkdown,
              fr_markdown: p.fr_markdown || textToTranslate,
            };
          } else {
            return {
              ...p,
              fr_markdown: cleanTranslatedMarkdown,
              en_markdown: p.en_markdown || textToTranslate,
            };
          }
        }
        return p;
      });

      if (!updated) {
        if (resolvedTargetLang === 'en') {
          updatedPages.push({
            page: pageNum,
            text: existingSlide?.text || textToTranslate,
            fr_markdown: existingSlide?.fr_markdown || textToTranslate,
            en_markdown: cleanTranslatedMarkdown,
          });
        } else {
          updatedPages.push({
            page: pageNum,
            text: existingSlide?.text || textToTranslate,
            en_markdown: existingSlide?.en_markdown || textToTranslate,
            fr_markdown: cleanTranslatedMarkdown,
          });
        }
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
      en_markdown: resolvedTargetLang === 'en' ? cleanTranslatedMarkdown : (existingSlide?.en_markdown || textToTranslate),
      fr_markdown: resolvedTargetLang === 'fr' ? cleanTranslatedMarkdown : (existingSlide?.fr_markdown || textToTranslate),
      markdown: cleanTranslatedMarkdown,
      sourceLang: resolvedSourceLang,
      targetLang: resolvedTargetLang,
      cached: false,
    });
  } catch (err: unknown) {
    console.error('[Translate Slide Exception]:', err);
    const msg = err instanceof Error ? err.message : 'Translation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
