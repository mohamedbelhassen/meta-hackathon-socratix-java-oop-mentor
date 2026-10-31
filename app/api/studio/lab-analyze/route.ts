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
      .map((p: { page: number; text: string }) => `[Page ${p.page}] ${p.text.slice(0, 600)}`)
      .join('\n');

    const systemPrompt = `You are an elite educational AI lab curriculum engineer for Socratix.
Your job is to read a university programming lab assignment (TP), decompose it into structured activities, derive 2 to 3 sequential milestones per activity, identify which course micro-competencies are practiced, and generate 2 1-click Demo Presets for hackathon judges.

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
          activities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                order: { type: 'integer' },
                title: { type: 'string' },
                instructions_markdown: { type: 'string' },
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
                      title: { type: 'string' },
                      validation_criteria: { type: 'string' },
                    },
                    required: ['id', 'order', 'title', 'validation_criteria'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['id', 'order', 'title', 'instructions_markdown', 'target_files', 'milestones'],
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
        required: ['activities', 'covered_micro_concepts', 'demo_presets'],
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

    const labRecord = {
      course_id: courseId,
      lab_number: Number(labNumber),
      code: code.trim().toUpperCase(),
      title: title.trim(),
      description: description?.trim() || null,
      pdf_url: pdfUrl || null,
      activities: parsed.activities || [],
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
