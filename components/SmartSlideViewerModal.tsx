'use client';

import React from 'react';
import { StructuredCourseReference } from '@/types/socratix';
import { ExternalLink, X, BookOpen, Sparkles, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
  if (!isOpen || !reference) return null;

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

        {/* Modal Body: 2 Columns (65% PDF Slide + 35% Cross-Lingual Note) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-0 overflow-hidden">
          {/* Left Column: Embedded Slide (Page X) */}
          <div className="md:col-span-8 p-4 bg-slate-950/80 flex flex-col h-full overflow-hidden">
            {reference.pdf_url ? (
              <iframe
                key={`${reference.pdf_url}#page=${reference.page_number}`}
                src={`${reference.pdf_url}#page=${reference.page_number}&view=FitH`}
                className="w-full h-full rounded-xl border border-slate-800 bg-white shadow-inner"
                title={`Slide ${reference.page_number}`}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 rounded-xl text-slate-500">
                <FileText className="w-12 h-12 mb-3 text-slate-600" />
                <p className="font-medium text-slate-300 mb-1">Slide PDF Not Attached</p>
                <p className="text-xs max-w-md">
                  This chapter was compiled from curriculum notes. Reference: Chapter {reference.chapter_code}, Slide {reference.page_number}.
                </p>
              </div>
            )}
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
