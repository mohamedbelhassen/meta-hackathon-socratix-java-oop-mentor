import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import { invalidateCourseCache } from '@/lib/course-cache';
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMIT_CONFIG,
  buildRateLimitHeaders,
} from '@/lib/rate-limiter';
import { GOLDEN_TUTOR_PROMPT_SHOT } from '@/lib/meta-prompt-exemplars';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const META_API_KEY = process.env.META_API_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!META_API_KEY) {
      return NextResponse.json({ error: 'META_API_KEY is not configured on the server.' }, { status: 503 });
    }

    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(`studio_compile_${clientIp}`, RATE_LIMIT_CONFIG.studioLimitPerMinute, 60);
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: `Trop de requêtes de compilation. Veuillez patienter ${rateCheck.resetSeconds}s.` },
        { status: 429, headers: buildRateLimitHeaders(rateCheck) }
      );
    }

    const { courseId } = await req.json();
    if (!courseId) {
      return NextResponse.json({ error: 'Missing courseId parameter.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const { data: chapters, error: chaptersError } = await supabase
      .from('course_chapters')
      .select('id, course_id, chapter_number, code, title, title_i18n, markdown_content, key_analogies')
      .eq('course_id', courseId)
      .order('chapter_number', { ascending: true });

    if (chaptersError || !chapters || chapters.length === 0) {
      return NextResponse.json({
        error: 'No chapters found for this course.',
      }, { status: 400 });
    }

    // Format taxonomy for AI prompt
    type MicroCompetency = { code: string; title: string; slide_ref: string; description: string };
    type ChapterTaxonomy = { chapter_code: string; competency_title: string; micro_competencies: MicroCompetency[] };

    const taxonomy = Array.isArray(course.competency_matrix) ? (course.competency_matrix as ChapterTaxonomy[]) : [];
    const taxonomySummary = taxonomy
      .map(
        (ch) =>
          `${ch.chapter_code} (${ch.competency_title}):\n` +
          (ch.micro_competencies || [])
            .map((mc) => `  - ${mc.code} (${mc.slide_ref}): ${mc.title} - ${mc.description}`)
            .join('\n')
      )
      .join('\n\n');

    // Format key analogies for AI prompt
    const analogiesSummary = chapters
      .map((c) => {
        const analogies = Array.isArray(c.key_analogies) ? (c.key_analogies as Array<{ concept: string; analogy_summary: string; slide: number }>) : [];
        return `Ch.${c.chapter_number} (${c.code}): ${analogies.map((a) => `${a.concept} -> ${a.analogy_summary} (Slide ${a.slide})`).join('; ')}`;
      })
      .join('\n');

    const systemPrompt = `You are an elite educational AI curriculum architect for Socratix.
Your job is to draft a high-impact course-specific Tutor System Prompt anchored to the established curriculum taxonomy and analogies.

### GOLDEN EXEMPLAR: CUSTOM TUTOR PROMPT (PEDAGOGICAL ANCHORING & FEW-SHOTS)
Notice how this anchors domain errors to exact slide numbers and provides 2 domain-specific reasoning examples:
${GOLDEN_TUTOR_PROMPT_SHOT}

### INSTRUCTIONS:
Generate "compiled_tutor_prompt":
1. "### PEDAGOGICAL ANCHORING (MANDATORY)" section mapping typical domain mistakes to course analogies and exact slide numbers.
2. "### REASONING EXAMPLES (FEW-SHOT PROMPTING)" containing Example 1 (in-progress Socratic guidance) and Example 2 (milestone completed congratulatory verdict) tailored specifically to "${course.title}".`;

    const userPrompt = `Here is the canonical Competency Taxonomy and Key Analogies for "${course.title}" (${course.code}):

### CANONICAL COMPETENCY TAXONOMY:
${taxonomySummary}

### KEY ANALOGIES & SLIDE REFERENCES:
${analogiesSummary}`;

    const jsonSchema = {
      name: 'course_prompt_compilation_result',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          compiled_tutor_prompt: {
            type: 'string',
            description: 'Markdown containing PEDAGOGICAL ANCHORING and FEW-SHOT reasoning examples.',
          },
        },
        required: ['compiled_tutor_prompt'],
        additionalProperties: false,
      },
    };

    interface MetaChatResponse {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    }

    let metaData: MetaChatResponse | null = null;
    let lastMetaError: unknown;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
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
            prompt_cache_key: `studio-compile-prompt-${courseId}`,
            prompt_cache_retention: '24h',
          }),
          signal: AbortSignal.timeout(100_000),
        });

        if (!metaRes.ok) {
          const errText = await metaRes.text();
          throw new Error(`Meta AI Error (${metaRes.status}): ${errText}`);
        }

        metaData = await metaRes.json();
        break;
      } catch (callErr: unknown) {
        lastMetaError = callErr;
        console.warn(`[Compile Prompt] Attempt ${attempt + 1}/2 failed:`, callErr);
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }

    if (!metaData) {
      throw lastMetaError || new Error('Failed to obtain prompt compilation from Meta AI after 2 attempts.');
    }

    const content = metaData.choices?.[0]?.message?.content;
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;

    // 100% full markdown chapters summary for Knowledge Base
    const allChaptersFullText = chapters
      .map((c) => {
        const chTitle = (c.title_i18n && typeof c.title_i18n === 'object' && (c.title_i18n as { fr?: string }).fr)
          ? (c.title_i18n as { fr: string }).fr
          : c.title;
        return `### Chapitre ${c.chapter_number} : ${chTitle} (${c.code})\n${c.markdown_content || ''}\nKey Analogies: ${JSON.stringify(c.key_analogies || [])}`;
      })
      .join('\n\n---\n\n');

    // Assemble deterministic compiled_knowledge_base
    const compiledKnowledgeBase = `# ${course.title} (${course.code}) — Official Curriculum Reference

${allChaptersFullText}

---

## Canonical Competency Taxonomy
${taxonomy
  .map(
    (tax) =>
      `### ${tax.chapter_code}: ${tax.competency_title}\n` +
      (tax.micro_competencies || [])
        .map((mc) => `- \`${mc.code}\` (${mc.slide_ref}): ${mc.title}`)
        .join('\n')
  )
  .join('\n\n')}`;

    // Update the course with compiled prompt and knowledge base
    const { data: updatedCourse, error: updateError } = await supabase
      .from('courses')
      .update({
        compiled_tutor_prompt: parsed.compiled_tutor_prompt,
        compiled_knowledge_base: compiledKnowledgeBase,
        updated_at: new Date().toISOString(),
      })
      .eq('id', courseId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Invalidate course bundle cache
    invalidateCourseCache(courseId);

    return NextResponse.json({
      success: true,
      course: updatedCourse,
    });
  } catch (err: unknown) {
    console.error('[Compile Prompt Error]:', err);
    const msg = err instanceof Error ? err.message : 'Tutor prompt calibration failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

