'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { StructuredCourseReference } from '@/types/socratix';
import { ExternalLink, X, BookOpen, Sparkles, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getSlideCleanMarkdown } from '@/lib/pdf-cleaner';

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

  if (!isOpen || !reference) return null;

  const cleanEnText = getSlideCleanMarkdown(reference, 'en');
  const cleanFrText = getSlideCleanMarkdown(reference, 'fr');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl h-[88vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-100 text-base">
                  {reference.label || `Slide #${reference.page_number}`}
                </h3>
                <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-xs">
                  Slide {reference.page_number}
                </Badge>
              </div>
              <p className="text-xs text-slate-400">
                {courseTitle} &bull; Chapter {reference.chapter_code}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {reference.pdf_url && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-slate-700 hover:bg-slate-800 text-slate-300 gap-1.5"
                onClick={() => window.open(`${reference.pdf_url}#page=${reference.page_number}`, '_blank')}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open PDF
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Modal Body: 2 Columns (65% Slide View + 35% Cross-Lingual Note) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-0 overflow-hidden">
          {/* Left Column: Multi-View Slide (Clean English | Official PDF | Clean French) */}
          <div className="md:col-span-8 p-4 bg-slate-950/80 flex flex-col h-full overflow-hidden">
            {/* View Switcher Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 mb-3 shrink-0">
              <button
                type="button"
                onClick={() => setSlideViewMode('clean_en')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  slideViewMode === 'clean_en'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="View clean English markdown translation (Jury recommended)"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>✨ Clean English Slide</span>
                <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Jury
                </span>
              </button>

              {reference.pdf_url && (
                <button
                  type="button"
                  onClick={() => setSlideViewMode('pdf')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    slideViewMode === 'pdf'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="View original official PDF slide"
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>📄 Official PDF (French)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setSlideViewMode('clean_fr')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  slideViewMode === 'clean_fr'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
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
                  className="w-full h-full rounded-xl border border-slate-800 bg-white shadow-inner"
                  title={`Slide ${reference.page_number}`}
                />
              ) : (
                <div className="w-full h-full bg-slate-900 border border-slate-800 rounded-xl p-6 overflow-y-auto shadow-inner">
                  <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed space-y-3 [&_h3]:text-emerald-400 [&_h3]:text-base [&_h3]:font-bold [&_h4]:text-slate-100 [&_h4]:text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:bg-slate-950 [&_code]:text-emerald-300 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_pre]:bg-slate-950 [&_pre]:border [&_pre]:border-slate-800 [&_pre]:p-3 [&_blockquote]:border-l-2 [&_blockquote]:border-emerald-500/50 [&_blockquote]:bg-emerald-950/20 [&_blockquote]:p-3 [&_blockquote]:rounded-r-lg [&_strong]:text-emerald-200">
                    <ReactMarkdown>
                      {slideViewMode === 'clean_en' ? cleanEnText : cleanFrText}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: AI Cross-Lingual Pedagogical Note */}
          <div className="md:col-span-4 p-5 bg-slate-900 border-l border-slate-800 overflow-y-auto flex flex-col gap-4">
            <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                <Sparkles className="w-4 h-4" />
                AI Cross-Lingual Pedagogical Note
              </div>
              <p className="text-sm text-slate-300 leading-relaxed font-sans">
                {reference.en_note ||
                  'This slide presents the core concept and architectural invariant relevant to your current implementation hurdle.'}
              </p>
            </div>

            <div className="p-4 bg-slate-950/40 border border-slate-800/60 rounded-xl space-y-2">
              <div className="text-xs font-medium text-slate-400">Why Socratix Cited This Slide</div>
              <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                <li>Grounds the Socratic dialogue directly in the official syllabus.</li>
                <li>Connects real code errors to lecture analogies (e.g. Invariant safety).</li>
                <li>Allows non-native or bilingual students to verify concepts without spoilers.</li>
              </ul>
            </div>

            <div className="mt-auto pt-2">
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-lg flex items-center justify-between text-xs text-emerald-400">
                <span>Direct Socratic Link</span>
                <span className="font-mono font-semibold">Page #{reference.page_number}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
