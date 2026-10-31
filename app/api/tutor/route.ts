import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// 1. Initialize Supabase Server Client (using SERVICE_ROLE_KEY to bypass RLS for backend writes)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('votrenomdeprojet'))
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// 2. Load Knowledge Base once in server memory for Prompt Caching
const KNOWLEDGE_BASE_PATH = path.join(process.cwd(), 'knowledge_base.md');
const knowledgeBase = fs.existsSync(KNOWLEDGE_BASE_PATH)
  ? fs.readFileSync(KNOWLEDGE_BASE_PATH, 'utf8')
  : '# Socratix Java OOP Knowledge Base (Chapters 1-6 & Yalla POS Labs 1-12)';

// 3. Complete Validated English Cross-Lingual System Prompt
const SOCRATIX_SYSTEM_PROMPT = `You are Socratix, the AI teaching assistant for Mr. Mohamed Belhassen's Object-Oriented Programming (Java) course at the Faculty of Sciences of Gabes. Your role is to mentor students on their main project, "Yalla POS Console".

### CROSS-LINGUAL INSTRUCTION
The provided course material and knowledge base are in French, but you MUST interact with the student and formulate your responses entirely in English. Translate the concepts seamlessly.

### GOLDEN RULE: STRICT SOCRATIC POSTURE (WHEN ISSUES REMAIN)
You are absolutely forbidden from providing the correct code or direct solutions to the student. Your goal is to make them think. 
When facing an error or an incomplete implementation:
1. Isolate the logical, syntactical, or architectural error in the provided code.
2. Formulate a concise explanation of the problem (without giving the solution).
3. Ask ONE targeted, open-ended question that guides the student toward the solution.

### CONVERSATION MEMORY & ANTI-REDUNDANCY (CRITICAL)
You have access to the recent dialogue history in the conversation context. You MUST respect the following progression rules:
- **Never repeat an analogy or slide reference already discussed**: If you already cited the "Oven" (Four) example on Slide 42 in a previous turn and the student has already corrected that attribute, DO NOT repeat that analogy! Move to the next relevant concept.
- **Track incremental fixes**: Acknowledge what the student just fixed since the previous turn (e.g., "Good job making \`price\` private! Now let's look at..."). Do not re-flag resolved issues.
- **Progress naturally**: Each turn must address the next logical hurdle without getting stuck in a loop.

### MILESTONE COMPLETION & SOCRATIC EXIT (NO CEASELESS LOOPS)
When the student's code satisfies all technical and pedagogical requirements of the current milestone (e.g., encapsulation rules applied, getters/setters validated, clean compilation, test scenarios in \`main\` executed without error):
1. **HALT the Socratic loop**: Do NOT ask any more leading or probing questions.
2. **Set \`is_milestone_completed: true\`** in the response schema.
3. **Set \`telemetry.milestone_status: "COMPLETED"\`**.
4. **Emit a Warm Congratulatory Verdict** in \`socratic_reply.message_markdown\` confirming that their solution is 100% correct and robust.
5. **Generate a Structured \`competency_report\`**:
   - \`congratulations\`: An inspiring personalized message highlighting their problem-solving journey.
   - \`mastered_concepts\`: Array of concepts demonstrated (e.g., ["Private Field Encapsulation", "Defensive Setter Validation"]).
   - \`friction_points\`: Array of hurdles observed in the dialogue history (e.g., ["Initial omission of private keyword", "Method call without parentheses"]).
   - \`revision_recommendations\`: Concrete slide and chapter recommendations (e.g., ["Chapter 2 Slide 23: Method Syntax", "Chapter 3 Slide 42: Encapsulation Invariants"]).

### PEDAGOGICAL ANCHORING (MANDATORY)
To illustrate your explanation, you must use the exact analogies from the course AND cite the corresponding slide number:
* For encapsulation issues (missing private modifiers): Remind them of the "Oven" (Four) example on Slide 42 of Chapter 3, and the danger of letting an external user directly modify \`four.resistance = null;\`.
* For static members issues: Reference the \`count\` variable shared by all \`ClasseChien\` objects, or the \`MathTool.PI\` utility (Chapter 3, Slides 9, 13-14).
* For inheritance/polymorphism issues: Draw a parallel with the abstract parent class \`Felin\` and its subclasses \`Tigre\` or \`Chat\`, and how the \`Zoo\` class calls \`parler()\` polymorphically (Slide 8, Chapter 4).
* For interface issues: Refer to the \`Downloadable\` interface grouping \`Document\` and \`Program\` in \`DownloadManager\` (Slide 15-18, Chapter 5), or \`Compte\` with \`default\` methods (Slide 50, Chapter 5).
* For error handling (try/catch/throw): Remind them of the division by zero in \`CalculMath\` (Slides 10-12, Chapter 6) or \`SaisieErroneeException\` (Slide 26, Chapter 6).

### JSON FORMATTING RULES
You must ALWAYS respond by generating a strict JSON object that adheres to the required schema:
1. \`is_milestone_completed\`: boolean flag indicating whether the milestone is 100% complete.
2. \`socratic_reply\`: The Markdown-formatted message for the student, the course reference, and the array of inspected files.
3. \`telemetry\`: The silent evaluation for the Teacher Dashboard.
4. \`competency_report\`: Structured report when completed, or empty strings/arrays while in progress.

### REASONING EXAMPLES (FEW-SHOT PROMPTING)

--- EXAMPLE 1: ENCAPSULATION ERROR (LAB 5 — IN PROGRESS) ---
Student Code (Item.java): \`public class Item { double price; ... }\`
Expected JSON Response:
{
  "is_milestone_completed": false,
  "socratic_reply": {
    "message_markdown": "I see you've created the \`Item\` class, which is a great start! However, look at line 2: your \`price\` attribute lacks a visibility modifier.\\n\\nDo you remember the \`Oven\` (Four) example from Slide 42 in Chapter 3? What would happen if anyone could write \`myOven.resistance = null;\` from outside the class?\\n\\nHow could you protect your item's price to prevent a malicious cashier from modifying it directly?",
    "course_reference": "Chapter 3 (Slide 42): Encapsulation and Visibility",
    "inspected_files": ["Item.java"]
  },
  "telemetry": {
    "current_milestone": "LAB5_ENCAPSULATION",
    "milestone_status": "BLOCKED",
    "concept_signals": [
      {
        "chapter": "CH3_CLASSES",
        "micro_concept": "VISIBILITY_ENCAPSULATION",
        "signal": "NEGATIVE",
        "score_delta": -15,
        "code_location": "Item.java:2",
        "diagnostic_note": "Missing private keyword on the price attribute."
      }
    ]
  },
  "competency_report": {
    "congratulations": "",
    "mastered_concepts": [],
    "friction_points": [],
    "revision_recommendations": []
  }
}

--- EXAMPLE 2: MILESTONE COMPLETED (LAB 5 — SOCRATIC EXIT & CELEBRATION) ---
Student Code: Properly encapsulated Item.java with private fields, validated setters, getters, and valid YallaPOS.java tests.
Expected JSON Response:
{
  "is_milestone_completed": true,
  "socratic_reply": {
    "message_markdown": "🎉 **Outstanding work! You have successfully mastered Milestone 5: Encapsulation.**\\n\\nYour \`Item\` class is now properly guarded: both \`name\` and \`price\` are strictly marked \`private\`, your constructor ensures proper initialization, and your setter enforces validation guarding against negative prices. In \`YallaPOS.java\`, your calls cleanly pass through the validated accessors.\\n\\nYou have completed this milestone without shortcuts!",
    "course_reference": "Chapter 3 (Slides 38-43): Encapsulation and Access Modifiers",
    "inspected_files": ["Item.java", "YallaPOS.java"]
  },
  "telemetry": {
    "current_milestone": "LAB5_ENCAPSULATION",
    "milestone_status": "COMPLETED",
    "concept_signals": [
      {
        "chapter": "CH3_CLASSES",
        "micro_concept": "VISIBILITY_ENCAPSULATION",
        "signal": "POSITIVE",
        "score_delta": 25,
        "code_location": "Item.java:4",
        "diagnostic_note": "Milestone completed. Strict encapsulation and validation invariants verified."
      }
    ]
  },
  "competency_report": {
    "congratulations": "Congratulations on completing Lab 5! You went from exposed public attributes to a secure, resilient object architecture adhering to the fundamental principles of OOP.",
    "mastered_concepts": [
      "Private Field Encapsulation (Data Hiding)",
      "Defensive Setter Validation (Business Invariants)",
      "Controlled Public Accessors (Getters/Setters)",
      "Constructor Attribute Initialization"
    ],
    "friction_points": [
      "Initial omission of the private keyword on price",
      "Method invocation syntax without parentheses (item.getPrice vs item.getPrice())",
      "Direct field modification bypassing setter validation"
    ],
    "revision_recommendations": [
      "Chapter 2 (Slide 23): Method Invocation Syntax and Return Types",
      "Chapter 3 (Slide 42): Encapsulation Invariants & The Oven Anti-Pattern"
    ]
  }
}`;

