'use client';

import React, { useState } from 'react';
import { Course, CourseChapter } from '@/types/socratix';
import {
  Sparkles,
  X,
  BookOpen,
  CheckCircle2,
  FileText,
  Code2,
  ArrowRight,
  Layers,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface CourseCompilationSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course & { course_chapters?: CourseChapter[] };
  onProceedToLabs?: () => void;
}

export default function CourseCompilationSummaryModal({
  isOpen,
  onClose,
  course,
  onProceedToLabs,
}: CourseCompilationSummaryModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'prompt' | 'kb'>('overview');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !course) return null;

  const totalMicroCompetencies = Array.isArray(course.competency_matrix)
    ? course.competency_matrix.reduce(
        (acc, cat) => acc + (cat.micro_competencies?.length || 0),
        0
      )
    : 0;

  const chaptersCount = course.course_chapters?.length || (Array.isArray(course.competency_matrix) ? course.competency_matrix.length : 0);
  const promptTokensEstimate = Math.round((course.compiled_tutor_prompt?.length || 0) / 4);
  const kbTokensEstimate = Math.round((course.compiled_knowledge_base?.length || 0) / 4);

  const handleCopyPrompt = () => {
    if (!course.compiled_tutor_prompt) return;
    navigator.clipboard.writeText(course.compiled_tutor_prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  Curriculum Synthesized & AI Mentor Ready
                </h2>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[11px] font-mono">
                  {course.code}
                </Badge>
              </div>
              <p className="text-xs text-slate-400">
                Meta AI <span className="font-mono text-emerald-400">muse-spark-1.3</span> distilled your lecture slides into a canonical taxonomy and custom Socratic mentor prompt.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4-KPI SUMMARY BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-slate-950/40 border-b border-slate-800 text-xs">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-mono text-slate-400">Lecture Chapters</span>
            <div className="text-xl font-extrabold text-white mt-0.5">{chaptersCount}</div>
            <span className="text-[10px] text-slate-500">PDFs processed</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-mono text-emerald-400">Canonical Taxonomy</span>
            <div className="text-xl font-extrabold text-emerald-400 mt-0.5">{totalMicroCompetencies}</div>
            <span className="text-[10px] text-slate-500">Deduplicated concepts</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-mono text-cyan-400">Tutor System Prompt</span>
            <div className="text-xl font-extrabold text-cyan-300 mt-0.5">~{promptTokensEstimate} tok</div>
            <span className="text-[10px] text-slate-500">{course.compiled_tutor_prompt?.length || 0} characters</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-mono text-amber-400">Curriculum KB</span>
            <div className="text-xl font-extrabold text-amber-300 mt-0.5">~{kbTokensEstimate} tok</div>
            <span className="text-[10px] text-slate-500">Unified slide summaries</span>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-slate-900">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>AI Curriculum Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('prompt')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'prompt'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Generated Mentor System Prompt</span>
          </button>

          <button
            onClick={() => setActiveTab('kb')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'kb'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Compiled Knowledge Base</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-200 text-xs">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 3 PILLARS CARDS FOR JURY */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    1
                  </div>
                  <h3 className="font-bold text-white text-sm">Deduplicated Taxonomy</h3>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Scanned across all lecture chapters to eliminate overlapping definitions. Every concept has a unique canonical <code className="text-emerald-400 font-mono">SCREAMING_SNAKE_CASE</code> key linked to its primary slide.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                    2
                  </div>
                  <h3 className="font-bold text-white text-sm">Pedagogical Slide Anchors</h3>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Extracted the professor's signature analogies (e.g. <em>Four Slide 42</em>, <em>Félin Slide 8</em>). The Socratic AI redirects students to these exact slide numbers instead of hallucinating foreign examples.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    3
                  </div>
                  <h3 className="font-bold text-white text-sm">Course-Specific Few-Shots</h3>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Generated 2 few-shot reasoning exemplars tailored to {course.title}, priming Meta AI to maintain an inquisitive Socratic posture without giving away code answers.
                  </p>
                </div>
              </div>

              {/* CANONICAL TAXONOMY LIST */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>Canonical Competency Matrix by Chapter</span>
                  </h3>
                  <Badge variant="outline" className="font-mono text-[10px] text-slate-400 border-slate-800">
                    {course.competency_matrix?.length || 0} Categories
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {course.competency_matrix?.map((tax, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-emerald-400 font-bold text-[11px]">
                          {tax.chapter_code}
                        </span>
                        <span className="text-white font-medium text-xs">{tax.competency_title}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {tax.micro_competencies?.map((mc, mIdx) => (
                          <span
                            key={mIdx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-mono"
                            title={mc.title}
                          >
                            <span className="text-emerald-400 font-bold">{mc.code}</span>
                            {mc.slide_ref && (
                              <span className="text-slate-500">({mc.slide_ref})</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'prompt' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">
                  This custom prompt is injected by <code className="text-emerald-400">/api/tutor</code> and cached via Meta AI Ephemeral Prompt Caching.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyPrompt}
                  className="text-xs h-7 bg-slate-950 border-slate-800 text-slate-300 hover:text-white"
                >
                  {copied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copied ? 'Copied' : 'Copy Prompt'}
                </Button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-850 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto">
                {course.compiled_tutor_prompt || '// No tutor prompt compiled yet.'}
              </pre>
            </div>
          )}

          {activeTab === 'kb' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-slate-400">
                <span>
                  Unified curriculum reference synthesized from all {chaptersCount} chapters (~{kbTokensEstimate} tokens).
                </span>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-850 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto">
                {course.compiled_knowledge_base || '// No compiled knowledge base yet.'}
              </pre>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
          >
            Close Overview
          </Button>

          {onProceedToLabs && (
            <Button
              onClick={() => {
                onClose();
                onProceedToLabs();
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/50"
            >
              <span>Next Step: Ingest & Decompose Labs (TP)</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

