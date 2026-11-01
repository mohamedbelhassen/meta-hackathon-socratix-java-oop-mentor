'use client';

import React, { useState } from 'react';
import { Course, CourseChapter, Lab } from '@/types/socratix';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  extractPdfPagesInBrowser,
  extractPdfPagesFromUrl,
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
} from 'lucide-react';
import CourseCompilationSummaryModal from '@/components/CourseCompilationSummaryModal';
import LabsBatchIngestionModal from '@/components/LabsBatchIngestionModal';
import LabDetailModal from '@/components/LabDetailModal';
import { parseBilingualDescription } from '@/lib/bilingual-helper';

interface CourseStudioPanelProps {
  course: (Course & { course_chapters?: CourseChapter[]; labs?: Lab[] }) | null;
  onCourseUpdated: () => void;
  onOpenAnalyticsTab?: () => void;
}

export default function CourseStudioPanel({
  course,
  onCourseUpdated,
  onOpenAnalyticsTab,
}: CourseStudioPanelProps) {
  // Batch processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<{
    stage: string;
    current: number;
    total: number;
    filename: string;
  } | null>(null);

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

  if (!course) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 space-y-3">
        <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
        <p className="text-sm">Please select or create a course to access the Course Studio.</p>
      </div>
    );
  }

  const chapters = course.course_chapters || [];
  const labs = course.labs || [];
  const hasTaxonomy = Array.isArray(course.competency_matrix) && course.competency_matrix.length > 0;
  const hasCompiledPrompt = Boolean(course.compiled_tutor_prompt && course.compiled_tutor_prompt.length > 20);

  // --------------------------------------------------------------------------
  // BATCH UPLOAD: CHAPTERS
  // --------------------------------------------------------------------------
  const handleBatchChaptersUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    // Natural numeric sort: ch1 before ch2 before ch10
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
        const info = inferNumberAndTitle(file.name);

        setCurrentProgress({
          stage: 'Chapters',
          current: i + 1,
          total: files.length,
          filename: file.name,
        });

        // 1. Extract text in browser
        const pages = await extractPdfPagesInBrowser(file);

        // 2. Upload PDF to Supabase Storage with accent-free slug
        const storagePath = slugifyStorageKey(file.name, course.code, 'chapters');
        const pdfUrl = await uploadCoursePdf(file, storagePath);

        // 3. Call backend AI analyzer with Golden Synthesis Shot
        const res = await fetch('/api/studio/chapter-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId: course.id,
            chapterNumber: info.number,
            code: info.code,
            title: info.suggestedTitle,
            pdfUrl,
            pages,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(`Failed to analyze chapter "${file.name}": ${errData.error || res.statusText}`);
        }
      }

      setStatusMessage({
        type: 'success',
        text: `Successfully imported and distilled ${files.length} chapter(s)! You can now compile the Knowledge Base.`,
      });
      onCourseUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Batch chapter upload failed';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsProcessing(false);
      setCurrentProgress(null);
      e.target.value = '';
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
        const info = inferNumberAndTitle(file.name);

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

      setShowLabsIngestionModal(true);
      setStatusMessage({
        type: 'success',
        text: `Successfully decomposed and configured ${files.length} lab(s) with activities, milestones, and demo presets!`,
      });
      onCourseUpdated();
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

      setShowLabsIngestionModal(true);
      setStatusMessage({
        type: 'success',
        text: `All ${sortedLabs.length} lab(s) successfully re-analyzed with bilingual EN/FR descriptions, milestones, and demo presets!`,
      });
      onCourseUpdated();
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
  // --------------------------------------------------------------------------
  const handleCompileCourse = async () => {
    setIsProcessing(true);
    setStatusMessage({
      type: 'info',
      text: 'Analyzing all chapters, deduplicating competencies, and synthesizing custom tutor prompt with Golden Shots...',
    });

    try {
      const res = await fetch('/api/studio/compile-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: course.id }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to compile course');
      }

      setShowCompilationModal(true);
      setStatusMessage({
        type: 'success',
        text: 'Course Knowledge Base compiled successfully! Custom Mentor Prompt and Competency Taxonomy are active.',
      });
      onCourseUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Compilation failed';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsProcessing(false);
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
              >
                <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                Curriculum Synthesis 🧠
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
      {currentProgress && (
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
      )}

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
              <Badge variant="outline" className="text-xs text-slate-400 border-slate-800 font-mono">
                {chapters.length} Chapter(s)
              </Badge>
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
                {isProcessing ? 'Processing...' : 'Upload Chapter PDFs (Batch Supported)'}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Select ch1..ch6 all at once</p>
            </div>

            {/* LIST OF CURRENT CHAPTERS */}
            {chapters.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {chapters.map((ch) => (
                  <div
                    key={ch.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-850 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono text-[10px] text-emerald-400">Ch.{ch.chapter_number}</span>
                      <span className="text-slate-200 truncate">{ch.title}</span>
                    </div>
                    {ch.pdf_url && (
                      <a
                        href={ch.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-cyan-400 hover:underline shrink-0 ml-2"
                      >
                        PDF ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* COMPILE BUTTON */}
          <div className="pt-3 border-t border-slate-800">
            <Button
              onClick={handleCompileCourse}
              disabled={isProcessing || chapters.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold h-9 shadow-md transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Synthesizing Taxonomy & Prompt with Meta AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  {hasTaxonomy ? 'Recompile Knowledge Base & Mentor Prompt' : 'Compile Knowledge Base & Prompt'}
                </>
              )}
            </Button>
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
                    className="text-[11px] h-7 bg-cyan-950/40 border-cyan-500/30 text-cyan-300 hover:text-white"
                  >
                    <Layers className="w-3 h-3 mr-1" />
                    All TP Briefing
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

            {/* BATCH LABS INPUT */}
            <div
              className={`relative border-2 border-dashed rounded-xl p-4 text-center transition ${
                !hasTaxonomy
                  ? 'border-slate-850 bg-slate-950/20 opacity-60 cursor-not-allowed'
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
              <Upload className="w-5 h-5 text-cyan-400 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-slate-200">
                {isProcessing ? 'Processing...' : 'Upload Lab PDFs (TP1..TP12)'}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {!hasTaxonomy ? 'Compile Step 3 first' : 'Select all 12 TP files at once'}
              </p>
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
                      <span className="text-slate-200 truncate">{lb.title}</span>
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

          {/* RE-ANALYZE ALL LABS BUTTON (1-CLICK FOR JUDGES) */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <Button
              onClick={handleReanalyzeAllLabs}
              disabled={isProcessing || labs.length === 0 || !hasTaxonomy}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold h-9 shadow-md transition-all"
            >
              {isProcessing && currentProgress?.stage === 'Re-analyzing Labs' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Re-analyzing Labs with Meta AI ({currentProgress.current}/{currentProgress.total})...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 mr-1.5 text-cyan-200" />
                  ⚡ Re-analyze All Labs with Meta AI
                </>
              )}
            </Button>
            <div className="text-[10px] text-slate-400 flex items-center justify-between">
              <span>Automatic natural sorting: TP1, TP2, ..., TP12</span>
              <span className="text-cyan-400 font-mono">1-Click Remote PDF Re-analysis</span>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: COURSE COMPILATION SUMMARY */}
      {showCompilationModal && course && (
        <CourseCompilationSummaryModal
          isOpen={showCompilationModal}
          onClose={() => setShowCompilationModal(false)}
          course={course}
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
        />
      )}
    </div>
  );
}