// 4. Strict Structured Output JSON Schema for muse-spark-1.3
const SOCRATIX_JSON_SCHEMA = {
  name: 'socratix_tutor_evaluation',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      is_milestone_completed: {
        type: 'boolean',
        description: 'True ONLY when all requirements are fully met and no further fixes are needed.',
      },
      socratic_reply: {
        type: 'object',
        properties: {
          message_markdown: { type: 'string' },
          course_reference: { type: 'string' },
          inspected_files: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['message_markdown', 'course_reference', 'inspected_files'],
        additionalProperties: false,
      },
      telemetry: {
        type: 'object',
        properties: {
          current_milestone: { type: 'string' },
          milestone_status: {
            type: 'string',
            enum: ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'],
          },
          concept_signals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                chapter: {
                  type: 'string',
                  enum: [
                    'CH1_INTRO',
                    'CH2_BASES',
                    'CH3_CLASSES',
                    'CH4_INHERITANCE',
                    'CH5_INTERFACES',
                    'CH6_EXCEPTIONS',
                  ],
                },
                micro_concept: { type: 'string' },
                signal: {
                  type: 'string',
                  enum: ['POSITIVE', 'NEGATIVE'],
                },
                score_delta: { type: 'integer' },
                code_location: { type: 'string' },
                diagnostic_note: { type: 'string' },
              },
              required: [
                'chapter',
                'micro_concept',
                'signal',
                'score_delta',
                'code_location',
                'diagnostic_note',
              ],
              additionalProperties: false,
            },
          },
        },
        required: ['current_milestone', 'milestone_status', 'concept_signals'],
        additionalProperties: false,
      },
      competency_report: {
        type: 'object',
        properties: {
          congratulations: { type: 'string' },
          mastered_concepts: {
            type: 'array',
            items: { type: 'string' },
          },
          friction_points: {
            type: 'array',
            items: { type: 'string' },
          },
          revision_recommendations: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: [
          'congratulations',
          'mastered_concepts',
          'friction_points',
          'revision_recommendations',
        ],
        additionalProperties: false,
      },
    },
    required: [
      'is_milestone_completed',
      'socratic_reply',
      'telemetry',
      'competency_report',
    ],
    additionalProperties: false,
  },
};

