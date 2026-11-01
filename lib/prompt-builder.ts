import { Course, CourseChapter, Lab, LabActivity } from '@/types/socratix';

/**
 * Universal Socratic Engine Rules (Layer 1)
 * Invariant across all courses and domains.
 */
export const UNIVERSAL_SOCRATIC_RULES = `
### UNIVERSAL SOCRATIC ENGINE RULES (STRICT INVARIANTS)

1. STRICT SOCRATIC POSTURE (WHEN ISSUES REMAIN):
   - You are absolutely forbidden from providing full solutions, direct code lines, or ready-made syntax fixes while the activity or lab is unsolved.
   - Your primary mission is to foster cognitive development and autonomous problem solving.
   - If an error, omission, or anti-pattern exists:
     a) Isolate the exact defect in the student's code.
     b) Provide a crisp factual observation (without giving the fix).
     c) Anchor it to a course slide or pedagogical analogy.
     d) Ask ONE targeted, open-ended inquiry question that guides the student to reason through the fix.

2. HIGH-VELOCITY CONCISENESS (80 TO 110 WORDS MAX):
   - Keep your entire socratic reply between 80 and 110 words during guidance turns.
   - Structure: 1 brief acknowledgment/observation + 1 course slide/analogy anchor + 1 open inquiry question.
   - Avoid long conversational filler or lecturing. Brevity maximizes student focus and speed!

3. CONVERSATION MEMORY & ANTI-REDUNDANCY:
   - Carefully inspect the conversation history.
   - Never repeat an analogy or slide reference that the student already acknowledged or resolved.
   - Acknowledge incremental fixes: if the student fixed an issue from the previous turn, validate it briefly before probing the next hurdle.

4. HINT REQUEST MODE (WHEN isHintRequest = true):
   - If the student clicked "Ask for a Hint" without a specific question, proactively analyze their current code against the criteria of the active milestone.
   - Formulate a gentle guiding clue pointing directly at the first unfulfilled requirement.

5. MILESTONE & ACTIVITY COMPLETION EXIT (WHEN CODE IS CORRECT / CRITERIA MET):
   - When the student's submitted code satisfies the technical and architectural requirements of the current milestone or active activity:
     a) HALT the Socratic loop immediately: Do NOT ask any more leading or probing questions!
     b) Set has_unresolved_error = false.
     c) Set is_milestone_completed = true.
     d) Set is_activity_completed = true if all milestones of this activity are satisfied (and is_lab_completed = true if all activities of the lab are satisfied).
     e) Include the completed milestone ID(s) in newly_completed_milestone_ids.
     f) Emit an inspiring, warm congratulatory verdict in socratic_reply.message_markdown confirming 100% correctness and robustness.
     g) Generate a rich, structured competency_report:
        - congratulations: An inspiring personalized summary of their problem-solving achievement.
        - mastered_concepts: Array of concepts demonstrated (e.g. ["Private Field Encapsulation", "Defensive Setter Validation"]).
        - friction_points: Array of hurdles or anti-patterns overcome during the session.
        - revision_recommendations: Concrete slide and chapter recommendations for further consolidation.
`;

/**
 * Assembles the 3-Layer System Prompt:
 * Layer 1: Universal Socratic Rules (Deterministic prefix)
 * Layer 2: Course-specific Tutor Prompt (Pedagogical anchoring & Few-Shots)
 * Layer 3: Compiled Course Knowledge Base (Dense chapter summaries & slide references)
 */
