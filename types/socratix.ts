// ============================================================================
// SOCRATIX v2 - UNIFIED DOMAIN TYPES (MULTI-COURSE, TELEMETRY & CHAT)
// ============================================================================

export type UserRole = 'student' | 'teacher';

export interface Profile {
  id: string;
  email: string | null;
  display_name: string;
  role: UserRole;
  is_guest: boolean;
  created_at: string;
}

export interface Course {
  id: string;
  teacher_id: string | null;
  code: string; // e.g., 'JAVA_OOP', 'PARSE_PLATFORM'
  title: string;
  description?: string | null;
  content_language: string; // e.g., 'fr'
  tutor_language: string; // e.g., 'en'
  file_extensions: string[]; // e.g., ['.java'] or ['.js', '.json']
  stuck_threshold_turns: number; // default: 2
  competency_matrix: ChapterCompetencyTaxonomy[];
  compiled_tutor_prompt: string;
  compiled_knowledge_base: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface MicroCompetencyDefinition {
  code: string; // e.g., 'VISIBILITY_ENCAPSULATION'
  title: string;
  slide_ref?: string; // e.g., 'Ch.3 Slide 42'
  description?: string;
}

export interface ChapterCompetencyTaxonomy {
  chapter_code: string; // e.g., 'CH3_CLASSES'
  competency_title: string;
  micro_competencies: MicroCompetencyDefinition[];
}

export interface KeyAnalogy {
  slide: number;
  concept: string;
  analogy_summary: string;
}

export interface BilingualText {
  en: string;
  fr: string;
}

export interface PagedSlide {
  page: number;
  text: string;
  en_summary?: string;
  en_markdown?: string;
  fr_markdown?: string;
}

export interface CourseChapter {
  id: string;
  course_id: string;
  chapter_number: number;
  code: string; // e.g., 'CH1_INTRO'
  title: string;
  title_i18n?: BilingualText | null;
  pdf_url?: string | null;
  markdown_content: string;
  pages_json: PagedSlide[];
  key_analogies: KeyAnalogy[];
  created_at: string;
}

export interface LabMilestone {
  id: string;
  order: number;
  title: string;
  title_i18n?: BilingualText;
  validation_criteria: string;
  validation_criteria_i18n?: BilingualText;
}

export interface LabActivity {
  id: string;
  order: number;
  title: string;
  title_i18n?: BilingualText;
  instructions_markdown: string;
  instructions_i18n?: BilingualText;
  target_files: string[];
  milestones: LabMilestone[];
}

export interface DemoPresetFile {
  name: string;
  content: string;
}

export interface DemoPreset {
  key: string;
  activity_id?: string;
  preset_type?: 'buggy' | 'solution';
  label: string;
  description?: string;
  files: DemoPresetFile[];
}

export interface Lab {
  id: string;
  course_id: string;
  lab_number: number;
  code: string; // e.g., 'TP5'
  title: string;
  title_i18n?: BilingualText | null;
  description?: string | null;
  pdf_url?: string | null;
  pages_json?: Array<{ page: number; text: string }>;
  activities: LabActivity[];
  covered_micro_concepts: string[];
  demo_presets: DemoPreset[];
  is_active: boolean;
  created_at: string;
}

// ----------------------------------------------------------------------------
// TELEMETRY & STUDENT LAB SESSION
// ----------------------------------------------------------------------------

export interface CompetencyOccurrence {
  activity_id: string;
  file: string;
  location: string; // e.g., 'Item.java:setPrice'
  status: 'PASS' | 'FAIL';
  last_signal: 'POSITIVE' | 'NEGATIVE';
  note: string;
}

export interface MicroCompetencyEntry {
  status: 'MASTERED' | 'IN_PROGRESS' | 'STRUGGLING' | 'UNTESTED';
  score: number; // 0..100 = round((passCount / totalCount) * 100)
  signal_count: number;
  summary: string;
  occurrences: CompetencyOccurrence[];
}

export type MicroCompetenciesStateMap = Record<string, MicroCompetencyEntry>;

export interface ActivityProgress {
  title: string;
  completed_milestones: string[];
  total_milestones: number;
  percent: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  completion_report?: CompletionReport | null;
}

export type SessionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED';

export interface StudentLabSession {
  id: string;
  course_id: string;
  lab_id: string;
  student_id: string;
  seat_label: string;
  status: SessionStatus;
  current_activity_id: string | null;
  current_milestone_id: string | null;
  completed_milestone_ids: string[];
  activities_progress: Record<string, ActivityProgress>;
  progress_percent: number; // 0..100
  consecutive_errors: number;
  micro_competencies_state: MicroCompetenciesStateMap;
  last_diagnostic_note?: string | null;
  completion_report?: CompletionReport | null;
  started_at: string;
  last_stuck_at?: string | null;
  updated_at: string;
  profiles?: {
    display_name: string;
    is_guest: boolean;
    email?: string | null;
  };
}

export interface CompletionReport {
  congratulations: string;
  mastered_concepts: string[];
  friction_points: string[];
  revision_recommendations: string[];
}

// ----------------------------------------------------------------------------
// CHAT & SOCRATIC TUTOR
// ----------------------------------------------------------------------------

export interface StructuredCourseReference {
  label: string; // e.g., 'Chapter 3 (Slide 42): Encapsulation and Visibility'
  chapter_code: string; // e.g., 'CH3_CLASSES'
  page_number: number; // e.g., 42
  pdf_url?: string | null;
  en_note: string; // English pedagogical synthesis note
  slide_markdown?: {
    en?: string;
    fr?: string;
  };
}

export interface ChatMessage {
  id: string;
  student_lab_session_id: string;
  activity_id?: string | null;
  role: 'user' | 'assistant' | 'teacher_hint';
  content: string;
  course_reference?: StructuredCourseReference | null;
  code_snapshot: DemoPresetFile[];
  latency_ms?: number | null;
  created_at: string;
}

export interface TutorRequestBody {
  courseId: string;
  labId: string;
  activityId?: string;
  studentId: string;
  seatLabel?: string;
  question: string;
  isHintRequest?: boolean;
  files: DemoPresetFile[];
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}
