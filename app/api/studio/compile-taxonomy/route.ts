import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-admin';
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMIT_CONFIG,
  buildRateLimitHeaders,
} from '@/lib/rate-limiter';
import { GOLDEN_COMPETENCY_TAXONOMY_SHOT } from '@/lib/meta-prompt-exemplars';

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
        error: 'No chapters found for this course. Please upload at least one chapter PDF first.',
      }, { status: 400 });
    }

    // Fetch existing labs to discover established micro-competency codes
    const { data: existingLabs } = await supabase
      .from('labs')
      .select('code, title, covered_micro_concepts')
      .eq('course_id', courseId);

    // Extract established taxonomy for continuity & anti-drift
    const establishedCourseConcepts: Array<{ code: string; title?: string; chapter_code?: string; aliases?: string[] }> = [];
    if (Array.isArray(course.competency_matrix)) {
      for (const ch of course.competency_matrix) {
        if (Array.isArray(ch.micro_competencies)) {
          for (const mc of ch.micro_competencies) {
            establishedCourseConcepts.push({
              code: mc.code,
              title: mc.title,
              chapter_code: ch.chapter_code,
              aliases: mc.aliases || [],
            });
          }
        }
      }
    }

    const labReferencedCodes = new Set<string>();
    if (Array.isArray(existingLabs)) {
      for (const l of existingLabs) {
        for (const c of l.covered_micro_concepts || []) {
          labReferencedCodes.add(c);
        }
      }
    }

    // 100% Integral text of all chapters (zero truncation)
    const allChaptersSummary = chapters
      .map((c) => {
        const chTitle = (c.title_i18n && typeof c.title_i18n === 'object' && (c.title_i18n as { fr?: string }).fr)
          ? (c.title_i18n as { fr: string }).fr
          : c.title;
        return `### Chapitre ${c.chapter_number} : ${chTitle} (${c.code})\n${c.markdown_content || ''}\nKey Analogies: ${JSON.stringify(c.key_analogies || [])}`;
      })
      .join('\n\n---\n\n');

    const systemPrompt = `You are an elite educational AI curriculum architect for Socratix.
Your job is to analyze all lecture notes of "${course.title}" (${course.code}), identify the core competencies, and build a canonical deduplicated Competency Taxonomy.

### GOLDEN EXEMPLAR: CANONICAL COMPETENCY TAXONOMY
Notice the clear SCREAMING_SNAKE_CASE codes, clean titles, exact slide references, and aliases:
${JSON.stringify(GOLDEN_COMPETENCY_TAXONOMY_SHOT, null, 2)}
${(establishedCourseConcepts.length > 0 || labReferencedCodes.size > 0) ? `
### ESTABLISHED TAXONOMY CONTINUITY (MANDATORY RULE):
The following micro-competency codes are ALREADY ESTABLISHED in the syllabus or actively referenced by existing practical TP labs:
${JSON.stringify({
  established_course_concepts: establishedCourseConcepts,
  active_lab_referenced_codes: Array.from(labReferencedCodes),
}, null, 2)}

TAXONOMY CONTINUITY INSTRUCTIONS:
1. STABILITY FIRST: You MUST preserve and reuse the exact SCREAMING_SNAKE_CASE codes listed above whenever those topics are covered in the chapters. Do NOT arbitrarily rename or alter established codes.
2. ALIAS PRESERVATION: If an established code had aliases, preserve the established code as 'code' and include alternative terms in 'aliases'.
3. NO DISRUPTION: Existing TP exercises and live telemetry depend on these exact codes.
4. NEW CONCEPTS: Only generate new codes for genuinely new topics not present in the established list.
` : ''}
### INSTRUCTIONS:
Generate "competency_matrix": an array of chapters, each with 2 to 4 canonical micro-competencies in SCREAMING_SNAKE_CASE with clean titles, slide references, descriptions, and aliases. Deduplicate concepts so no concept is defined twice across chapters.`;

    const userPrompt = `Here is the complete lecture text for "${course.title}" (${course.code}):

${allChaptersSummary}`;

    const jsonSchema = {
      name: 'course_taxonomy_compilation_result',
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
                      aliases: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Synonyms or legacy codes recognized for this competency.',
                      },
                    },
                    required: ['code', 'title', 'slide_ref', 'description', 'aliases'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['chapter_code', 'competency_title', 'micro_competencies'],
              additionalProperties: false,
            },
          },
        },
        required: ['competency_matrix'],
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
            prompt_cache_key: `studio-compile-tax-${courseId}`,
            prompt_cache_retention: '24h',
          }),
          signal: AbortSignal.timeout(100_000),
        });

        if (!metaRes.ok) {
          const errText = await metaRes.text();
          throw new Error(`Meta API Error (${metaRes.status}): ${errText}`);
        }

        metaData = await metaRes.json();
        break;
      } catch (callErr: unknown) {
        lastMetaError = callErr;
        console.warn(`[Compile Taxonomy] Attempt ${attempt + 1}/2 failed:`, callErr);
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }

    if (!metaData) {
      throw lastMetaError || new Error('Failed to obtain taxonomy compilation from Meta AI after 2 attempts.');
    }

    const content = metaData.choices?.[0]?.message?.content;
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;

    // Merge established aliases to guarantee zero backward-compatibility loss
    type OutputMicroCompetency = {
      code: string;
      title: string;
      slide_ref: string;
      description: string;
      aliases?: string[];
    };
    type OutputChapterTaxonomy = {
      chapter_code: string;
      competency_title: string;
      micro_competencies: OutputMicroCompetency[];
    };

    const finalTaxonomy = (parsed.competency_matrix as OutputChapterTaxonomy[]).map((ch) => ({
      ...ch,
      micro_competencies: ch.micro_competencies.map((mc) => {
        const prev = establishedCourseConcepts.find((ec) => ec.code === mc.code);
        const combinedAliases = Array.from(new Set([...(prev?.aliases || []), ...(mc.aliases || [])]));
        return {
          ...mc,
          aliases: combinedAliases,
        };
      }),
    }));

    // Update the course competency_matrix in Supabase
    const { error: updateError } = await supabase
      .from('courses')
      .update({
        competency_matrix: finalTaxonomy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', courseId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      competency_matrix: finalTaxonomy,
    });
  } catch (err: unknown) {
    console.error('[Compile Taxonomy Error]:', err);
    const msg = err instanceof Error ? err.message : 'Taxonomy extraction failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