interface JavaFile {
  name: string;
  content: string;
}

interface SocratixReply {
  message_markdown: string;
  course_reference: string;
  inspected_files: string[];
}

interface ConceptSignal {
  chapter: string;
  micro_concept: string;
  signal: 'POSITIVE' | 'NEGATIVE';
  score_delta: number;
  code_location: string;
  diagnostic_note: string;
}

interface Telemetry {
  current_milestone: string;
  milestone_status: string;
  concept_signals: ConceptSignal[];
}

export interface CompetencyReport {
  congratulations: string;
  mastered_concepts: string[];
  friction_points: string[];
  revision_recommendations: string[];
}

interface SocratixResponse {
  is_milestone_completed: boolean;
  socratic_reply: SocratixReply;
  telemetry: Telemetry;
  competency_report: CompetencyReport;
}

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { question, files, history, studentId, labSessionId } = body as {
      question: string;
      files: JavaFile[];
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      studentId?: string;
      labSessionId?: string;
    };

    if (!files || files.length === 0 || !question) {
      return NextResponse.json(
        { error: 'Java files or student question missing.' },
        { status: 400 }
      );
    }

    // 1. Format student's local .java files into a clean context block
    const studentCodeContext = files
      .map((file: JavaFile) => `--- FILE: ${file.name} ---\n${file.content}`)
      .join('\n\n');

    // 2. Format sliding window history (last 6 messages max, sanitized)
    const formattedHistory = (history || [])
      .slice(-6)
      .map((msg: { role: 'user' | 'assistant'; content: string }) => ({
        role: msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: typeof msg.content === 'string' ? msg.content.substring(0, 1000) : '',
      }))
      .filter((msg) => msg.content.trim().length > 0);

    const META_API_URL = 'https://api.meta.ai/v1/chat/completions';
    const META_API_KEY = process.env.META_API_KEY;

    let parsedResult: SocratixResponse | null = null;

    // Check if real Meta API key is available
    if (META_API_KEY && !META_API_KEY.includes('votre-cle')) {
      // 3. Call Meta Model API (muse-spark-1.3) with Prompt Caching, Sliding Window & Structured Outputs
      const response = await fetch(META_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${META_API_KEY}`,
          'X-Enable-Cache': 'true',
        },
        body: JSON.stringify({
          model: 'muse-spark-1.3',
          messages: [
            {
              role: 'system',
              content: [
                {
                  type: 'text',
                  text: `${knowledgeBase}\n\n${SOCRATIX_SYSTEM_PROMPT}`,
                  // Explicit Prompt Caching on the static curriculum + system rules prefix
                  cache_control: { type: 'ephemeral' },
                },
                {
                  type: 'text',
                  text: `Active Lab Session ID: ${labSessionId || '55555555-5555-5555-5555-555555555555'}. Analyze the student's code and respond strictly in JSON.`,
                },
              ],
            },
            ...formattedHistory,
            {
              role: 'user',
              content: `Student Question: "${question}"\n\nCurrent Java Workspace:\n${studentCodeContext}`,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: SOCRATIX_JSON_SCHEMA,
          },
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Meta API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      parsedResult = JSON.parse(data.choices[0].message.content);
    } else {
      // Smart Fallback for offline local dev / demo testing without live API key
      const isEncapsulationError =
        studentCodeContext.includes('double price;') ||
        (studentCodeContext.includes('Item') && !studentCodeContext.includes('private double price;'));
      const isFacturableFixed = studentCodeContext.includes('Facturable[] cart = new Facturable');
      const isEncapsulationCompleted =
        studentCodeContext.includes('private double price') &&
        (studentCodeContext.includes('getPrice') || studentCodeContext.includes('setPrice'));

      if (isFacturableFixed) {
        parsedResult = {
          is_milestone_completed: true,
          socratic_reply: {
            message_markdown:
              "🎉 **Outstanding work! You have successfully mastered Milestone 6: Interface Polymorphism.**\n\nExcellent work! You have properly updated the type of your `cart` array to use the `Facturable` interface instead of `Article`.\n\nThis follows the exact same principle as the `DownloadManager` class seen on Slide 18 of Chapter 5, which stored both `Document` and `Program` instances inside a single `Downloadable[]` array.\n\nNow that your cart accepts `Service` objects polymorphically, your checkout loop computes amounts using the interface contract cleanly!",
            course_reference: "Chapter 5 (Slide 18): Interface Polymorphism",
            inspected_files: ["YallaPOS.java", "Facturable.java"],
          },
          telemetry: {
            current_milestone: "LAB6_POLYMORPHISM",
            milestone_status: "COMPLETED",
            concept_signals: [
              {
                chapter: "CH4_INHERITANCE",
                micro_concept: "POLYMORPHIC_ARRAY",
                signal: "POSITIVE",
                score_delta: 25,
                code_location: "YallaPOS.java:3",
                diagnostic_note: "Successfully migrated cart array from Article[] to Facturable[].",
              },
            ],
          },
          competency_report: {
            congratulations:
              "Outstanding work on Lab 6! You successfully adopted interface polymorphism, decoupling your point of sale from concrete classes.",
            mastered_concepts: [
              "Interface Polymorphism",
              "Polymorphic Collections (Facturable[])",
              "Contract-Driven Programming",
            ],
            friction_points: [
              "Initial type mismatch attempting to assign Service to Article[]",
            ],
            revision_recommendations: [
              "Chapter 5 (Slide 18): Polymorphic Collections with Interfaces",
              "Chapter 5 (Slide 15): Interface Contracts and Implements",
            ],
          },
        };
      } else if (isEncapsulationCompleted) {
        parsedResult = {
          is_milestone_completed: true,
          socratic_reply: {
            message_markdown:
              "🎉 **Outstanding work! You have successfully mastered Milestone 5: Encapsulation.**\n\nYour `Item` class is now properly guarded: both attributes are declared `private`, your constructor properly initializes the instance, and your methods provide controlled, validated access. In `YallaPOS.java`, calls cleanly pass through accessors rather than corrupting fields directly.\n\nYou have fully achieved this milestone without taking shortcuts. Review your personalized competency report below!",
            course_reference: "Chapter 3 (Slides 38-43): Encapsulation and Access Modifiers",
            inspected_files: ["Item.java", "YallaPOS.java"],
          },
          telemetry: {
            current_milestone: "LAB5_ENCAPSULATION",
            milestone_status: "COMPLETED",
            concept_signals: [
              {
                chapter: "CH3_CLASSES",
                micro_concept: "VISIBILITY_ENCAPSULATION",
                signal: "POSITIVE",
                score_delta: 25,
                code_location: "Item.java:4",
                diagnostic_note: "Milestone completed. Strict encapsulation verified.",
              },
            ],
          },
          competency_report: {
            congratulations:
              "Congratulations on completing Lab 5! You went from exposed public attributes to a secure, resilient object architecture adhering to the fundamental principles of OOP.",
            mastered_concepts: [
              "Private Field Encapsulation (Data Hiding)",
              "Defensive Setter Validation (Business Invariants)",
              "Controlled Public Accessors (Getters/Setters)",
              "Constructor Attribute Initialization",
            ],
            friction_points: [
              "Initial omission of the private keyword on price attribute",
              "Method invocation syntax without parentheses (item.getPrice vs item.getPrice())",
              "Direct attribute modification syntax in YallaPOS",
            ],
            revision_recommendations: [
              "Chapter 2 (Slide 23): Method Invocation Syntax and Return Types",
              "Chapter 3 (Slide 42): Encapsulation Invariants & The Oven Anti-Pattern",
            ],
          },
        };
      } else if (isEncapsulationError) {
        const alreadyDiscussedOven = (history || []).some(
          (h) =>
            typeof h.content === 'string' &&
            (h.content.includes('Oven') || h.content.includes('Four') || h.content.includes('Slide 42'))
        );

        if (alreadyDiscussedOven) {
          parsedResult = {
            is_milestone_completed: false,
            socratic_reply: {
              message_markdown:
                "Look closely at `Item.java`: your `price` attribute is still declared without a visibility modifier.\n\nNow that we've seen how direct field access allows external code to tamper with values, what specific Java keyword should precede `double price;` to ensure only methods of `Item` can modify it?",
              course_reference: "Chapter 3 (Slide 39): The Private Access Modifier",
              inspected_files: ["Item.java"],
            },
            telemetry: {
              current_milestone: "LAB5_ENCAPSULATION",
              milestone_status: "BLOCKED",
              concept_signals: [
                {
                  chapter: "CH3_CLASSES",
                  micro_concept: "VISIBILITY_ENCAPSULATION",
                  signal: "NEGATIVE",
                  score_delta: -10,
                  code_location: "Item.java:2",
                  diagnostic_note: "Awaiting private visibility keyword on price.",
                },
              ],
            },
            competency_report: {
              congratulations: "",
              mastered_concepts: [],
              friction_points: [],
              revision_recommendations: [],
            },
          };
        } else {
          parsedResult = {
            is_milestone_completed: false,
            socratic_reply: {
              message_markdown:
                "I see you've created the `Item` class, which is a great start! However, look at line 2: your `price` attribute lacks a visibility modifier.\n\nDo you remember the `Oven` (Four) example from Slide 42 in Chapter 3? What would happen if anyone could write `myOven.resistance = null;` from outside the class?\n\nHow could you protect your item's price to prevent a malicious cashier from modifying it directly?",
              course_reference: "Chapter 3 (Slide 42): Encapsulation and Visibility",
              inspected_files: ["Item.java"],
            },
            telemetry: {
              current_milestone: "LAB5_ENCAPSULATION",
              milestone_status: "BLOCKED",
              concept_signals: [
                {
                  chapter: "CH3_CLASSES",
                  micro_concept: "VISIBILITY_ENCAPSULATION",
                  signal: "NEGATIVE",
                  score_delta: -15,
                  code_location: "Item.java:2",
                  diagnostic_note: "Missing private keyword on the price attribute.",
                },
              ],
            },
            competency_report: {
              congratulations: "",
              mastered_concepts: [],
              friction_points: [],
              revision_recommendations: [],
            },
          };
        }
      } else {
        parsedResult = {
          is_milestone_completed: false,
          socratic_reply: {
            message_markdown: `I reviewed your code for \`YallaPOS\`. \n\nThink about the fundamental OOP contracts we studied. Have you checked if all attributes are properly encapsulated, and whether subclasses call \`super()\` in the very first line of their constructors? \n\nWhat specific method behavior are you expecting to see when executing this step?`,
            course_reference: "Chapter 3 & 4 (Slides 38-43): Class Design & Inheritance",
            inspected_files: files.slice(0, 2).map((f) => f.name),
          },
          telemetry: {
            current_milestone: "LAB5_ENCAPSULATION",
            milestone_status: "IN_PROGRESS",
            concept_signals: [
              {
                chapter: "CH3_CLASSES",
                micro_concept: "VISIBILITY_ENCAPSULATION",
                signal: "POSITIVE",
                score_delta: 5,
                code_location: `${files[0]?.name || 'App.java'}:1`,
                diagnostic_note: "Iterating through lab implementation steps.",
              },
            ],
          },
          competency_report: {
            congratulations: "",
            mastered_concepts: [],
            friction_points: [],
            revision_recommendations: [],
          },
        };
      }
    }

    if (!parsedResult) {
      throw new Error('Failed to generate Socratic response');
    }

    // =========================================================================
    // 3. TARGETED PERSISTENCE IN SUPABASE (CHAT HISTORY + TELEMETRY UPSERT)
    // =========================================================================
    if (supabase && studentId && labSessionId) {
      try {
        // A. Retrieve or create the chat session for this student & lab
        let { data: chatSession } = await supabase
          .from('chat_sessions')
          .select('id')
          .eq('student_id', studentId)
          .eq('lab_session_id', labSessionId)
          .maybeSingle();

        if (!chatSession) {
          const { data: newSession } = await supabase
            .from('chat_sessions')
            .insert({ student_id: studentId, lab_session_id: labSessionId })
            .select('id')
            .single();
          chatSession = newSession;
        }

        // B. Targeted JSONB Code Snapshot (DB Optimization: keep ONLY files inspected by the AI)
        const inspectedFileNames: string[] = parsedResult.socratic_reply.inspected_files || [];
        const targetedSnapshot = files.filter((f: JavaFile) =>
          inspectedFileNames.some(
            (inspected) => f.name === inspected || f.name.endsWith(`/${inspected}`)
          )
        );

        // C. Persist user message (with targeted snapshot) and assistant Socratic reply
        if (chatSession?.id) {
          await supabase.from('chat_messages').insert([
            {
              session_id: chatSession.id,
              role: 'user',
              content: question,
              code_snapshot: targetedSnapshot.length > 0 ? targetedSnapshot : files.slice(0, 2),
            },
            {
              session_id: chatSession.id,
              role: 'assistant',
              content: parsedResult.socratic_reply.message_markdown,
              code_snapshot: {}, // Avoid duplicating snapshot on the assistant row
            },
          ]);
        }

        // D. Upsert granular competency telemetry (triggers Supabase Realtime on Teacher Dashboard)
        const telemetry = parsedResult.telemetry;
        const isMilestoneCompleted = parsedResult.is_milestone_completed || telemetry.milestone_status === 'COMPLETED';

        for (const signal of telemetry.concept_signals || []) {
          const clampedScore = isMilestoneCompleted
            ? 100
            : Math.max(0, Math.min(100, 50 + (Number(signal.score_delta) || 0)));

          await supabase.from('student_competencies').upsert(
            {
              student_id: studentId,
              lab_session_id: labSessionId,
              current_milestone: telemetry.current_milestone,
              milestone_status: isMilestoneCompleted ? 'COMPLETED' : telemetry.milestone_status,
              chapter: signal.chapter,
              micro_concept: signal.micro_concept,
              score_delta: isMilestoneCompleted ? 25 : signal.score_delta,
              mastery_score: clampedScore,
              last_diagnostic_note: signal.diagnostic_note,
            },
            { onConflict: 'student_id,lab_session_id,micro_concept' }
          );
        }
      } catch (dbErr) {
        console.warn('Supabase persistence warning (non-fatal):', dbErr);
      }
    }

    const latencyMs = Date.now() - startTime;

    // 4. Return structured result to the student frontend
    return NextResponse.json({
      success: true,
      data: parsedResult,
      meta: {
        model: 'muse-spark-1.3',
        latency_ms: latencyMs,
        prompt_cache: 'ephemeral',
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Error in /api/tutor:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
