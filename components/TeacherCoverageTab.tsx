'use client';

import React, { useState, useMemo } from 'react';
import { Course, Lab } from '@/types/socratix';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Compass,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Check,
  Terminal,
  X,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface TeacherCoverageTabProps {
  course: Course;
  labs: Lab[];
  onCourseUpdated?: () => void;
  onOpenStudioTab?: () => void;
}

interface UnanchoredLabRef {
  code: string;
  fullTitle: string;
  cleanTitle: string;
}

function cleanLabTitle(rawTitle: string, labCode?: string): string {
  if (!rawTitle) return '';
  let cleaned = rawTitle.trim();
  cleaned = cleaned.replace(/^(?:TP\s*\d+\s*[-—:]+\s*)?(?:Lab\s*\d+\s*[-—:]+\s*)?/i, '');
  if (labCode) {
    const codeRegex = new RegExp(`^${labCode}\\s*[-—:]*\\s*`, 'i');
    cleaned = cleaned.replace(codeRegex, '');
  }
  cleaned = cleaned.replace(/^[-—:]\s*/, '').trim();
  return cleaned || rawTitle;
}

export default function TeacherCoverageTab({
  course,
  labs,
  onCourseUpdated,
  onOpenStudioTab,
}: TeacherCoverageTabProps) {
  // Dialog state for unanchored lab competency actions
  const [activeUnanchoredAction, setActiveUnanchoredAction] = useState<{
    conceptCode: string;
    action: 'assign' | 'alias';
  } | null>(null);
  const [selectedChapterCode, setSelectedChapterCode] = useState<string>('');
  const [selectedCanonicalCode, setSelectedCanonicalCode] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [customSlideRef, setCustomSlideRef] = useState<string>('');
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const humanizeConceptCode = (code: string) =>
    (code || '')
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const normalizeCode = (c: string) => (c || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');

  const chaptersTaxonomy = useMemo(() => course.competency_matrix || [], [course.competency_matrix]);

  // Total syllabus concepts count
  const totalSyllabusConcepts = useMemo(() => {
    return chaptersTaxonomy.reduce((acc, ch) => acc + (ch.micro_competencies?.length || 0), 0);
  }, [chaptersTaxonomy]);

  // Memoized canonical concept resolution and coverage matrix (PERF-11)
  const { conceptToLabsMap, unanchoredConceptsMap } = useMemo(() => {
    const codeMap = new Map<string, string>();

    for (const chapter of chaptersTaxonomy) {
      for (const mc of chapter.micro_competencies || []) {
        codeMap.set(mc.code, mc.code);
        codeMap.set(normalizeCode(mc.code), mc.code);
        if (Array.isArray(mc.aliases)) {
          for (const alias of mc.aliases) {
            codeMap.set(alias, mc.code);
            codeMap.set(normalizeCode(alias), mc.code);
          }
        }
      }
    }

    const cToLabs = new Map<string, string[]>();
    const uConcepts = new Map<string, { labs: UnanchoredLabRef[] }>();

    for (const lab of labs) {
      for (const rawConcept of lab.covered_micro_concepts || []) {
        const canonicalCode = codeMap.get(rawConcept) || codeMap.get(normalizeCode(rawConcept));
        if (canonicalCode) {
          const list = cToLabs.get(canonicalCode) || [];
          if (!list.includes(lab.code)) {
            list.push(lab.code);
          }
          cToLabs.set(canonicalCode, list);
        } else {
          const entry = uConcepts.get(rawConcept) || { labs: [] };
          if (!entry.labs.some((l) => l.code === lab.code)) {
            entry.labs.push({
              code: lab.code,
              fullTitle: lab.title,
              cleanTitle: cleanLabTitle(lab.title, lab.code),
            });
          }
          uConcepts.set(rawConcept, entry);
        }
      }
    }

    return {
      conceptToLabsMap: cToLabs,
      unanchoredConceptsMap: uConcepts,
    };
  }, [chaptersTaxonomy, labs]);

  // Design-time coverage stats
  const { reinforcedCount, coveredCount, gapCount, coverageHealthScore } = useMemo(() => {
    let reinforced = 0;
    let covered = 0;
    let gap = 0;

    for (const chapter of chaptersTaxonomy) {
      for (const mc of chapter.micro_competencies || []) {
        const labCount = (conceptToLabsMap.get(mc.code) || []).length;
        if (labCount >= 2) reinforced += 1;
        else if (labCount === 1) covered += 1;
        else gap += 1;
      }
    }

    const health = totalSyllabusConcepts > 0
      ? Math.round(((reinforced + covered) / totalSyllabusConcepts) * 100)
      : 0;

    return {
      reinforcedCount: reinforced,
      coveredCount: covered,
      gapCount: gap,
      coverageHealthScore: health,
    };
  }, [chaptersTaxonomy, conceptToLabsMap, totalSyllabusConcepts]);

  const handleExecuteAction = async () => {
    if (!activeUnanchoredAction || !course.id) return;
    setIsSubmittingAction(true);
    setActionError(null);

    try {
      let bodyPayload: Record<string, unknown> = {
        courseId: course.id,
      };

      if (activeUnanchoredAction.action === 'assign') {
        if (!selectedChapterCode) {
          throw new Error('Please select a course chapter.');
        }
        bodyPayload = {
          ...bodyPayload,
          action: 'assign_to_chapter',
          conceptCode: activeUnanchoredAction.conceptCode,
          chapterCode: selectedChapterCode,
          title: customTitle.trim() || activeUnanchoredAction.conceptCode.replace(/_/g, ' '),
          slideRef: customSlideRef.trim() || 'Assigned from Lab (Practical)',
        };
      } else {
        if (!selectedCanonicalCode) {
          throw new Error('Please select an existing target concept to link as alias.');
        }
        bodyPayload = {
          ...bodyPayload,
          action: 'link_alias',
          conceptCode: activeUnanchoredAction.conceptCode,
          targetConceptCode: selectedCanonicalCode,
        };
      }

      const res = await fetch('/api/studio/courses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update competency matrix');
      }

      setActiveUnanchoredAction(null);
      setSelectedChapterCode('');
      setSelectedCanonicalCode('');
      setCustomTitle('');
      setCustomSlideRef('');
      if (onCourseUpdated) {
        onCourseUpdated();
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* 1. TOP DESIGN-TIME KPI BANNER (Curriculum Alignment Score) */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Coverage Score</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {coverageHealthScore}%
          </div>
          <div className="text-[11px] text-slate-500">
            {reinforcedCount + coveredCount}/{totalSyllabusConcepts} practiced in TP
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Reinforced (2+ TP)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{reinforcedCount}</div>
          <div className="text-[11px] text-emerald-400/80 font-medium">
            Solid practical grounding
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Covered (1 TP)</span>
            <Check className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-400 font-mono">{coveredCount}</div>
          <div className="text-[11px] text-slate-500">
            Practiced once
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Syllabus Gaps (0 TP)</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono">{gapCount}</div>
          <div className="text-[11px] text-slate-500">
            Theory without TP practice
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Lab Unanchored</span>
            <Terminal className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {unanchoredConceptsMap.size}
          </div>
          <div className="text-[11px] text-slate-500">
            TP skills not in slides
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. FULL WIDTH: CURRICULUM COVERAGE MATRIX (Course Chapters <-> Labs) */}
      {/* ==================================================================== */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">
                Curriculum Coverage Matrix (Course Syllabus &harr; TP Labs)
              </h3>
              <p className="text-xs text-slate-400">
                Cross-references theoretical lecture competencies against practical lab assignments.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <Check className="w-3.5 h-3.5" /> Reinforced (2+ TP)
            </span>
            <span className="inline-flex items-center gap-1 text-cyan-400">
              <Check className="w-3.5 h-3.5" /> Covered (1 TP)
            </span>
            <span className="inline-flex items-center gap-1 text-rose-400">
              <AlertTriangle className="w-3.5 h-3.5" /> Gap (0 TP)
            </span>
          </div>
        </div>

        {chaptersTaxonomy.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs space-y-3">
            <BookOpen className="w-8 h-8 mx-auto opacity-50" />
            <div className="space-y-1">
              <p className="font-medium text-slate-300">No chapter competencies compiled yet.</p>
              <p className="text-[11px] text-slate-600">
                Go to Course Studio and synthesize the curriculum (Step 3) to build the taxonomy matrix.
              </p>
            </div>
            {onOpenStudioTab && (
              <Button
                type="button"
                onClick={onOpenStudioTab}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs h-8 px-3 rounded-lg shadow-sm gap-1"
              >
                <span>Open Course Studio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {chaptersTaxonomy.map((chapter) => (
              <div
                key={chapter.chapter_code}
                className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px] border-emerald-500/30 text-emerald-400">
                      {chapter.chapter_code}
                    </Badge>
                    <span className="text-xs font-semibold text-slate-200">
                      {chapter.competency_title}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {chapter.micro_competencies?.length || 0} Micro-Competencies
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {(chapter.micro_competencies || []).map((micro) => {
                    const coveredInLabs = conceptToLabsMap.get(micro.code) || [];
                    const labCount = coveredInLabs.length;

                    let statusBadge = (
                      <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 text-[10px] gap-1">
                        <AlertTriangle className="w-3 h-3" /> Gap (0 TP)
                      </Badge>
                    );

                    if (labCount >= 2) {
                      statusBadge = (
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Reinforced ({labCount} TP)
                        </Badge>
                      );
                    } else if (labCount === 1) {
                      statusBadge = (
                        <Badge className="bg-cyan-500/15 text-cyan-300 border-cyan-500/30 text-[10px] gap-1">
                          <Check className="w-3 h-3" /> Covered ({coveredInLabs[0]})
                        </Badge>
                      );
                    }

                    return (
                      <div
                        key={micro.code}
                        className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-mono text-[11px] text-slate-200 font-medium">
                            {micro.code}
                          </span>
                          {statusBadge}
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-snug" title={micro.title}>
                          {micro.title}
                        </p>
                        {micro.aliases && micro.aliases.length > 0 && (
                          <div className="text-[10px] text-cyan-400/80 font-mono truncate">
                            Aliases: {micro.aliases.join(', ')}
                          </div>
                        )}
                        {micro.slide_ref && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Ref: {micro.slide_ref}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ==================================================================== */}
        {/* 3. UNANCHORED / LAB-SPECIFIC COMPETENCIES (TP -> Course Feedback) */}
        {/* ==================================================================== */}
        {unanchoredConceptsMap.size > 0 && (
          <div className="p-4 bg-slate-950/80 border border-amber-500/30 rounded-xl space-y-3 mt-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                  <Terminal className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="text-xs font-semibold text-amber-300 flex items-center gap-2">
                    <span>⚡ Practical / Lab-Specific Competencies</span>
                    <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-[10px] font-mono">
                      {unanchoredConceptsMap.size} Unanchored in Syllabus
                    </Badge>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Assessed in practical TP labs but not indexed in theoretical chapter slides. Keep as lab-only or assign/link them.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {Array.from(unanchoredConceptsMap.entries()).map(([conceptCode, data]) => (
                <div
                  key={conceptCode}
                  className="p-3 bg-slate-900/90 border border-slate-800 rounded-lg space-y-2.5 flex flex-col justify-between hover:border-slate-750 transition"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className="font-mono text-[11px] font-semibold text-slate-200 truncate"
                        title={conceptCode}
                      >
                        {conceptCode}
                      </span>
                      <Badge
                        variant="outline"
                        className="bg-amber-500/15 text-amber-300 border-amber-500/40 text-[9px] font-medium gap-1 shrink-0"
                      >
                        <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                        Not in syllabus
                      </Badge>
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                      <span className="text-slate-400 font-semibold">Exercised in:</span>
                      <span className="font-mono text-amber-300 font-semibold">
                        {data.labs.map((l) => l.code).join(', ')}
                      </span>
                    </div>

                    {data.labs.length === 1 ? (
                      <p
                        className="text-[11px] text-slate-300 leading-snug line-clamp-2"
                        title={`${data.labs[0].code} — ${data.labs[0].fullTitle}`}
                      >
                        <span className="text-slate-500 font-normal">Lab: </span>
                        <span className="font-medium text-slate-200">{data.labs[0].cleanTitle}</span>
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <span className="text-slate-500 text-[10px] font-normal block">
                          Practiced in {data.labs.length} labs:
                        </span>
                        <div className="space-y-0.5">
                          {data.labs.map((lb) => (
                            <div
                              key={lb.code}
                              className="flex items-center gap-1.5 text-[10px] text-slate-300"
                              title={`${lb.code} — ${lb.fullTitle}`}
                            >
                              <span className="px-1 py-0.2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono text-[9px] shrink-0 font-semibold">
                                {lb.code}
                              </span>
                              <span className="truncate text-slate-200">{lb.cleanTitle}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActiveUnanchoredAction({ conceptCode, action: 'assign' });
                        setSelectedChapterCode(chaptersTaxonomy[0]?.chapter_code || '');
                        setCustomTitle(humanizeConceptCode(conceptCode));
                        setCustomSlideRef('Assigned from Lab (Practical)');
                        setActionError(null);
                      }}
                      className="h-6 text-[10px] px-2 border-slate-700 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/50 flex-1"
                    >
                      ➕ Assign to Chapter...
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActiveUnanchoredAction({ conceptCode, action: 'alias' });
                        const firstCat = chaptersTaxonomy[0]?.micro_competencies?.[0]?.code || '';
                        setSelectedCanonicalCode(firstCat);
                        setActionError(null);
                      }}
                      className="h-6 text-[10px] px-2 border-slate-700 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50 flex-1"
                    >
                      🔗 Link as Alias...
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal for Unanchored Action (Assign or Link Alias) */}
        {activeUnanchoredAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 space-y-4 text-slate-100">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  {activeUnanchoredAction.action === 'assign' ? '➕ Assign Concept to Chapter' : '🔗 Link Concept as Alias'}
                </h3>
                <button
                  onClick={() => setActiveUnanchoredAction(null)}
                  className="text-slate-400 hover:text-slate-200 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-300 space-y-1.5">
                <div>Concept: <span className="font-mono text-emerald-400 font-semibold">{activeUnanchoredAction.conceptCode}</span></div>
                {(() => {
                  const labRefs = unanchoredConceptsMap.get(activeUnanchoredAction.conceptCode)?.labs || [];
                  if (labRefs.length === 0) return null;
                  return (
                    <div className="text-[11px] text-slate-400">
                      Origin: <span className="text-slate-200 font-medium">{labRefs.map((l) => `${l.code} (${l.cleanTitle})`).join(', ')}</span>
                    </div>
                  );
                })()}
                <div className="text-slate-400 text-[11px]">
                  {activeUnanchoredAction.action === 'assign'
                    ? 'Attach this lab competency to a course chapter so it appears in the theoretical syllabus.'
                    : 'Map this lab concept as an alternative name/synonym of an existing course competency.'}
                </div>
              </div>

              {actionError && (
                <div className="p-2.5 rounded bg-rose-950/50 border border-rose-500/50 text-rose-300 text-xs">
                  {actionError}
                </div>
              )}

              {activeUnanchoredAction.action === 'assign' ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] uppercase font-semibold text-slate-400 block mb-1">
                      Target Chapter
                    </label>
                    <select
                      value={selectedChapterCode}
                      onChange={(e) => setSelectedChapterCode(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                    >
                      {chaptersTaxonomy.map((ch) => (
                        <option key={ch.chapter_code} value={ch.chapter_code}>
                          {ch.chapter_code}: {ch.competency_title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] uppercase font-semibold text-slate-400 block mb-1">
                      Competency Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Conditional branching with if/else"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] uppercase font-semibold text-slate-400 block mb-1">
                      Slide Reference (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ch.2 Slide 15 or Practical Lab"
                      value={customSlideRef}
                      onChange={(e) => setCustomSlideRef(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] uppercase font-semibold text-slate-400 block mb-1">
                      Existing Target Concept
                    </label>
                    <select
                      value={selectedCanonicalCode}
                      onChange={(e) => setSelectedCanonicalCode(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                    >
                      {chaptersTaxonomy.map((ch) => (
                        <optgroup key={ch.chapter_code} label={`${ch.chapter_code}: ${ch.competency_title}`}>
                          {(ch.micro_competencies || []).map((mc) => (
                            <option key={mc.code} value={mc.code}>
                              {mc.code} — {mc.title}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveUnanchoredAction(null)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isSubmittingAction}
                  onClick={handleExecuteAction}
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs shadow-md"
                >
                  {isSubmittingAction
                    ? 'Saving...'
                    : activeUnanchoredAction.action === 'assign'
                    ? 'Save & Attach to Chapter'
                    : 'Confirm Alias Link'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