export function buildCourseSystemPrompt(
  course: Course,
  chapters: CourseChapter[],
  lab: Lab,
  activeActivity?: LabActivity | null
): string {
  // Layer 2: Course Compiled Prompt or Default Anchor
  const courseLayer = course.compiled_tutor_prompt && course.compiled_tutor_prompt.trim().length > 0
    ? course.compiled_tutor_prompt
    : `
### COURSE CONTEXT & ANCHORING: ${course.title} (${course.code})
- Content Language: ${course.content_language}
- Socratic Tutor Language: ${course.tutor_language}
- Target Extensions: ${course.file_extensions?.join(', ') || '.java'}
- Always translate explanations into ${course.tutor_language.toUpperCase()} while referencing concepts accurately.
`;

  // Layer 3: Compiled Knowledge Base
  const kbLayer = course.compiled_knowledge_base && course.compiled_knowledge_base.trim().length > 0
    ? course.compiled_knowledge_base
    : chapters.map((c) => `## Chapter ${c.chapter_number}: ${c.title} (${c.code})\n${c.markdown_content}`).join('\n\n');

  // Active Lab & Activity Specifics
  const labLayer = `
### ACTIVE LAB SPECIFICS: ${lab.title} (${lab.code})
${lab.description ? `Overview: ${lab.description}` : ''}
Covered Micro-Concepts: ${lab.covered_micro_concepts.join(', ')}

${activeActivity ? `
CURRENT ACTIVE ACTIVITY:
- Activity ID: ${activeActivity.id}
- Title: ${activeActivity.order}. ${activeActivity.title}
- Instructions: ${activeActivity.instructions_markdown}
- Target Files: ${activeActivity.target_files.join(', ')}
- Milestones to validate:
${activeActivity.milestones.map((m) => `  * [${m.id}] (Step ${m.order}): ${m.title} — Criteria: ${m.validation_criteria}`).join('\n')}
` : `
ALL LAB ACTIVITIES:
${lab.activities.map((a) => `Activity [${a.id}] ${a.title}:\n` + a.milestones.map((m) => `  - [${m.id}]: ${m.title} (${m.validation_criteria})`).join('\n')).join('\n')}
`}
`;

  return `${UNIVERSAL_SOCRATIC_RULES}

---
${courseLayer}

---
### CANONICAL COURSE KNOWLEDGE BASE & SLIDE REFERENCES
${kbLayer}

---
${labLayer}
`.trim();
}

/**
 * Builds a strict Dynamic JSON Schema for OpenAI / Meta API structured outputs.
 * Injects exact enums from the course chapters, lab activities, milestones, and micro-concepts
 * to guarantee typo-free telemetry and slide citations.
 */
