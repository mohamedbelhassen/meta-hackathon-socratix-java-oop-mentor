import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import {
  GOLDEN_COMPETENCY_TAXONOMY_SHOT,
  GOLDEN_TUTOR_PROMPT_SHOT,
} from '@/lib/meta-prompt-exemplars';

const META_API_KEY = process.env.META_API_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!META_API_KEY) {
      return NextResponse.json({ error: 'META_API_KEY is not configured on the server.' }, { status: 503 });
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
      .select('*')
      .eq('course_id', courseId)
      .order('chapter_number', { ascending: true });

    if (chaptersError || !chapters || chapters.length === 0) {
      return NextResponse.json({
        error: 'No chapters found for this course. Please upload at least one chapter PDF first.',
      }, { status: 400 });
    }

    // Combine chapters markdown
    const allChaptersSummary = chapters
      .map(
        (c) => {
          const chTitle = (c.title_i18n && typeof c.title_i18n === 'object' && (c.title_i18n as { fr?: string }).fr)
            ? (c.title_i18n as { fr: string }).fr
            : c.title;
          return `### Chapitre ${c.chapter_number} : ${chTitle} (${c.code})\n${c.markdown_content}\nKey Analogies: ${JSON.stringify(c.key_analogies)}`;
        }
      )
      .join('\n\n---\n\n');

    const systemPrompt = `You are an elite educational AI curriculum architect for Socratix.
Your job is to analyze all chapters of a course, build a canonical deduplicated Competency Taxonomy, and draft a high-impact course-specific Tutor System Prompt.

### GOLDEN EXEMPLAR 1: CANONICAL COMPETENCY TAXONOMY
Notice the clear SCREAMING_SNAKE_CASE codes, clean titles, and exact slide references:
${JSON.stringify(GOLDEN_COMPETENCY_TAXONOMY_SHOT, null, 2)}

### GOLDEN EXEMPLAR 2: CUSTOM TUTOR PROMPT (PEDAGOGICAL ANCHORING & FEW-SHOTS)
Notice how this anchors errors to exact slide numbers and provides 2 domain-specific reasoning examples:
${GOLDEN_TUTOR_PROMPT_SHOT}

### INSTRUCTIONS:
1. Generate "competency_matrix": an array of chapters, each with 2 to 4 canonical micro-competencies in SCREAMING_SNAKE_CASE. Deduplicate concepts so no concept is defined twice across chapters.
2. Generate "compiled_tutor_prompt":
   - "### PEDAGOGICAL ANCHORING (MANDATORY)" section mapping typical domain mistakes to course analogies and exact slide numbers.
   - "### REASONING EXAMPLES (FEW-SHOT PROMPTING)" containing Example 1 (in-progress Socratic guidance) and Example 2 (milestone completed congratulatory verdict) tailored specifically to "${course.title}".`;

    const userPrompt = `Here are the synthesized chapters of "${course.title}" (${course.code}):

${allChaptersSummary}`;

    const jsonSchema = {
      name: 'course_compilation_result',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          competency_matrix: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                chapter_code: { type: 'string' },
                competency_title: { type: 'string' },
                micro_competencies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      code: { type: 'string' },
                      title: { type: 'string' },
                      slide_ref: { type: 'string' },
                      description: { type: 'string' },
                    },
                    required: ['code', 'title', 'slide_ref', 'description'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['chapter_code', 'competency_title', 'micro_competencies'],
              additionalProperties: false,
            },
          },
          compiled_tutor_prompt: {
            type: 'string',
            description: 'Markdown containing PEDAGOGICAL ANCHORING and FEW-SHOT reasoning examples.',
          },
        },
        required: ['competency_matrix', 'compiled_tutor_prompt'],
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

    // Assemble deterministic compiled_knowledge_base (~3500 tokens)
    const compiledKnowledgeBase = `# ${course.title} (${course.code}) — Official Curriculum Reference

${allChaptersSummary}

---

## Canonical Competency Taxonomy
${parsed.competency_matrix
  .map(
    (tax: { chapter_code: string; competency_title: string; micro_competencies: Array<{ code: string; title: string; slide_ref: string }> }) =>
      `### ${tax.chapter_code}: ${tax.competency_title}\n` +
      tax.micro_competencies
        .map((mc) => `- \`${mc.code}\` (${mc.slide_ref}): ${mc.title}`)
        .join('\n')
  )
  .join('\n\n')}`;

    // Update the course
    const { data: updatedCourse, error: updateError } = await supabase
      .from('courses')
      .update({
        competency_matrix: parsed.competency_matrix,
        compiled_tutor_prompt: parsed.compiled_tutor_prompt,
        compiled_knowledge_base: compiledKnowledgeBase,
        updated_at: new Date().toISOString(),
      })
      .eq('id', courseId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      course: updatedCourse,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Course compilation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
