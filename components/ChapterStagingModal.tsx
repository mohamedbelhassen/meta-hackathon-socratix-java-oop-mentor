'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Trash2,
  Loader2,
  Search,
  ChevronDown,
  ChevronUp,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { extractPdfPagesInBrowser, uploadCoursePdf, slugifyStorageKey } from '@/lib/pdf-client-extractor';
import { PreflightChapterItem } from '@/app/api/studio/chapters-preflight/route';

export interface StagedChapterItem extends PreflightChapterItem {
  file: File;
}

interface ChapterStagingModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  courseCode: string;
  curriculumSummary?: string;
  detectedModules?: string[];
  initialItems: StagedChapterItem[];
  onDistillationComplete: () => Promise<void>;
}

export default function ChapterStagingModal({
  isOpen,
  onClose,
  courseId,
  courseCode,
  curriculumSummary,
  detectedModules = [],
  initialItems,
  onDistillationComplete,
}: ChapterStagingModalProps) {
  const [items, setItems] = useState<StagedChapterItem[]>(initialItems);
  const [isDistilling, setIsDistilling] = useState(false);
  const [expandedEvidence, setExpandedEvidence] = useState<Record<number, boolean>>({});
  const [progressState, setProgressState] = useState<{
    current: number;
    total: number;
    filename: string;
    subStep: 1 | 2 | 3;
    subStepLabel: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleEvidence = (index: number) => {
    setExpandedEvidence((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const newItems = [...items];
    const temp = newItems[index - 1];
    newItems[index - 1] = newItems[index];
    newItems[index] = temp;

    const startNum = items[0]?.chapter_number || 1;
    newItems.forEach((it, idx) => {
      it.order = idx + 1;
      it.chapter_number = startNum + idx;
    });

    setItems(newItems);
  };

  const handleMoveDown = (index: number) => {
    if (index >= items.length - 1) return;
    const newItems = [...items];
    const temp = newItems[index + 1];
    newItems[index + 1] = newItems[index];
    newItems[index] = temp;

    const startNum = items[0]?.chapter_number || 1;
    newItems.forEach((it, idx) => {
      it.order = idx + 1;
      it.chapter_number = startNum + idx;
    });

    setItems(newItems);
  };

  const handleRemove = (index: number) => {
    const newItems = items.filter((_, idx) => idx !== index);
    const startNum = items[0]?.chapter_number || 1;
    newItems.forEach((it, idx) => {
      it.order = idx + 1;
      it.chapter_number = startNum + idx;
    });
    setItems(newItems);
  };

  const handleTitleChange = (index: number, newTitle: string) => {
    const newItems = [...items];
    newItems[index].title = newTitle;
    setItems(newItems);
  };

  const handleConfirmAndDistill = async () => {
    if (items.length === 0) return;
    setIsDistilling(true);
    setErrorMessage(null);

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // 1. Client Vector Extraction
        setProgressState({
          current: i + 1,
          total: items.length,
          filename: item.filename,
          subStep: 1,
          subStepLabel: '1/3 Client-side 0-loss slide extraction...',
        });
        const pages = await extractPdfPagesInBrowser(item.file);

        // 2. Storage Upload
        setProgressState({
          current: i + 1,
          total: items.length,
          filename: item.filename,
          subStep: 2,
          subStepLabel: '2/3 Uploading original deck to Supabase Storage CDN...',
        });
        const storagePath = slugifyStorageKey(item.filename, courseCode, 'chapters');
        const pdfUrl = await uploadCoursePdf(item.file, storagePath);

        // 3. Meta AI Distillation
        setProgressState({
          current: i + 1,
          total: items.length,
          filename: item.filename,
          subStep: 3,
          subStepLabel: '3/3 Meta AI muse-spark-1.3 synthesis & slide citations...',
        });
        const res = await fetch('/api/studio/chapter-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId,
            chapterNumber: item.chapter_number,
            code: item.code,
            title: item.title,
            pdfUrl,
            pages,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(`Failed to distill "${item.filename}": ${errData.error || res.statusText}`);
        }
      }

      await onDistillationComplete();
      onClose();
    } catch (err: unknown) {
      console.error('[Staging Distillation Error]:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Distillation process failed');
    } finally {
      setIsDistilling(false);
      setProgressState(null);
    }
  };

  const modulesList =
    detectedModules.length > 0
      ? detectedModules
      : Array.from(new Set(items.map((i) => i.module).filter(Boolean)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-100 text-base">
                  Curriculum Pre-flight & Sequencing
                </h3>
                <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] font-mono">
                  Meta AI muse-spark-1.3
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Review the AI-proposed pedagogical progression, inspect grounded evidence, reorder with <span className="text-emerald-400">▲/▼</span>, and edit titles before launching distillation.
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            disabled={isDistilling}
            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <span className="font-bold">Error:</span> {errorMessage}
            </div>
          )}

          {/* PROPOSITION 2: EXECUTIVE CURRICULUM BRIEFING BANNER */}
          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-emerald-500/25 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white tracking-wide uppercase font-mono">
                  Meta AI Curriculum Architecture
                </span>
                <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] font-mono">
                  Grounded
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded-md bg-cyan-950/50 border border-cyan-500/30 text-cyan-300">
                  📦 {modulesList.length} Module{modulesList.length > 1 ? 's' : ''}: {modulesList.join(' ➔ ') || 'Core'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-950/50 border border-emerald-500/30 text-emerald-300">
                  🎯 Continuum: Ch. {items[0]?.chapter_number || 1}..{items[items.length - 1]?.chapter_number || items.length}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-purple-950/50 border border-purple-500/30 text-purple-300">
                  🛡️ {items.length} Collision-Proof Codes
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-850 italic">
              &ldquo;{curriculumSummary || 'Meta AI resolved relative lecture module indices into a continuous pedagogical progression, ensuring foundational concepts precede applied styling and dynamic features.'}&rdquo;
            </p>
          </div>

          {/* DISTILLATION PROGRESS WITH 3 SUB-STEPS */}
          {isDistilling && progressState && (
            <div className="p-4 bg-slate-950 border border-emerald-500/30 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-300 font-medium flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  Distilling Chapter {progressState.current} of {progressState.total}: <strong className="text-white">{progressState.filename}</strong>
                </span>
                <span className="font-mono text-emerald-400 font-bold">
                  {Math.round((progressState.current / progressState.total) * 100)}%
                </span>
              </div>

              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(progressState.current / progressState.total) * 100}%` }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] font-mono text-center pt-1">
                <div className={`p-1.5 rounded-lg border transition ${progressState.subStep === 1 ? 'bg-cyan-950/70 border-cyan-500/50 text-cyan-200 shadow-sm' : 'bg-slate-900/40 border-slate-850 text-slate-500'}`}>
                  1. Vector Extraction (0-loss)
                </div>
                <div className={`p-1.5 rounded-lg border transition ${progressState.subStep === 2 ? 'bg-cyan-950/70 border-cyan-500/50 text-cyan-200 shadow-sm' : 'bg-slate-900/40 border-slate-850 text-slate-500'}`}>
                  2. Storage CDN Upload
                </div>
                <div className={`p-1.5 rounded-lg border transition ${progressState.subStep === 3 ? 'bg-cyan-950/70 border-cyan-500/50 text-cyan-200 shadow-sm' : 'bg-slate-900/40 border-slate-850 text-slate-500'}`}>
                  3. Meta AI Synthesis & Citations
                </div>
              </div>
            </div>
          )}

          {/* CHAPTERS STAGING LIST */}
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={`${item.filename}-${idx}`}
                className="p-3 rounded-xl bg-slate-950 border border-slate-850 hover:border-slate-800 transition text-xs space-y-2"
              >
                <div className="flex items-center gap-3">
                  {/* Reorder Buttons */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={isDistilling || idx === 0}
                      onClick={() => handleMoveUp(idx)}
                      className="p-1 text-slate-400 hover:text-emerald-400 disabled:opacity-30 disabled:hover:text-slate-400 transition"
                      title="Move chapter up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isDistilling || idx === items.length - 1}
                      onClick={() => handleMoveDown(idx)}
                      className="p-1 text-slate-400 hover:text-emerald-400 disabled:opacity-30 disabled:hover:text-slate-400 transition"
                      title="Move chapter down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Chapter Number Badge */}
                  <div className="shrink-0 text-center w-12 py-1 px-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <span className="font-mono font-bold text-emerald-400 text-xs">
                      Ch. {item.chapter_number}
                    </span>
                  </div>

                  {/* Module Badge */}
                  {item.module && (
                    <Badge variant="outline" className="shrink-0 text-[10px] uppercase font-mono border-slate-700 text-cyan-300 bg-cyan-950/30">
                      {item.module}
                    </Badge>
                  )}

                  {/* Title Input & Metadata */}
                  <div className="flex-1 space-y-1 min-w-0">
                    <Input
                      type="text"
                      disabled={isDistilling}
                      value={item.title}
                      onChange={(e) => handleTitleChange(idx, e.target.value)}
                      className="h-7 text-xs bg-slate-900 border-slate-800 focus-visible:ring-emerald-500 text-slate-100 font-medium"
                      placeholder="Chapter Title"
                    />
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 truncate">
                      <span className="font-mono text-slate-400 truncate">{item.filename}</span>
                      <span>&bull;</span>
                      <span className="text-slate-400 italic truncate" title={item.reasoning}>
                        💡 {item.reasoning}
                      </span>
                    </div>
                  </div>

                  {/* Code Tag */}
                  <span className="hidden sm:inline font-mono text-[10px] text-slate-500 shrink-0">
                    {item.code}
                  </span>

                  {/* PROPOSITION 3: AI EVIDENCE TOGGLE BUTTON */}
                  <button
                    type="button"
                    onClick={() => toggleEvidence(idx)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono transition border shrink-0 ${
                      expandedEvidence[idx]
                        ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-cyan-300 hover:border-slate-700'
                    }`}
                    title="Inspect Grounding & Evidence detected by Meta AI"
                  >
                    <Search className="w-3 h-3 text-cyan-400" />
                    <span className="hidden sm:inline">{expandedEvidence[idx] ? 'Hide' : 'Evidence'}</span>
                    {expandedEvidence[idx] ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>

                  {/* Remove Button */}
                  <button
                    type="button"
                    disabled={isDistilling}
                    onClick={() => handleRemove(idx)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition rounded-lg hover:bg-rose-950/30 shrink-0"
                    title="Exclude file from batch"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* PROPOSITION 3: ACCORDION EVIDENCE PANEL */}
                {expandedEvidence[idx] && (
                  <div className="p-3 bg-slate-900/90 border border-cyan-500/30 rounded-xl space-y-2 mt-2 text-[11px] animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-mono font-bold text-cyan-400 flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Detected Slide 1 Text (Grounding):
                        </span>
                        <p className="p-2 rounded bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[10px] leading-relaxed line-clamp-3">
                          {item.source_quote || 'First slide title text extracted and validated by Meta AI.'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-mono font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          AI Action & Normalization:
                        </span>
                        <p className="p-2 rounded bg-slate-950 border border-slate-800 text-slate-300 text-[10px] leading-relaxed">
                          {item.action_taken || `Normalized relative sequence to global Chapter ${item.chapter_number} with code ${item.code}.`}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between pt-1 border-t border-slate-800 text-[10px] text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">🇬🇧 English Translation (Jury):</span>
                        <span className="font-semibold text-slate-200">{item.title_en}</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-cyan-300">
                        <span>Module:</span>
                        <span className="font-bold text-white">{item.module}</span>
                        <span>&bull;</span>
                        <span>Code:</span>
                        <span className="font-bold text-white">{item.code}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/70">
          <p className="text-xs text-slate-500 font-mono">
            {items.length} chapter(s) ready for ingestion
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isDistilling}
              onClick={onClose}
              className="text-xs h-8 border-slate-800 hover:bg-slate-800 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isDistilling || items.length === 0}
              onClick={handleConfirmAndDistill}
              className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-medium gap-1.5 shadow-lg shadow-emerald-950/40"
            >
              {isDistilling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Distilling...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Confirm & Distill {items.length} Chapter{items.length > 1 ? 's' : ''}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
