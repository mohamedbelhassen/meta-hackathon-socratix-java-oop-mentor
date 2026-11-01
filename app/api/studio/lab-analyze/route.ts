import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { GOLDEN_LAB_DECOMPOSITION_SHOT } from '@/lib/meta-prompt-exemplars';

const META_API_KEY = process.env.META_API_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!META_API_KEY) {
      return NextResponse.json({ error: 'META_API_KEY is not configured on the server.' }, { status: 503 });
    }

    const body = await req.json();
    const { courseId, labNumber, code, title, description, pdfUrl, pages } = body;

    if (!courseId || !labNumber || !code || !title || !pages || !Array.isArray(pages)) {
      return NextResponse.json({ error: 'Missing required parameters for lab analysis.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('title, code, content_language, file_extensions, competency_matrix')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    // Extract available micro_competency codes
    const availableConcepts: string[] = [];
    if (Array.isArray(course.competency_matrix)) {
      for (const cat of course.competency_matrix) {
        if (Array.isArray(cat.micro_competencies)) {
          for (const mc of cat.micro_competencies) {
            if (mc.code) availableConcepts.push(mc.code);
          }
        }
      }
    }

    const pagesTextSample = pages
      .slice(0, 30)
      .map((p: { page: number; text: string }) => `=== PAGE ${p.page} ===\n${p.text.slice(0, 15000)}`)
      .join('\n\n');

    const systemPrompt = `You are an elite educational AI lab curriculum engineer for Socratix.
Your job is to read an authentic university programming lab assignment (TP), extract its official title, formulate a bilingual concise 1-2 sentence pedagogical description in both English ('en') and French ('fr'), decompose it into structured activities, derive 2 to 3 sequential milestones per activity, identify which course micro-competencies are practiced, and generate 2 1-click Demo Presets for hackathon judges.

### ABSOLUTE FIDELITY RULES (ZERO HALLUCINATIONS):
1. STRUCTURAL INTEGRITY: Decompose the lab into ONLY the activities explicitly present in the assignment text (e.g., 'Activité N°1', 'Activité N°2'). NEVER invent activities, NEVER merge separate activities, and NEVER change the number of activities.
2. EXTRACT-THEN-TRANSLATE PROTOCOL: For all bilingual fields ('extracted_title', 'description', 'title_i18n', 'instructions_i18n', 'validation_criteria_i18n'), you MUST provide 'fr' FIRST as a faithful, verbatim extraction from the French assignment text, and 'en' SECOND as an accurate, elegant English pedagogical translation.
3. CODE IDENTIFIERS ARE SACRED: All class names, interface names, method names, variable names, exception names, and file names (e.g. SaisieErroneeException.java, PaiementInvalideException.java, Aliment.java, Four.java, TestFour.java, Calculatrice.java, YallaPOS.java) MUST be preserved EXACTLY as written in the lab assignment in BOTH the 'fr' and 'en' fields. DO NOT translate code identifiers (e.g. do not translate Four to Oven or Aliment to Food in Java class names or target_files!). Target files must strictly match the code files required by the lab statement.

### GOLDEN EXEMPLAR (HOW TO DECOMPOSE A LAB):
Notice how it clearly splits assimilation from project integration, defines minimal validation criteria, and generates working code presets:
${JSON.stringify(GOLDEN_LAB_DECOMPOSITION_SHOT, null, 2)}

### CANONICAL COURSE MICRO-COMPETENCIES:
You MUST select covered concepts ONLY from this list:
${JSON.stringify(availableConcepts.length > 0 ? availableConcepts : ['VISIBILITY_ENCAPSULATION', 'DEFENSIVE_SETTERS', 'CONSTRUCTORS_THIS'])}

### FILE EXTENSIONS FOR THIS COURSE:
${JSON.stringify(course.file_extensions || ['.java'])}`;

    const userPrompt = `Decompose Lab ${labNumber}: "${title}" (${code}) based on the following text:

${pagesTextSample}`;

    const jsonSchema = {
      name: 'lab_decomposition_result',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          extracted_title: {
            type: 'object',
            properties: {
              fr: {
                type: 'string',
                description: 'Le titre officiel complet du TP extrait mot pour mot de l\'en-tête du document en français (ex: TP 12 : Exceptions personnalisées et Finalisation du Projet).',
              },
              en: {
                type: 'string',
                description: 'The clean English translation of the official lab title for the international jury (e.g., Custom Exceptions and Project Finalization).',
              },
            },
            required: ['fr', 'en'],
            additionalProperties: false,
          },
          description: {
            type: 'object',
            properties: {
              fr: {
                type: 'string',
                description: 'Un résumé pédagogique concis en 1 à 2 phrases des compétences et objectifs du TP en français.',
              },
              en: {
                type: 'string',
                description: 'A concise 1-2 sentence pedagogical summary of what this lab assignment teaches and implements in English.',
              },
            },
            required: ['fr', 'en'],
            additionalProperties: false,
          },
          activities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                order: { type: 'integer' },
                title_i18n: {
                  type: 'object',
                  properties: {
                    fr: {
                      type: 'string',
                      description: 'Le titre exact mot pour mot de l\'activité tel qu\'écrit dans le PDF (ex: Activité N°1 (Indépendante) : Contrôle de saisie et exception sur-mesure).',
                    },
                    en: {
                      type: 'string',
                      description: 'The English translation of the activity title, keeping any code names unchanged.',
                    },
                  },
                  required: ['fr', 'en'],
                  additionalProperties: false,
                },
                instructions_i18n: {
                  type: 'object',
                  properties: {
                    fr: {
                      type: 'string',
                      description: 'Les consignes de travail détaillées en Markdown fidèles au sujet en français.',
                    },
                    en: {
                      type: 'string',
                      description: 'The detailed Markdown lab instructions translated into English, with all code identifiers unchanged.',
                    },
                  },
                  required: ['fr', 'en'],
                  additionalProperties: false,
                },
                target_files: {
                  type: 'array',
                  items: { type: 'string' },
                },
                milestones: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      order: { type: 'integer' },
                      title_i18n: {
                        type: 'object',
                        properties: {
                          fr: { type: 'string', description: 'Titre du jalon en français.' },
                          en: { type: 'string', description: 'Milestone title in English.' },
                        },
                        required: ['fr', 'en'],
                        additionalProperties: false,
                      },
                      validation_criteria_i18n: {
                        type: 'object',
                        properties: {
                          fr: { type: 'string', description: 'Critères de validation précis en français.' },
                          en: { type: 'string', description: 'Precise validation criteria in English.' },
                        },
                        required: ['fr', 'en'],
                        additionalProperties: false,
                      },
                    },
                    required: ['id', 'order', 'title_i18n', 'validation_criteria_i18n'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['id', 'order', 'title_i18n', 'instructions_i18n', 'target_files', 'milestones'],
              additionalProperties: false,
            },
          },
          covered_micro_concepts: {
            type: 'array',
            items: { type: 'string' },
          },
          demo_presets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                label: { type: 'string' },
                description: { type: 'string' },
                files: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      content: { type: 'string' },
                    },
                    required: ['name', 'content'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['key', 'label', 'description', 'files'],
              additionalProperties: false,
            },
          },
        },
        required: ['extracted_title', 'description', 'activities', 'covered_micro_concepts', 'demo_presets'],
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

    const rawEnTitle = parsed.extracted_title?.en?.trim() || title.trim();
    const cleanEnTitle = rawEnTitle.toLowerCase().startsWith('tp')
      ? rawEnTitle
      : `TP ${labNumber} — ${rawEnTitle}`;

    const rawFrTitle = parsed.extracted_title?.fr?.trim() || title.trim();
    const cleanFrTitle = rawFrTitle.toLowerCase().startsWith('tp')
      ? rawFrTitle
      : `TP ${labNumber} : ${rawFrTitle}`;

    interface ParsedMilestoneRaw {
      id: string;
      order: number;
      title?: string;
      title_i18n?: { en?: string; fr?: string };
      validation_criteria?: string;
      validation_criteria_i18n?: { en?: string; fr?: string };
    }

    interface ParsedActivityRaw {
      id: string;
      order: number;
      title?: string;
      title_i18n?: { en?: string; fr?: string };
      instructions_markdown?: string;
      instructions_i18n?: { en?: string; fr?: string };
      target_files?: string[];
      milestones?: ParsedMilestoneRaw[];
    }

    const mappedActivities = (parsed.activities || []).map((act: ParsedActivityRaw) => {
      const actTitleEn = act.title_i18n?.en?.trim() || act.title || `Activity ${act.order}`;
      const actTitleFr = act.title_i18n?.fr?.trim() || act.title || `Activité ${act.order}`;
      const actInstructionsEn = act.instructions_i18n?.en?.trim() || act.instructions_markdown || '';
      const actInstructionsFr = act.instructions_i18n?.fr?.trim() || act.instructions_markdown || '';

      const mappedMilestones = (act.milestones || []).map((m: ParsedMilestoneRaw) => ({
        id: m.id,
        order: m.order,
        title: m.title_i18n?.en?.trim() || m.title || `Milestone ${m.order}`,
        title_i18n: {
          en: m.title_i18n?.en?.trim() || m.title || `Milestone ${m.order}`,
          fr: m.title_i18n?.fr?.trim() || m.title || `Jalon ${m.order}`,
        },
        validation_criteria: m.validation_criteria_i18n?.en?.trim() || m.validation_criteria || '',
        validation_criteria_i18n: {
          en: m.validation_criteria_i18n?.en?.trim() || m.validation_criteria || '',
          fr: m.validation_criteria_i18n?.fr?.trim() || m.validation_criteria || '',
        },
      }));

      return {
        id: act.id,
        order: act.order,
        title: actTitleEn,
        title_i18n: {
          en: actTitleEn,
          fr: actTitleFr,
        },
        instructions_markdown: actInstructionsEn,
        instructions_i18n: {
          en: actInstructionsEn,
          fr: actInstructionsFr,
        },
        target_files: Array.isArray(act.target_files) ? act.target_files : [],
        milestones: mappedMilestones,
      };
    });

    const labRecord = {
      course_id: courseId,
      lab_number: Number(labNumber),
      code: code.trim().toUpperCase(),
      title: cleanEnTitle,
      title_i18n: {
        en: cleanEnTitle,
        fr: cleanFrTitle,
      },
      description:
        typeof parsed.description === 'object' && parsed.description !== null
          ? JSON.stringify(parsed.description)
          : (typeof parsed.description === 'string' ? parsed.description.trim() : (description?.trim() || null)),
      pdf_url: pdfUrl || null,
      pages_json: pages,
      activities: mappedActivities,
      covered_micro_concepts: parsed.covered_micro_concepts || [],
      demo_presets: parsed.demo_presets || [],
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const { data: savedLab, error: saveError } = await supabase
      .from('labs')
      .upsert(labRecord, { onConflict: 'course_id,code' })
      .select()
      .single();

    if (saveError) throw saveError;

    return NextResponse.json({
      success: true,
      lab: savedLab,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lab analysis failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
