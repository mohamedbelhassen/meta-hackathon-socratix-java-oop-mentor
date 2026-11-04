'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { StructuredCourseReference } from '@/types/socratix';
import { ExternalLink, X, BookOpen, Sparkles, FileText, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getSlideCleanMarkdown, extractSlideTitle } from '@/lib/pdf-cleaner';

interface SmartSlideViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  reference: StructuredCourseReference | null;
  courseTitle: string;
}

export default function SmartSlideViewerModal({
  isOpen,
  onClose,
  reference,
  courseTitle,
}: SmartSlideViewerModalProps) {
  const [slideViewMode, setSlideViewMode] = useState<'clean_en' | 'pdf' | 'clean_fr'>('clean_en');
  const [jitTranslation, setJitTranslation] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  const cleanEnText = reference ? getSlideCleanMarkdown(reference, 'en') : '';
  const cleanFrText = reference ? getSlideCleanMarkdown(reference, 'fr') : '';

  // Reset local JIT translation cache when changing slides
  useEffect(() => {
    setJitTranslation(null);
    setIsTranslating(false);
    setTranslationError(null);
  }, [reference?.chapter_code, reference?.page_number]);

  const hasNativeEn = Boolean(
    reference?.slide_markdown?.en && reference.slide_markdown.en.trim().length > 0
  );

  const triggerTranslation = useCallback(async () => {
    if (!reference || isTranslating) return;
    setIsTranslating(true);
    setTranslationError(null);
    try {
      const res = await fetch('/api/studio/translate-slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterCode: reference.chapter_code,
          pageNumber: reference.page_number,
          frContent: cleanFrText,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to translate slide');
      }
      const data = await res.json();
      if (data.en_markdown) {
        setJitTranslation(data.en_markdown);
      }
    } catch (err: unknown) {
      console.warn('[SmartSlideViewerModal] JIT Translation failed:', err);
      setTranslationError(err instanceof Error ? err.message : 'Translation error');
    } finally {
      setIsTranslating(false);
    }
  }, [reference, isTranslating, cleanFrText]);

  // Automatic JIT translation when viewing clean English tab and no native translation exists
  useEffect(() => {
    if (
      isOpen &&
      reference &&
      slideViewMode === 'clean_en' &&
      !hasNativeEn &&
      !jitTranslation &&
      !isTranslating &&
      !translationError
    ) {
      triggerTranslation();
    }
  }, [
    isOpen,
    reference,
    slideViewMode,
    hasNativeEn,
    jitTranslation,
    isTranslating,
    translationError,
    triggerTranslation,
  ]);

  if (!isOpen || !reference) return null;

  const effectiveEnText = jitTranslation || (hasNativeEn ? cleanEnText : null);

  // Synchronize modal header title with active slide tab (clean_en vs clean_fr)
  const activeCleanText = slideViewMode === 'clean_en' ? (effectiveEnText || cleanEnText) : cleanFrText;
  const activeCanonicalTitle =
    extractSlideTitle(activeCleanText) ||
    extractSlideTitle(cleanFrText) ||
    extractSlideTitle(cleanEnText);

  // Preserve or extract chapter prefix (e.g. "Chapter 5 (Slide 51)")
  const prefixMatch = reference.label?.match(/^(Chapter\s+\w+(?:\s*\([^)]*\))?)\s*:/i);
  const chapterPrefix = prefixMatch
    ? prefixMatch[1]
    : `Chapter ${reference.chapter_code} (Slide ${reference.page_number})`;

  const synchronizedHeaderTitle = activeCanonicalTitle
    ? `${chapterPrefix}: ${activeCanonicalTitle}`
    : (reference.label || `Slide #${reference.page_number}`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl h-[88vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-[#059669] dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/20 shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  {synchronizedHeaderTitle}
                </h3>
                <Badge className="bg-emerald-50 dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 text-xs font-semibold">
                  Slide {reference.page_number}
                </Badge>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {courseTitle} &bull; Chapter {reference.chapter_code}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {reference.pdf_url && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 gap-1.5 font-semibold shadow-xs"
                onClick={() => window.open(`${reference.pdf_url}#page=${reference.page_number}`, '_blank')}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open PDF
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Modal Body: 2 Columns (65% Slide View + 35% Cross-Lingual Note) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-0 overflow-hidden">
          {/* Left Column: Multi-View Slide (Clean English | Official PDF | Clean French) */}
          <div className="md:col-span-8 p-4 bg-slate-50/50 dark:bg-slate-950/80 flex flex-col h-full overflow-hidden">
            {/* View Switcher Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200 dark:border-slate-800 mb-3 shrink-0 shadow-xs">
              <button
                type="button"
                onClick={() => setSlideViewMode('clean_en')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  slideViewMode === 'clean_en'
                    ? 'bg-white dark:bg-emerald-500/20 text-[#059669] dark:text-emerald-300 border border-slate-300 dark:border-emerald-500/40 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
                title="View clean English markdown translation (Jury recommended)"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400" />
                <span>✨ Clean English Slide</span>
                <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-emerald-50 dark:bg-emerald-500/20 text-[#059669] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 font-bold">
                  Jury
                </span>
              </button>

              {reference.pdf_url && (
                <button
                  type="button"
                  onClick={() => setSlideViewMode('pdf')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    slideViewMode === 'pdf'
                      ? 'bg-white dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-slate-300 dark:border-cyan-500/40 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                  title="View original official PDF slide"
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>📄 Official PDF (French)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setSlideViewMode('clean_fr')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  slideViewMode === 'clean_fr'
                    ? 'bg-white dark:bg-emerald-500/20 text-[#059669] dark:text-emerald-300 border border-slate-300 dark:border-emerald-500/40 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
                title="View clean French markdown without page boilerplate"
              >
                <span>🇫🇷 Clean French Slide</span>
              </button>
            </div>

            {/* Slide Content Display Area */}
            <div className="flex-1 overflow-hidden relative">
              {slideViewMode === 'pdf' && reference.pdf_url ? (
                <iframe
                  key={`${reference.pdf_url}#page=${reference.page_number}`}
                  src={`${reference.pdf_url}#page=${reference.page_number}&view=FitH`}
                  className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white shadow-inner"
                  title={`Slide ${reference.page_number}`}
                />
              ) : slideViewMode === 'clean_en' && isTranslating ? (
                <div className="w-full h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center space-y-4 shadow-inner">
                  <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/20 text-[#059669] dark:text-emerald-400 shadow-xs">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                  <div className="text-center space-y-1">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center justify-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#059669] dark:text-emerald-400" />
                      Generating Clean English Translation...
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm">
                      Meta AI (muse-spark-1.3) is translating this slide in real time, preserving all code tags, CSS rules and architectural invariants.
                    </p>
                  </div>
                  <div className="text-[10px] text-[#059669] dark:text-emerald-400/80 font-mono flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-500/30 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#059669] dark:bg-emerald-400 animate-ping" />
                    <span>Just-In-Time Curriculum Synthesis</span>
                  </div>
                </div>
              ) : slideViewMode === 'clean_en' && translationError && !effectiveEnText ? (
                <div className="w-full h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 overflow-y-auto shadow-inner space-y-4">
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between font-medium">
                    <span>Clean English translation encountered a momentary error: {translationError}</span>
                    <Button
                      size="sm"
                      onClick={triggerTranslation}
                      className="bg-amber-600 hover:bg-amber-500 text-white text-xs gap-1.5 h-7 px-2.5 ml-2 shrink-0 font-semibold"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Retry Translation
                    </Button>
                  </div>
                  <div className="prose prose-slate dark:prose-invert prose-sm max-w-none text-slate-800 dark:text-slate-200 leading-relaxed space-y-3 [&_h3]:text-[#059669] dark:[&_h3]:text-emerald-400 [&_h3]:text-base [&_h3]:font-bold [&_h4]:text-slate-900 dark:[&_h4]:text-slate-100 [&_h4]:text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_:not(pre)>code]:bg-slate-100 dark:[&_:not(pre)>code]:bg-slate-950 [&_:not(pre)>code]:text-[#059669] dark:[&_:not(pre)>code]:text-emerald-300 [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-xs [&_:not(pre)>code]:border [&_:not(pre)>code]:border-slate-200 dark:[&_:not(pre)>code]:border-slate-800 [&_pre]:bg-slate-50 dark:[&_pre]:bg-slate-950 [&_pre]:border [&_pre]:border-slate-200 dark:[&_pre]:border-slate-800 [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:shadow-xs [&_pre]:text-slate-800 dark:[&_pre]:text-slate-200 [&_pre_code]:bg-transparent dark:[&_pre_code]:bg-transparent [&_pre_code]:text-inherit [&_pre_code]:p-0 [&_pre_code]:border-0 [&_blockquote]:border-l-2 [&_blockquote]:border-emerald-500/50 [&_blockquote]:bg-emerald-50 dark:[&_blockquote]:bg-emerald-950/20 [&_blockquote]:p-3 [&_blockquote]:rounded-r-lg [&_strong]:text-[#059669] dark:[&_strong]:text-emerald-200">
                    <ReactMarkdown>{cleanFrText}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 overflow-y-auto shadow-inner">
                  {slideViewMode === 'clean_en' && jitTranslation && (
                    <div className="mb-3 flex items-center gap-1.5 text-[10px] text-[#059669] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/30 px-2.5 py-1 rounded-lg w-fit font-mono font-semibold">
                      <Sparkles className="w-3 h-3 text-[#059669] dark:text-emerald-400" />
                      <span>Translated Just-In-Time by Meta AI (Saved to Syllabus Cache)</span>
                    </div>
                  )}
                  <div className="prose prose-slate dark:prose-invert prose-sm max-w-none text-slate-800 dark:text-slate-200 leading-relaxed space-y-3 [&_h3]:text-[#059669] dark:[&_h3]:text-emerald-400 [&_h3]:text-base [&_h3]:font-bold [&_h4]:text-slate-900 dark:[&_h4]:text-slate-100 [&_h4]:text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_:not(pre)>code]:bg-slate-100 dark:[&_:not(pre)>code]:bg-slate-950 [&_:not(pre)>code]:text-[#059669] dark:[&_:not(pre)>code]:text-emerald-300 [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-xs [&_:not(pre)>code]:border [&_:not(pre)>code]:border-slate-200 dark:[&_:not(pre)>code]:border-slate-800 [&_pre]:bg-slate-50 dark:[&_pre]:bg-slate-950 [&_pre]:border [&_pre]:border-slate-200 dark:[&_pre]:border-slate-800 [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:shadow-xs [&_pre]:text-slate-800 dark:[&_pre]:text-slate-200 [&_pre_code]:bg-transparent dark:[&_pre_code]:bg-transparent [&_pre_code]:text-inherit [&_pre_code]:p-0 [&_pre_code]:border-0 [&_blockquote]:border-l-2 [&_blockquote]:border-emerald-500/50 [&_blockquote]:bg-emerald-50 dark:[&_blockquote]:bg-emerald-950/20 [&_blockquote]:p-3 [&_blockquote]:rounded-r-lg [&_strong]:text-[#059669] dark:[&_strong]:text-emerald-200">
                    <ReactMarkdown>
                      {slideViewMode === 'clean_en' ? (effectiveEnText || cleanEnText) : cleanFrText}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: AI Cross-Lingual Pedagogical Note */}
          <div className="md:col-span-4 p-5 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 overflow-y-auto flex flex-col gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#059669] dark:text-emerald-400">
                <Sparkles className="w-4 h-4" />
                AI Cross-Lingual Pedagogical Note
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans font-medium">
                {reference.en_note ||
                  'This slide presents the core concept and architectural invariant relevant to your current implementation hurdle.'}
              </p>
            </div>

            <div className="p-4 bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/60 rounded-xl space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-400">Why Socratix Cited This Slide</div>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 list-disc list-inside font-medium">
                <li>Grounds the Socratic dialogue directly in the official syllabus.</li>
                <li>Connects real code errors to lecture analogies (e.g. Invariant safety).</li>
                <li>Allows non-native or bilingual students to verify concepts without spoilers.</li>
              </ul>
            </div>

            <div className="mt-auto pt-2">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-300 dark:border-emerald-500/15 rounded-lg flex items-center justify-between text-xs text-[#059669] dark:text-emerald-400 shadow-xs font-semibold">
                <span>Direct Socratic Link</span>
                <span className="font-mono font-bold">Page #{reference.page_number}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
