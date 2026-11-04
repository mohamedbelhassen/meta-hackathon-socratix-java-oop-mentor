'use client';

import React, { useState } from 'react';
import { BookOpen, FileText, ExternalLink, X, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Course, CourseChapter, Lab } from '@/types/socratix';
import { getLocalizedLabTitle } from '@/lib/bilingual-helper';

interface CourseSyllabusModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course | null;
  chapters: CourseChapter[];
  labs: Lab[];
  onOpenPdf: (pdfUrl: string, title: string) => void;
}

export default function CourseSyllabusModal({
  isOpen,
  onClose,
  course,
  chapters,
  labs,
  onOpenPdf,
}: CourseSyllabusModalProps) {
  const [activeTab, setActiveTab] = useState<'chapters' | 'labs'>('chapters');

  if (!isOpen || !course) return null;

  const sortedChapters = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);
  const sortedLabs = [...labs].sort((a, b) => a.lab_number - b.lab_number);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[88vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-[#059669] dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/20 shrink-0 shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  {course.title}
                </h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 font-semibold">
                  {course.code}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Official Syllabus & Curriculum Documents &bull; In-Situ Library
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg"
            onClick={onClose}
            title="Close syllabus"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-950/40 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('chapters')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'chapters'
                ? 'bg-white dark:bg-emerald-500/20 text-[#059669] dark:text-emerald-300 border border-slate-300 dark:border-emerald-500/40 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400" />
            <span>Lecture Chapters</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-500/20 text-[#059669] dark:text-emerald-300 font-bold">
              {sortedChapters.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('labs')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'labs'
                ? 'bg-white dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-slate-300 dark:border-cyan-500/40 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>Lab Assignments (TP)</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-50 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 font-bold">
              {sortedLabs.length}
            </span>
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
          {activeTab === 'chapters' ? (
            sortedChapters.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No lecture chapters imported yet for this course.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {sortedChapters.map((ch) => {
                  const pagesCount = ch.pages_json?.length || 0;
                  return (
                    <div
                      key={ch.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/90 hover:border-emerald-400 dark:hover:border-emerald-500/30 transition shadow-xs group"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-4">
                        <span className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/20 text-[#059669] dark:text-emerald-400 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                          {ch.chapter_number}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-200 truncate group-hover:text-[#059669] dark:group-hover:text-emerald-300 transition">
                            {ch.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                            <span>{ch.code}</span>
                            {pagesCount > 0 && (
                              <>
                                <span>&bull;</span>
                                <span>{pagesCount} slide{pagesCount > 1 ? 's' : ''}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {ch.pdf_url ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => {
                                onOpenPdf(ch.pdf_url!, `Chapter ${ch.chapter_number}: ${ch.title}`);
                              }}
                              className="h-7 text-xs bg-[#059669] hover:bg-[#047857] text-white font-medium gap-1 px-2.5 shadow-sm"
                            >
                              <FileText className="w-3 h-3" />
                              <span>View PDF</span>
                            </Button>
                            <a
                              href={ch.pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
                              title="Open PDF in new tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">No PDF attached</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            sortedLabs.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No lab assignments created yet for this course.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {sortedLabs.map((lb) => {
                  const actCount = lb.activities?.length || 0;
                  return (
                    <div
                      key={lb.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/90 hover:border-cyan-400 dark:hover:border-cyan-500/30 transition shadow-xs group"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-4">
                        <span className="w-7 h-7 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-300 dark:border-cyan-500/20 text-cyan-800 dark:text-cyan-400 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                          {lb.code || `TP${lb.lab_number}`}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-200 truncate group-hover:text-cyan-800 dark:group-hover:text-cyan-300 transition">
                            {getLocalizedLabTitle(lb, 'en')}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                            <span>Lab #{lb.lab_number}</span>
                            {actCount > 0 && (
                              <>
                                <span>&bull;</span>
                                <span>{actCount} exercise{actCount > 1 ? 's' : ''} / activit{actCount > 1 ? 'ies' : 'y'}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {lb.pdf_url ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => {
                                onOpenPdf(lb.pdf_url!, `${lb.code || `TP ${lb.lab_number}`}: ${lb.title}`);
                              }}
                              className="h-7 text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-medium gap-1 px-2.5 shadow-sm"
                            >
                              <FileText className="w-3 h-3" />
                              <span>View Subject</span>
                            </Button>
                            <a
                              href={lb.pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
                              title="Open PDF in new tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">No PDF attached</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