export function buildDynamicSocratixSchema(
  course: Course,
  chapters: CourseChapter[],
  lab: Lab
) {
  // Extract enums
  const chapterCodes = chapters.length > 0
    ? chapters.map((c) => c.code)
    : [course.code || 'CHAPTER_1'];

  const activityIds = lab.activities && lab.activities.length > 0
    ? lab.activities.map((a) => a.id)
    : ['act_1'];

  const allMilestoneIds: string[] = [];
  if (lab.activities && lab.activities.length > 0) {
    for (const act of lab.activities) {
      if (act.milestones && act.milestones.length > 0) {
        for (const m of act.milestones) {
          allMilestoneIds.push(m.id);
        }
      }
    }
  }
  if (allMilestoneIds.length === 0) {
    allMilestoneIds.push('m1');
  }

  const microConcepts = lab.covered_micro_concepts && lab.covered_micro_concepts.length > 0
    ? lab.covered_micro_concepts
    : ['CORE_CONCEPT'];

  return {
    name: 'socratix_interaction_response',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        is_milestone_completed: {
          type: 'boolean',
          description: 'True if the submitted code satisfies the current active milestone or activity with no remaining defects.',
        },
        is_activity_completed: {
          type: 'boolean',
          description: 'True if all milestones of the current active activity are satisfied.',
        },
        is_lab_completed: {
          type: 'boolean',
          description: 'True if all activities and milestones of the entire lab are satisfied.',
        },
        has_unresolved_error: {
          type: 'boolean',
          description: 'True if the submitted code still contains a compile, runtime, or architectural defect.',
        },
        current_milestone_id: {
          type: 'string',
          enum: allMilestoneIds,
          description: 'The milestone currently being targeted or worked on.',
        },
        newly_completed_milestone_ids: {
          type: 'array',
          items: {
            type: 'string',
            enum: allMilestoneIds,
          },
          description: 'Milestones newly satisfied by the student in this specific turn.',
        },
        concept_signals: {
          type: 'array',
          description: 'Telemetry signals for specific micro-concepts across files and methods.',
          items: {
            type: 'object',
            properties: {
              activity_id: {
                type: 'string',
                enum: activityIds,
              },
              micro_concept: {
                type: 'string',
                enum: microConcepts,
              },
              file: {
                type: 'string',
                description: 'File path inspected (e.g. Item.java).',
              },
              location: {
                type: 'string',
                description: 'Specific method, attribute, or line range (e.g. Item.java:setPrice or Item.java:price).',
              },
              status: {
                type: 'string',
                enum: ['PASS', 'FAIL'],
              },
              diagnostic_note: {
                type: 'string',
                description: 'Brief diagnostic note on this occurrence.',
              },
            },
            required: ['activity_id', 'micro_concept', 'file', 'location', 'status', 'diagnostic_note'],
            additionalProperties: false,
          },
        },
        socratic_reply: {
          type: 'object',
          description: 'The pedagogical message delivered to the student.',
          properties: {
            direct_answer_attempt_blocked: {
              type: 'boolean',
              description: 'True if the student explicitly asked for the solution and was redirected socratic-style.',
            },
            student_acknowledgment: {
              type: 'string',
              description: 'Brief 1-sentence acknowledgment of what was done or fixed.',
            },
            pedagogical_guidance: {
              type: 'string',
              description: '1-sentence hint or analogy anchoring the concept to a course slide.',
            },
            inquiry_question: {
              type: 'string',
              description: '1 open-ended inquiry question directing the next step.',
            },
            message_markdown: {
              type: 'string',
              description: 'The full assembled Socratic reply in Markdown (80 to 110 words maximum).',
            },
            course_reference: {
              type: 'object',
              description: 'Exact course slide citation.',
              properties: {
                label: {
                  type: 'string',
                  description: 'Display label, e.g. "Chapter 3 (Slide 42): Encapsulation and Visibility".',
                },
                chapter_code: {
                  type: 'string',
                  enum: chapterCodes,
                  description: 'Exact chapter code from the course.',
                },
                page_number: {
                  type: 'integer',
                  description: '1-based slide or page number.',
                },
                en_note: {
                  type: 'string',
                  description: 'Concise English pedagogical note explaining why this slide is relevant.',
                },
              },
              required: ['label', 'chapter_code', 'page_number', 'en_note'],
              additionalProperties: false,
            },
            inspected_files: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of files reviewed by the tutor.',
            },
          },
          required: [
            'direct_answer_attempt_blocked',
            'student_acknowledgment',
            'pedagogical_guidance',
            'inquiry_question',
            'message_markdown',
            'course_reference',
            'inspected_files',
          ],
          additionalProperties: false,
        },
        competency_report: {
          type: 'object',
          description: 'Generated when activity or lab completes.',
          properties: {
            congratulations: {
              type: 'string',
              description: 'Warm congratulatory message summarizing the achievement.',
            },
            mastered_concepts: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of concepts mastered.',
            },
            friction_points: {
              type: 'array',
              items: { type: 'string' },
              description: 'Key hurdles overcome during the session.',
            },
            revision_recommendations: {
              type: 'array',
              items: { type: 'string' },
              description: 'Recommended slides or concepts for further mastery.',
            },
          },
          required: ['congratulations', 'mastered_concepts', 'friction_points', 'revision_recommendations'],
          additionalProperties: false,
        },
      },
      required: [
        'is_milestone_completed',
        'is_activity_completed',
        'is_lab_completed',
        'has_unresolved_error',
        'current_milestone_id',
        'newly_completed_milestone_ids',
        'concept_signals',
        'socratic_reply',
        'competency_report',
      ],
      additionalProperties: false,
    },
  };
}
