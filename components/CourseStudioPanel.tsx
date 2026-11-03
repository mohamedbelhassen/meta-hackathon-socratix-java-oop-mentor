'use client';

import React, { useState } from 'react';
import { Course, CourseChapter, Lab } from '@/types/socratix';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  extractPdfPagesInBrowser,
  extractPdfPagesFromUrl,
  extractFirstPageInBrowser,
  inferNumberAndTitle,
  slugifyStorageKey,
  uploadCoursePdf,
} from '@/lib/pdf-client-extractor';
import {
  Sparkles,
  Upload,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  FileText,
  Layers,
  Code2,
  Loader2,
  Eye,
  Zap,
  Plus,
  Lock,
  AlertTriangle,
  Clock,
  RotateCcw,
  Trash2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import CourseCompilationSummaryModal from '@/components/CourseCompilationSummaryModal';
import LabsBatchIngestionModal from '@/components/LabsBatchIngestionModal';
import LabDetailModal from '@/components/LabDetailModal';
import ChapterStagingModal, { StagedChapterItem } from '@/components/ChapterStagingModal';
import { PreflightChapterItem } from '@/app/api/studio/chapters-preflight/route';
import { getLocalizedChapterTitle, getLocalizedLabTitle } from '@/lib/bilingual-helper';

interface CompilationPhase {
  step: number;
  title: string;
  description: string;
  pct: number;
}

const COMPILATION_PHASES: CompilationPhase[] = [
  {
    step: 1,
    title: 'Aggregating Chapter Slides & Analogies',
    description: 'Combining lecture slides, key metaphors and pedagogical notes into synthesis context',
    pct: 25,
  },
  {
    step: 2,
    title: 'Deduplicating Course Competency Matrix',
    description: 'Meta AI (muse-spark-1.3) resolving canonical taxonomy, canonical keys & eliminating conceptual overlaps',
    pct: 55,
  },
  {
    step: 3,
    title: 'Synthesizing Dense Knowledge Base',
    description: 'Compressing curriculum rules into ~3,500 token Prefix KV Caching format',
    pct: 80,
  },
  {
    step: 4,
    title: 'Calibrating Socratic Few-Shots & Anchors',
    description: 'Generating teacher pedagogical few-shots and anchoring error archetypes to exact slide numbers',
    pct: 95,
  },
  {
    step: 5,
    title: 'Course Compilation Complete!',
    description: 'Knowledge Base, Mentor Prompt & Competency Matrix persisted to Supabase with Realtime sync',
    pct: 100,
  },
];

export type StudioProgressStage =
  | 'Pre-flight Analysis'
  | 'Chapters / Slides'
  | 'Distilling Chapters'
  | 'Synthesizing KB & Prompt'
  | 'Labs / TP'
  | 'Re-analyzing Labs';

interface CourseStudioPanelProps {
  course: (Course & { course_chapters?: CourseChapter[]; labs?: Lab[] }) | null;
  onCourseUpdated: () => void | Promise<void>;
  onOpenAnalyticsTab?: () => void;
  onCreateCourse?: () => void;
  onDeleteCourse?: () => void;
}

export default function CourseStudioPanel({
  course,
  onCourseUpdated,
  onOpenAnalyticsTab,
  onCreateCourse,
  onDeleteCourse,
}: CourseStudioPanelProps) {
  // Batch processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<{
    stage: StudioProgressStage;
    current: number;
    total: number;
    filename: string;
  } | null>(null);

  // Compilation multi-phase storytelling & elapsed timer
  const [compilationPhase, setCompilationPhase] = useState<number>(0);
  const [compilationElapsed, setCompilationElapsed] = useState<number>(0);

  // General error/success banner
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Inspector modal / view
  const [inspectingPrompt, setInspectingPrompt] = useState(false);
  const [inspectingKB, setInspectingKB] = useState(false);

  // Modals for Jury & Teacher Storytelling
  const [showCompilationModal, setShowCompilationModal] = useState(false);
  const [showLabsIngestionModal, setShowLabsIngestionModal] = useState(false);
  const [selectedLabForInspection, setSelectedLabForInspection] = useState<Lab | null>(null);

  // Chapter AI Pre-flight & Staging modal
  const [stagedChapters, setStagedChapters] = useState<StagedChapterItem[]>([]);
  const [curriculumSummary, setCurriculumSummary] = useState<string>('');
  const [detectedModules, setDetectedModules] = useState<string[]>([]);
  const [showStagingModal, setShowStagingModal] = useState(false);
  const [preflightLogs, setPreflightLogs] = useState<string[]>([]);
  const [isPreflighting, setIsPreflighting] = useState(false);

  // Studio UI language toggle & chapter re-distillation toggle
  const [lang, setLang] = useState<'en' | 'fr'>('en');
  const [forceRedistillChapters, setForceRedistillChapters] = useState(false);

  if (!course) {
    return (
      <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl text-slate-400 space-y-4 max-w-xl mx-auto my-8 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
          <BookOpen className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-200">No Course Selected</h3>
          <p className="text-xs text-slate-400">
            Please select an existing course from the header dropdown, or create a brand new curriculum.
          </p>
        </div>
        {onCreateCourse && (
          <Button
            onClick={onCreateCourse}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5 font-semibold px-4"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Course</span>
          </Button>
        )}
      </div>
    );
  }

  // Strictly scope chapters and labs to the active course to avoid any cross-course leakage
  const chapters = (course.course_chapters || []).filter((c) => !c.course_id || c.course_id === course.id);
  const labs = (course.labs || []).filter((l) => !l.course_id || l.course_id === course.id);
  const hasTaxonomy = Array.isArray(course.competency_matrix) && course.competency_matrix.length > 0;
  const hasCompiledPrompt = Boolean(course.compiled_tutor_prompt && course.compiled_tutor_prompt.length > 20);

  // Granular task progress flags to prevent cross-card loading pollution
  const isDistillingChapters = isProcessing && currentProgress?.stage === 'Distilling Chapters';
  const isSynthesizingKB = isProcessing && currentProgress?.stage === 'Synthesizing KB & Prompt';
  const isUploadingChapters = isProcessing && currentProgress?.stage === 'Chapters / Slides';
  const isUploadingLabs = isProcessing && currentProgress?.stage === 'Labs / TP';
  const isReanalyzingLabs = isProcessing && currentProgress?.stage === 'Re-analyzing Labs';

  // --------------------------------------------------------------------------
  // BATCH UPLOAD: CHAPTERS (AI PRE-FLIGHT & HUMAN-IN-THE-LOOP STAGING)
  // --------------------------------------------------------------------------
  const handleBatchChaptersUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    setIsProcessing(true);
    setIsPreflighting(true);
    setStatusMessage(null);
    setPreflightLogs([
      `📄 [Client Extractor] Scanning ${files.length} lecture deck(s) in browser memory...`,
    ]);

    try {
      // 1. Quick client-side scan of slide 1 for each file (< 300ms total)
      const preflightPayload = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const firstSlideText = await extractFirstPageInBrowser(f);
        preflightPayload.push({ filename: f.name, firstSlideText });
        const snippet = firstSlideText ? firstSlideText.slice(0, 45).replace(/\s+/g, ' ').trim() : 'Title slide detected';
        setPreflightLogs((prev) => [
          ...prev,
          `✔ [Vector Parse] Page 1 scanned: "${f.name}" (${snippet}...)`,
        ]);
      }

      // 2. Call Meta AI Pre-flight to infer optimal sequence, modules, and titles
      setPreflightLogs((prev) => [
        ...prev,
        `🧠 [Meta AI muse-spark-1.3] Streaming manifest (${files.length} decks) for curriculum sequence inference...`,
        `⚡ [Engine] Analyzing prerequisite dependencies and module boundaries...`,
      ]);

      const preflightRes = await fetch('/api/studio/chapters-preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: course.id,
          files: preflightPayload,
        }),
      });

      if (!preflightRes.ok) {
        const errData = await preflightRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Pre-flight analysis failed');
      }

      const preflightData = await preflightRes.json();
      const fileMap = new Map<string, File>();
      files.forEach((f) => fileMap.set(f.name, f));

      const staged: StagedChapterItem[] = (preflightData.chapters || []).map((ch: PreflightChapterItem) => ({
        ...ch,
        file: fileMap.get(ch.filename) || files[0],
      }));

      setPreflightLogs((prev) => [
        ...prev,
        `🎯 [Continuum Engine] Inferred continuous curriculum progression 1..${staged.length}`,
        `🛡️ [Collision Shield] Reconciled relative numbering & assigned unique codes`,
        `✨ Pre-flight complete! Launching Interactive Staging Console...`,
      ]);

      setStagedChapters(staged);
      setCurriculumSummary(preflightData.curriculum_summary || '');
      setDetectedModules(preflightData.detected_modules || []);

      // Brief delay to allow teacher/jury to see the finished telemetry in the terminal
      await new Promise((r) => setTimeout(r, 600));
      setIsPreflighting(false);
      setShowStagingModal(true);
    } catch (err: unknown) {
      console.error('[Pre-flight Error]:', err);
      // Graceful fallback: Still open staging modal with filename heuristics so teacher can reorder manually
      const fileMap = new Map<string, File>();
      files.forEach((f) => fileMap.set(f.name, f));
      const fallbackStaged: StagedChapterItem[] = files.map((f, idx) => {
        const info = inferNumberAndTitle(f.name, idx + 1);
        return {
          filename: f.name,
          order: idx + 1,
          chapter_number: info.number,
          module: 'Course',
          title: info.suggestedTitle,
          title_en: info.suggestedTitle,
          code: info.code,
          reasoning: 'Sequential file order.',
          source_quote: 'Extracted from file metadata.',
          action_taken: 'Sequential order heuristic.',
          file: f,
        };
      });
      setStagedChapters(fallbackStaged);
      setCurriculumSummary('Fallback sequence determined from sequential file naming.');
      setDetectedModules(['Course']);
      setIsPreflighting(false);
      setShowStagingModal(true);
    } finally {
      setIsProcessing(false);
      setIsPreflighting(false);
      setCurrentProgress(null);
      e.target.value = '';
    }
  };

  // --------------------------------------------------------------------------
  // IN-PLACE CHAPTER MANAGEMENT (REORDER & DELETE)
  // --------------------------------------------------------------------------
  const handleMoveExistingChapter = async (chapterId: string, direction: 'up' | 'down') => {
    const sorted = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);
    const idx = sorted.findIndex((c) => c.id === chapterId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sorted.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const currNum = sorted[idx].chapter_number;
    const targetNum = sorted[targetIdx].chapter_number;

    const updates = [
      { id: sorted[idx].id, chapter_number: targetNum },
      { id: sorted[targetIdx].id, chapter_number: currNum },
    ];

    try {
      const res = await fetch('/api/studio/chapters-reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: course.id,
          chapters: updates,
        }),
      });

      if (!res.ok) throw new Error('Failed to reorder chapters');
      await onCourseUpdated();
    } catch (err) {
      console.error('[Move Chapter Error]:', err);
    }
  };

  const handleDeleteChapter = async (chapterId: string, chapterTitle: string) => {
    if (!confirm(`Delete chapter "${chapterTitle}" from course?`)) return;

    try {
      const res = await fetch('/api/studio/chapter-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: course.id,
          chapterId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete chapter');
      }
      await onCourseUpdated();
    } catch (err) {
      console.error('[Delete Chapter Error]:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete chapter');
    }
  };

  // --------------------------------------------------------------------------
  // BATCH UPLOAD: LABS / TP
  // --------------------------------------------------------------------------
  const handleBatchLabsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    if (!hasTaxonomy) {
      setStatusMessage({
        type: 'error',
        text: 'Please compile the Course Knowledge Base (Step 3) first so that labs can map to canonical micro-competencies!',
      });
      e.target.value = '';
      return;
    }

    const files = Array.from(fileList);
    // Natural numeric sort: TP1 before TP2 before TP10
    files.sort((a, b) => {
      const numA = inferNumberAndTitle(a.name).number;
      const numB = inferNumberAndTitle(b.name).number;
      return numA - numB;
    });

    setIsProcessing(true);
    setStatusMessage(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const info = inferNumberAndTitle(file.name, i + 1);

        setCurrentProgress({
          stage: 'Labs / TP',
          current: i + 1,
          total: files.length,
          filename: file.name,
        });

        // 1. Extract text in browser
        const pages = await extractPdfPagesInBrowser(file);

        // 2. Upload PDF with accent-free slug
        const storagePath = slugifyStorageKey(file.name, course.code, 'labs');
        const pdfUrl = await uploadCoursePdf(file, storagePath);

        // 3. Call backend AI analyzer with Golden Lab Decomposition Shot
        const res = await fetch('/api/studio/lab-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId: course.id,
            labNumber: info.number,
            code: info.code,
            title: info.suggestedTitle,
            pdfUrl,
            pages,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(`Failed to analyze lab "${file.name}": ${errData.error || res.statusText}`);
        }
      }

      await onCourseUpdated();
      setShowLabsIngestionModal(true);
      setStatusMessage({
        type: 'success',
        text: `Successfully decomposed and configured ${files.length} lab(s) with activities, milestones, and demo presets!`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Batch lab upload failed';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsProcessing(false);
      setCurrentProgress(null);
      e.target.value = '';
    }
  };

  // --------------------------------------------------------------------------
  // RE-ANALYZE ALL LABS DIRECTLY FROM SUPABASE STORAGE (1-CLICK FOR JUDGES)
  // --------------------------------------------------------------------------
  const handleReanalyzeAllLabs = async () => {
    if (!labs || labs.length === 0) return;

    setIsProcessing(true);
    setStatusMessage(null);

    // Sort naturally: TP1, TP2, ..., TP12
    const sortedLabs = [...labs].sort((a, b) => a.lab_number - b.lab_number);

    try {
      for (let i = 0; i < sortedLabs.length; i++) {
        const lb = sortedLabs[i];
        if (!lb.pdf_url) continue;

        setCurrentProgress({
          stage: 'Re-analyzing Labs',
          current: i + 1,
          total: sortedLabs.length,
          filename: `TP ${lb.lab_number} (${lb.code})`,
        });

        // Extract PDF pages client-side from public Storage URL
        const pages = await extractPdfPagesFromUrl(lb.pdf_url);

        const res = await fetch('/api/studio/lab-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId: course.id,
            labNumber: lb.lab_number,
            code: lb.code,
            title: lb.title,
            pdfUrl: lb.pdf_url,
            pages,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(`Failed to re-analyze TP ${lb.lab_number}: ${errData.error || res.statusText}`);
        }
      }

      await onCourseUpdated();
      setShowLabsIngestionModal(true);
      setStatusMessage({
        type: 'success',
        text: `All ${sortedLabs.length} lab(s) successfully re-analyzed with full PDF text, 100% bilingual EN/FR activities and demo presets!`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Re-analyzing labs failed';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsProcessing(false);
      setCurrentProgress(null);
    }
  };

  // --------------------------------------------------------------------------
  // COMPILE COURSE (TAXONOMY + CUSTOM MENTOR PROMPT + COMPILED KB)
  // Single intelligent button: auto-distills chapters with missing title_i18n
  // --------------------------------------------------------------------------
  const handleCompileCourse = async () => {
    setIsProcessing(true);
    setStatusMessage(null);

    try {
      // 1. Check if chapters need re-distillation (forceRedistillChapters checked OR title_i18n missing)
      const chaptersNeedingDistillation = chapters.filter(
        (ch) => Boolean(ch.pdf_url) && (forceRedistillChapters || !ch.title_i18n)
      );

      if (chaptersNeedingDistillation.length > 0) {
        const sortedChaps = [...chaptersNeedingDistillation].sort((a, b) => a.chapter_number - b.chapter_number);
        for (let i = 0; i < sortedChaps.length; i++) {
          const ch = sortedChaps[i];
          setCurrentProgress({
            stage: 'Distilling Chapters',
            current: i + 1,
            total: sortedChaps.length,
            filename: `Chapter ${ch.chapter_number}: ${ch.title}`,
          });

          const pages = await extractPdfPagesFromUrl(ch.pdf_url!);
          const res = await fetch('/api/studio/chapter-analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              courseId: course.id,
              chapterNumber: ch.chapter_number,
              code: ch.code,
              title: ch.title,
              pdfUrl: ch.pdf_url,
              pages,
            }),
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(`Failed to distill chapter "${ch.title}": ${errData.error || res.statusText}`);
          }
        }
      }

      // 2. Synthesize Course Knowledge Base & Custom Tutor Prompt
      setCurrentProgress({
        stage: 'Synthesizing KB & Prompt',
        current: 1,
        total: 1,
        filename: `${course.title} (${course.code})`,
      });
      setCompilationPhase(0);
      setCompilationElapsed(0);

      // Realtime elapsed counter & phased step progression
      const elapsedInterval = setInterval(() => {
        setCompilationElapsed((prev) => prev + 1);
      }, 1000);

      const t1 = setTimeout(() => setCompilationPhase(1), 2800);
      const t2 = setTimeout(() => setCompilationPhase(2), 7200);
      const t3 = setTimeout(() => setCompilationPhase(3), 12500);

      let res: Response;
      try {
        res = await fetch('/api/studio/compile-course', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId: course.id }),
        });
      } finally {
        clearInterval(elapsedInterval);
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to compile course');
      }

      // Visual completion state (Phase 5: 100%)
      setCompilationPhase(4);
      await new Promise((r) => setTimeout(r, 600));

      await onCourseUpdated();
      setForceRedistillChapters(false);
      setShowCompilationModal(true);
      setStatusMessage({
        type: 'success',
        text: chaptersNeedingDistillation.length > 0
          ? `Successfully distilled ${chaptersNeedingDistillation.length} chapter(s) with full text and synthesized Course Knowledge Base & Mentor Prompt!`
          : 'Course Knowledge Base compiled successfully! Custom Mentor Prompt and Competency Taxonomy are active.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Compilation failed';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsProcessing(false);
      setCurrentProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 4-STEP CHECKLIST HEADER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white">{course.title}</span>
              <Badge variant="outline" className="font-mono text-[10px] text-emerald-400 border-emerald-500/30">
                {course.code}
              </Badge>
              {/* STUDIO LANGUAGE TOGGLE */}
              <div className="inline-flex items-center gap-0.5 bg-slate-950 px-1.5 py-0.5 rounded-lg border border-slate-800 text-[10px] font-mono shrink-0 ml-1">
                <button
                  onClick={() => setLang('en')}
                  className={`px-1.5 py-0.5 rounded transition ${
                    lang === 'en' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="Display in English for International Jury"
                >
                  EN
                </button>
                <span className="text-slate-600">|</span>
                <button
                  onClick={() => setLang('fr')}
                  className={`px-1.5 py-0.5 rounded transition ${
                    lang === 'fr' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="Afficher en Français"
                >
                  FR
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Languages: <span className="text-slate-200 uppercase font-mono">{course.content_language}</span> (Slides) ➔{' '}
              <span className="text-slate-200 uppercase font-mono">{course.tutor_language}</span> (Tutor) • Extensions:{' '}
              <span className="text-slate-200 font-mono">{course.file_extensions?.join(', ')}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hasTaxonomy && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCompilationModal(true)}
                className="text-xs h-8 bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:text-white"
                title="View Curriculum Taxonomy & AI Mentor Prompt"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                Curriculum Synthesis 🧠
              </Button>
            )}
            {labs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLabsIngestionModal(true)}
                className="text-xs h-8 bg-cyan-950/40 border-cyan-500/40 text-cyan-300 hover:text-white"
                title="View Decomposed Labs, Milestones, and Demo Presets"
              >
                <Layers className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                Labs Briefing 📋
              </Button>
            )}
            {hasCompiledPrompt && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInspectingPrompt(!inspectingPrompt)}
                className="text-xs h-8 bg-slate-950 border-slate-800 text-slate-300 hover:text-white"
              >
                <Code2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                {inspectingPrompt ? 'Hide Prompt' : 'View Mentor Prompt'}
              </Button>
            )}
            {course.compiled_knowledge_base && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInspectingKB(!inspectingKB)}
                className="text-xs h-8 bg-slate-950 border-slate-800 text-slate-300 hover:text-white"
              >
                <FileText className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                {inspectingKB ? 'Hide KB' : 'View Compiled KB'}
              </Button>
            )}
            {onDeleteCourse && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDeleteCourse}
                className="text-xs h-8 bg-rose-950/20 border-rose-500/30 text-rose-400 hover:text-rose-200 hover:bg-rose-950/50 hover:border-rose-500/60 transition gap-1"
                title={`Delete course ${course.code} (Protected by Jury PIN 2026)`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Course</span>
              </Button>
            )}
          </div>
        </div>

        {/* PROGRESS STEPPER */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>1. Course Config</span>
          </div>

          <div
            className={`flex items-center gap-2 p-2 rounded-lg border font-medium ${
              chapters.length > 0
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
          >
            {chapters.length > 0 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center text-[10px]">
                2
              </div>
            )}
            <span>2. Chapters ({chapters.length})</span>
          </div>

          <div
            className={`flex items-center gap-2 p-2 rounded-lg border font-medium ${
              hasTaxonomy && hasCompiledPrompt
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
          >
            {hasTaxonomy ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center text-[10px]">
                3
              </div>
            )}
            <span>3. Compiled KB & Prompt</span>
          </div>

          <div
            className={`flex items-center gap-2 p-2 rounded-lg border font-medium ${
              labs.length > 0
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
          >
            {labs.length > 0 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center text-[10px]">
                4
              </div>
            )}
            <span>4. Labs & TP ({labs.length})</span>
          </div>
        </div>
      </div>

      {/* STATUS & PROGRESS BANNERS */}
      {currentProgress && currentProgress.stage === 'Synthesizing KB & Prompt' ? (
        <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-5 text-xs space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Sparkles className="w-4 h-4 animate-spin text-emerald-400" />
              </div>
              <div>
                <h4 className="font-bold text-slate-100 flex items-center gap-2 text-sm">
                  Distilling Curriculum with Meta AI
                  <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400 font-mono">
                    muse-spark-1.3
                  </Badge>
                </h4>
                <p className="text-[11px] text-slate-400">
                  {COMPILATION_PHASES[compilationPhase]?.title}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-bold text-emerald-400 font-mono">
                {COMPILATION_PHASES[compilationPhase]?.pct}%
              </span>
              <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1 justify-end">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>{compilationElapsed}s elapsed</span>
              </p>
            </div>
          </div>

          {/* Progress Bar with smooth transition */}
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 h-2 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${COMPILATION_PHASES[compilationPhase]?.pct}%` }}
            />
          </div>

          {/* 4-Step Visual Stepper */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {COMPILATION_PHASES.slice(0, 4).map((p, idx) => {
              const isPast = compilationPhase > idx;
              const isCurrent = compilationPhase === idx;
              return (
                <div
                  key={p.step}
                  className={`p-2 rounded-xl border text-[11px] space-y-1 transition ${
                    isPast
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                      : isCurrent
                      ? 'bg-slate-950 border-cyan-500/50 text-cyan-200 shadow-sm'
                      : 'bg-slate-950/40 border-slate-850 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold">Step {p.step}</span>
                    {isPast ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : isCurrent ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-800" />
                    )}
                  </div>
                  <p className="text-[10px] font-medium leading-tight line-clamp-1">{p.title}</p>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/60 p-2.5 rounded-xl border border-slate-850">
            <span className="text-emerald-400 font-semibold mr-1.5">Active Process:</span>
            {COMPILATION_PHASES[compilationPhase]?.description}
          </p>
        </div>
      ) : currentProgress ? (
        <div className="bg-cyan-950/40 border border-cyan-500/40 rounded-2xl p-4 text-xs space-y-2 animate-pulse">
          <div className="flex items-center justify-between font-semibold text-cyan-300">
            <span>
              Analyzing {currentProgress.stage} ({currentProgress.current} of {currentProgress.total})...
            </span>
            <span className="font-mono">{Math.round((currentProgress.current / currentProgress.total) * 100)}%</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-cyan-400 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${(currentProgress.current / currentProgress.total) * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 truncate">Current File: {currentProgress.filename}</p>
        </div>
      ) : null}

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            statusMessage.type === 'error'
              ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              : statusMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            ) : (
              <Sparkles className="w-4 h-4 shrink-0 text-emerald-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-500 hover:text-slate-300 text-sm ml-2">
            ✕
          </button>
        </div>
      )}

      {/* INSPECTOR: COMPILED TUTOR PROMPT */}
      {inspectingPrompt && (
        <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-emerald-400" /> Generated Course Mentor System Prompt (PEDAGOGICAL ANCHORING & FEW-SHOTS)
            </span>
            <span className="text-[10px] text-slate-500">Auto-generated via Golden Tutor Prompt Shot</span>
          </div>
          <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] text-slate-300 font-mono max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {course.compiled_tutor_prompt}
          </pre>
        </div>
      )}

      {/* INSPECTOR: COMPILED KNOWLEDGE BASE */}
      {inspectingKB && (
        <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-cyan-400" /> Dense Compiled Knowledge Base (~3,500 Tokens)
            </span>
            <span className="text-[10px] text-slate-500">Cached statically on muse-spark-1.3 prefix</span>
          </div>
          <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] text-slate-300 font-mono max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {course.compiled_knowledge_base}
          </pre>
        </div>
      )}

      {/* TWO WORKFLOW CARDS: CHAPTERS & LABS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARD 1: CHAPTERS UPLOAD & DISTILLATION */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Course Chapters (PDF)</h3>
              </div>
              <div className="flex items-center gap-2">
                {hasTaxonomy && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCompilationModal(true)}
                    className="text-[11px] h-7 bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:text-white hover:bg-emerald-900/40 transition font-medium"
                    title="View Curriculum Taxonomy & AI Mentor Prompt"
                  >
                    <Sparkles className="w-3 h-3 mr-1 text-emerald-400" />
                    View Synthesis 🧠
                  </Button>
                )}
                <Badge variant="outline" className="text-xs text-slate-400 border-slate-800 font-mono">
                  {chapters.length} Chapter(s)
                </Badge>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Drag & drop your official chapter slide decks (e.g. from <code className="text-slate-300 font-mono">_dev/java_course/course_chapters/</code>).
              Extracted client-side with exact slide anchoring.
            </p>

            {/* BATCH CHAPTERS INPUT */}
            <div className="relative border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-xl p-4 text-center cursor-pointer transition bg-slate-950/40">
              <input
                type="file"
                multiple
                accept=".pdf"
                disabled={isProcessing}
                onChange={handleBatchChaptersUpload}
                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <Upload className="w-5 h-5 text-emerald-400 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-slate-200">
                {isUploadingChapters ? 'Processing...' : 'Upload Chapter PDFs (Batch Supported)'}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Select ch1..ch6 all at once</p>
            </div>

            {/* LIST OF CURRENT CHAPTERS */}
            {chapters.length > 0 && (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {[...chapters]
                  .sort((a, b) => a.chapter_number - b.chapter_number)
                  .map((ch, idx, arr) => (
                    <div
                      key={ch.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-850 text-xs hover:border-slate-800 transition"
                    >
                      <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                        {/* Reorder Buttons */}
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={isProcessing || idx === 0}
                            onClick={() => handleMoveExistingChapter(ch.id, 'up')}
                            className="p-0.5 text-slate-500 hover:text-emerald-400 disabled:opacity-20 disabled:hover:text-slate-500 transition"
                            title="Move chapter up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={isProcessing || idx === arr.length - 1}
                            onClick={() => handleMoveExistingChapter(ch.id, 'down')}
                            className="p-0.5 text-slate-500 hover:text-emerald-400 disabled:opacity-20 disabled:hover:text-slate-500 transition"
                            title="Move chapter down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="font-mono text-[10px] text-emerald-400 shrink-0 font-bold">
                          Ch.{ch.chapter_number}
                        </span>
                        <span className="text-slate-200 truncate font-medium">
                          {getLocalizedChapterTitle(ch, lang)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {ch.pdf_url && (
                          <a
                            href={ch.pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-cyan-400 hover:underline px-1 py-0.5"
                          >
                            PDF ↗
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleDeleteChapter(ch.id, getLocalizedChapterTitle(ch, lang))}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition"
                          title="Delete chapter from course"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* COMPILE / VIEW SYNTHESIS BUTTONS */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200">
                <input
                  type="checkbox"
                  checked={forceRedistillChapters}
                  onChange={(e) => setForceRedistillChapters(e.target.checked)}
                  disabled={isProcessing}
                  className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0 w-3.5 h-3.5"
                />
                <span>Re-distill chapter PDFs from Storage</span>
              </label>
              <span className="text-[10px] text-emerald-400 font-mono">Auto-detects missing title_i18n</span>
            </div>

            {hasTaxonomy ? (
              <div className="space-y-2">
                <Button
                  onClick={() => setShowCompilationModal(true)}
                  disabled={isProcessing}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold h-9 shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                  <span>View Curriculum Synthesis &amp; Mentor Briefing</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={handleCompileCourse}
                  disabled={isProcessing || chapters.length === 0}
                  className="w-full border-slate-750 bg-slate-950/70 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium h-8 transition-all flex items-center justify-center gap-1.5"
                >
                  {isDistillingChapters && currentProgress ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Distilling Chapters ({currentProgress.current}/{currentProgress.total})...</span>
                    </>
                  ) : isSynthesizingKB ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Synthesizing with Meta AI ({compilationElapsed}s)...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3 h-3 text-slate-400" />
                      <span>Recompile Knowledge Base &amp; Mentor Prompt</span>
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleCompileCourse}
                disabled={isProcessing || chapters.length === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold h-9 shadow-md transition-all"
              >
                {isDistillingChapters && currentProgress ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Distilling Chapters ({currentProgress.current}/{currentProgress.total})...
                  </>
                ) : isSynthesizingKB ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Synthesizing with Meta AI ({compilationElapsed}s)...
                  </>
                ) : chapters.length === 0 ? (
                  <>
                    <BookOpen className="w-3.5 h-3.5 mr-1.5 opacity-60" />
                    Upload Chapter PDFs First (Step 2)
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Compile Knowledge Base &amp; Prompt
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* CARD 2: LABS & TP DECOMPOSITION */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Lab Exercises (TP)</h3>
              </div>
              <div className="flex items-center gap-2">
                {labs.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLabsIngestionModal(true)}
                    className="text-[11px] h-7 bg-cyan-950/40 border-cyan-500/30 text-cyan-300 hover:text-white hover:bg-cyan-900/40 transition font-medium"
                    title="View decomposed activities, milestones, and 1-click Judge Presets"
                  >
                    <Layers className="w-3 h-3 mr-1 text-cyan-400" />
                    View TP Briefing 📋
                  </Button>
                )}
                <Badge variant="outline" className="text-xs text-slate-400 border-slate-800 font-mono">
                  {labs.length} TP
                </Badge>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload your lab statements (e.g. <code className="text-slate-300 font-mono">TP1.pdf</code> to <code className="text-slate-300 font-mono">TP12.pdf</code>).
              The AI derives activities, sequential milestones, and 1-click Judge Demo Presets.
            </p>

            {/* PREREQUISITE ALERT WHEN NOT COMPILED */}
            {!hasTaxonomy ? (
              <div className="p-3.5 bg-amber-950/30 border border-amber-500/40 rounded-xl space-y-2 text-xs">
                <div className="flex items-start gap-2.5 text-amber-300 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-amber-200">
                      Prerequisite Required: Compile Knowledge Base First (Step 3)
                    </p>
                    <p className="text-[11px] font-normal text-amber-200/80 leading-relaxed">
                      Before uploading Lab PDFs (TP), Socratix requires the Course Knowledge Base and Competency Matrix to be compiled from your chapter slides. This allows the AI to map lab activities to official lecture concepts.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleCompileCourse}
                  disabled={isProcessing || chapters.length === 0}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs h-8 gap-1.5 shadow-sm mt-1 transition-all"
                >
                  {isDistillingChapters && currentProgress ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      <span>Distilling Chapters ({currentProgress.current}/{currentProgress.total})...</span>
                    </>
                  ) : isSynthesizingKB ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      <span>Synthesizing with Meta AI ({compilationElapsed}s)...</span>
                    </>
                  ) : chapters.length === 0 ? (
                    <>
                      <BookOpen className="w-3.5 h-3.5 mr-1.5 opacity-60" />
                      <span>Upload Chapter PDFs First (Step 2)</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      <span>⚡ Compile Knowledge Base & Mentor Prompt Now</span>
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="p-2.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-medium text-[11px]">
                    Knowledge Base &amp; Taxonomy compiled. Ready for Lab PDFs!
                  </span>
                </div>
                <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-400 font-mono">
                  Step 3 Ready
                </Badge>
              </div>
            )}

            {/* BATCH LABS INPUT */}
            <div
              className={`relative border-2 border-dashed rounded-xl p-4 text-center transition ${
                !hasTaxonomy
                  ? 'border-slate-800 bg-slate-950/30 opacity-70 cursor-not-allowed'
                  : 'border-slate-850 hover:border-cyan-500/50 bg-slate-950/40 cursor-pointer'
              }`}
            >
              <input
                type="file"
                multiple
                accept=".pdf"
                disabled={isProcessing || !hasTaxonomy}
                onChange={handleBatchLabsUpload}
                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              {!hasTaxonomy ? (
                <>
                  <Lock className="w-5 h-5 text-amber-400/80 mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-slate-300">
                    Upload Locked &mdash; Compile Course First
                  </p>
                  <p className="text-[10px] text-amber-400/80 mt-0.5">
                    Click &ldquo;Compile Knowledge Base &amp; Prompt&rdquo; above to unlock lab ingestion
                  </p>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-cyan-400 mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-slate-200">
                    {isUploadingLabs ? 'Processing...' : 'Upload Lab PDFs (TP1..TP12)'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Select all 12 TP files at once</p>
                </>
              )}
            </div>

            {/* LIST OF CURRENT LABS */}
            {labs.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {labs.map((lb) => (
                  <div
                    key={lb.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-850 text-xs hover:border-slate-750 transition"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono text-[10px] text-cyan-400 font-semibold">TP {lb.lab_number}</span>
                      <span className="text-slate-200 truncate">{getLocalizedLabTitle(lb, lang)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        onClick={() => setSelectedLabForInspection(lb)}
                        className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded-md hover:bg-cyan-900/40 transition font-medium"
                        title="Inspect activities, milestones and presets"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                      <span className="text-[10px] text-slate-500">
                        {lb.activities?.length || 0} act.
                      </span>
                      {lb.pdf_url && (
                        <a
                          href={lb.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-slate-400 hover:text-slate-200 hover:underline"
                        >
                          PDF ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RE-ANALYZE / VIEW LABS DECOMPOSITION BUTTONS */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            {labs.length > 0 ? (
              <div className="space-y-2">
                <Button
                  onClick={() => setShowLabsIngestionModal(true)}
                  disabled={isProcessing}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold h-9 shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5 text-cyan-200" />
                  <span>View TP Decomposition &amp; Presets Briefing ({labs.length} TP)</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={handleReanalyzeAllLabs}
                  disabled={isProcessing || !hasTaxonomy}
                  className="w-full border-slate-750 bg-slate-950/70 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium h-8 transition-all flex items-center justify-center gap-1.5"
                >
                  {isReanalyzingLabs && currentProgress ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                      <span>Re-analyzing Labs with Meta AI ({currentProgress.current}/{currentProgress.total})...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3 h-3 text-cyan-400" />
                      <span>⚡ Re-analyze All Labs with Meta AI</span>
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <Button
                disabled
                className="w-full bg-slate-800/60 text-slate-500 text-xs font-semibold h-9 cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5 opacity-60" />
                <span>Upload Lab PDFs First (Step 4)</span>
              </Button>
            )}

            <div className="text-[10px] text-slate-400 flex items-center justify-between">
              <span>Automatic natural sorting: TP1, TP2, ...</span>
              <span className="text-cyan-400 font-mono">1-Click Remote PDF Re-analysis</span>
            </div>
          </div>
        </div>
      </div>

      {/* DANGER ZONE (SUGGESTION A) */}
      {onDeleteCourse && (
        <div className="bg-slate-900/60 border border-rose-900/40 rounded-2xl p-5 space-y-3 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" />
                <span>Danger Zone</span>
              </div>
              <p className="text-xs text-slate-300">
                Permanently delete <span className="font-semibold text-white font-mono">{course.code}</span> ({course.title}) and cascade all its chapters, labs, and telemetry sessions.
              </p>
              <p className="text-[11px] text-slate-500">
                Protected by Hackathon Jury PIN (<code className="text-amber-400 font-mono">{process.env.NEXT_PUBLIC_JURY_PIN || '2026'}</code>) or Teacher authorization.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onDeleteCourse}
              className="bg-rose-950/40 border-rose-500/40 text-rose-300 hover:text-white hover:bg-rose-600 hover:border-rose-600 text-xs font-semibold h-9 px-4 shrink-0 shadow-md transition-all gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete this Course</span>
            </Button>
          </div>
        </div>
      )}

      {/* PROPOSITION 1: LIVE AI PRE-FLIGHT TELEMETRY MODAL */}
      {isPreflighting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-slate-950 border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs">
            {/* Terminal Title Bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                </div>
                <span className="text-slate-200 font-semibold text-xs ml-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Meta AI Curriculum Pre-flight Telemetry
                </span>
              </div>
              <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] font-mono">
                muse-spark-1.3
              </Badge>
            </div>

            {/* Terminal Logs Body */}
            <div className="p-4 space-y-2 max-h-72 overflow-y-auto text-[11px] bg-slate-950 text-slate-300">
              {preflightLogs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2 animate-in fade-in duration-150">
                  <span className="text-emerald-500 select-none">➜</span>
                  <span
                    className={
                      log.includes('✔')
                        ? 'text-emerald-300'
                        : log.includes('🧠') || log.includes('⚡')
                        ? 'text-cyan-300 font-semibold'
                        : log.includes('✨')
                        ? 'text-white font-bold'
                        : 'text-slate-300'
                    }
                  >
                    {log}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2 text-emerald-400 pt-1 border-t border-slate-900">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="animate-pulse">Synthesizing curriculum continuum & collision-free codes...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 0: CHAPTER STAGING & REORDERING MODAL */}
      {showStagingModal && course && (
        <ChapterStagingModal
          isOpen={showStagingModal}
          onClose={() => setShowStagingModal(false)}
          courseId={course.id}
          courseCode={course.code}
          curriculumSummary={curriculumSummary}
          detectedModules={detectedModules}
          initialItems={stagedChapters}
          onDistillationComplete={async () => {
            await onCourseUpdated();
            setStatusMessage({
              type: 'success',
              text: `Successfully imported and distilled ${stagedChapters.length} chapter(s)! You can now compile the Knowledge Base.`,
            });
          }}
        />
      )}

      {/* MODAL 1: COURSE COMPILATION SUMMARY */}
      {showCompilationModal && course && (
        <CourseCompilationSummaryModal
          isOpen={showCompilationModal}
          onClose={() => setShowCompilationModal(false)}
          course={course}
          initialLang={lang}
          onProceedToLabs={() => {
            setShowCompilationModal(false);
          }}
        />
      )}

      {/* MODAL 2: LABS BATCH INGESTION SUMMARY */}
      {showLabsIngestionModal && (
        <LabsBatchIngestionModal
          isOpen={showLabsIngestionModal}
          onClose={() => setShowLabsIngestionModal(false)}
          labs={labs}
          course={course}
          initialLang={lang}
          onInspectLab={(lb) => {
            setShowLabsIngestionModal(false);
            setSelectedLabForInspection(lb);
          }}
          onOpenAnalytics={onOpenAnalyticsTab}
        />
      )}

      {/* MODAL 3: INDIVIDUAL LAB INSPECTOR */}
      {selectedLabForInspection && (
        <LabDetailModal
          isOpen={Boolean(selectedLabForInspection)}
          onClose={() => setSelectedLabForInspection(null)}
          lab={selectedLabForInspection}
          initialLang={lang}
        />
      )}
    </div>
  );
}
