'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Trash2,
  Loader2,
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
  initialItems: StagedChapterItem[];
  onDistillationComplete: () => Promise<void>;
}

export default function ChapterStagingModal({
  isOpen,
  onClose,
  courseId,
  courseCode,
  initialItems,
  onDistillationComplete,
}: ChapterStagingModalProps) {
  const [items, setItems] = useState<StagedChapterItem[]>(initialItems);
  const [isDistilling, setIsDistilling] = useState(false);
  const [progressState, setProgressState] = useState<{
    current: number;
    total: number;
    filename: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const newItems = [...items];
    const temp = newItems[index - 1];
    newItems[index - 1] = newItems[index];
    newItems[index] = temp;

    // Recalculate chapter_number and order sequentially
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
        setProgressState({
          current: i + 1,
          total: items.length,
          filename: item.filename,
        });

        // 1. Extract full document pages
        const pages = await extractPdfPagesInBrowser(item.file);

        // 2. Upload PDF to storage with accent-free path
        const storagePath = slugifyStorageKey(item.filename, courseCode, 'chapters');
        const pdfUrl = await uploadCoursePdf(item.file, storagePath);

        // 3. Call backend chapter-analyze with teacher-validated number, code, and title
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
                Review the AI-proposed pedagogical progression, reorder with <span className="text-emerald-400">▲/▼</span>, and edit titles before launching distillation.
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

          {isDistilling && progressState && (
            <div className="p-4 bg-slate-950 border border-emerald-500/30 rounded-xl space-y-2.5">
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
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(progressState.current / progressState.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={`${item.filename}-${idx}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-850 hover:border-slate-800 transition text-xs"
              >
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
