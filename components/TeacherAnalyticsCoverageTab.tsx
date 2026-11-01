'use client';

import React, { useState } from 'react';
import { Course, Lab, StudentLabSession } from '@/types/socratix';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  Layers,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Check,
  Compass,
  Terminal,
  X,
} from 'lucide-react';

interface TeacherAnalyticsCoverageTabProps {
  course: Course;
  labs: Lab[];
  selectedLab: Lab | null;
  sessions: StudentLabSession[];
  onCourseUpdated?: () => void;
}

export default function TeacherAnalyticsCoverageTab({
  course,
  labs,
  selectedLab,
  sessions,
  onCourseUpdated,
}: TeacherAnalyticsCoverageTabProps) {
  const labSessions = sessions.filter((s) => s.lab_id === selectedLab?.id);
  const totalStudents = labSessions.length;

  // Dialog state for unanchored lab competency actions
  const [activeUnanchoredAction, setActiveUnanchoredAction] = useState<{
    conceptCode: string;
    action: 'assign' | 'alias';
  } | null>(null);
  const [selectedChapterCode, setSelectedChapterCode] = useState<string>('');
  const [selectedCanonicalCode, setSelectedCanonicalCode] = useState<string>('');
  const [customSlideRef, setCustomSlideRef] = useState<string>('');
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const normalizeCode = (c: string) => (c || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');

  const chaptersTaxonomy = course.competency_matrix || [];

  // Inverted index for canonical concept resolution: code or alias -> canonical code
  const codeToCanonicalMap = new Map<string, string>();
  const allCanonicalCodes = new Set<string>();

  for (const chapter of chaptersTaxonomy) {
    for (const mc of chapter.micro_competencies || []) {
      allCanonicalCodes.add(mc.code);
      codeToCanonicalMap.set(mc.code, mc.code);
      codeToCanonicalMap.set(normalizeCode(mc.code), mc.code);
      if (Array.isArray(mc.aliases)) {
        for (const alias of mc.aliases) {
          codeToCanonicalMap.set(alias, mc.code);
          codeToCanonicalMap.set(normalizeCode(alias), mc.code);
        }
      }
    }
  }

  // 3. Compute Global Curriculum Coverage Matrix: Course Competency Matrix vs Labs
  // Map micro-competencies across all labs
  const conceptToLabsMap = new Map<string, string[]>();
  const unanchoredConceptsMap = new Map<string, { labs: string[]; labTitles: string[] }>();

  for (const lab of labs) {
    for (const rawConcept of lab.covered_micro_concepts || []) {
      const canonicalCode = codeToCanonicalMap.get(rawConcept) || codeToCanonicalMap.get(normalizeCode(rawConcept));
      if (canonicalCode) {
        const list = conceptToLabsMap.get(canonicalCode) || [];
        if (!list.includes(lab.code)) {
          list.push(lab.code);
        }
        conceptToLabsMap.set(canonicalCode, list);
      } else {
        const entry = unanchoredConceptsMap.get(rawConcept) || { labs: [], labTitles: [] };
        if (!entry.labs.includes(lab.code)) {
          entry.labs.push(lab.code);
          entry.labTitles.push(lab.title);
        }
        unanchoredConceptsMap.set(rawConcept, entry);
      }
    }
  }

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

  // 1. Calculate Milestone Completion Rates for Active Lab
  const milestoneStats: Array<{
    activityOrder: number;
    activityTitle: string;
    milestoneId: string;
    milestoneTitle: string;
    completedCount: number;
    completionRate: number;
    blockedCount: number;
  }> = [];

  if (selectedLab?.activities) {
    for (const act of selectedLab.activities) {
      for (const m of act.milestones || []) {
        const completedCount = labSessions.filter((s) =>
          s.completed_milestone_ids?.includes(m.id)
        ).length;

        const blockedCount = labSessions.filter(
          (s) => s.status === 'BLOCKED' && s.current_milestone_id === m.id
        ).length;

        const rate = totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0;

        milestoneStats.push({
          activityOrder: act.order,
          activityTitle: act.title,
          milestoneId: m.id,
          milestoneTitle: m.title,
          completedCount,
          completionRate: rate,
          blockedCount,
        });
      }
    }
  }

  // 2. Calculate Average Micro-Competency Scores for Active Lab
  const conceptScores: Array<{
    conceptKey: string;
    avgScore: number;
    masteredCount: number;
    strugglingCount: number;
  }> = [];

  const coveredConcepts = selectedLab?.covered_micro_concepts || [];
  for (const concept of coveredConcepts) {
    let scoreSum = 0;
    let scoredStudents = 0;
    let masteredCount = 0;
    let strugglingCount = 0;

    for (const s of labSessions) {
      const entry = s.micro_competencies_state?.[concept];
      if (entry && entry.signal_count > 0) {
        scoreSum += entry.score;
        scoredStudents += 1;
        if (entry.status === 'MASTERED') masteredCount += 1;
        if (entry.status === 'STRUGGLING') strugglingCount += 1;
      }
    }

    const avg = scoredStudents > 0 ? Math.round(scoreSum / scoredStudents) : 0;
    conceptScores.push({
      conceptKey: concept,
      avgScore: avg,
      masteredCount,
      strugglingCount,
    });
  }


  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* 1. TOP CARDS: MILESTONES COMPLETION & CONCEPT SCORES */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Card: Milestone Completion Breakdown */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <h3 className="font-semibold text-slate-100 text-sm">
                Milestone Progress ({selectedLab?.code || 'Active Lab'})
              </h3>
            </div>
            <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
              {totalStudents} Active Students
            </Badge>
          </div>

          {milestoneStats.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center italic">
              No milestones defined for this lab.
            </div>
          ) : (
            <div className="space-y-3">
              {milestoneStats.map((stat) => (
                <div key={stat.milestoneId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium truncate max-w-[240px]">
                      {stat.milestoneTitle}
                    </span>
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      {stat.blockedCount > 0 && (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {stat.blockedCount} blocked
                        </span>
                      )}
                      <span className="text-emerald-400">
                        {stat.completedCount}/{totalStudents} ({stat.completionRate}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-300 ${
                        stat.blockedCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${stat.completionRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Card: Micro-Competency Mastery on Active Lab */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h3 className="font-semibold text-slate-100 text-sm">
                Average Micro-Concept Mastery
              </h3>
            </div>
            <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
              {coveredConcepts.length} Tracked Concepts
            </Badge>
          </div>

          {conceptScores.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center italic">
              No micro-concepts mapped to this lab yet.
            </div>
          ) : (
            <div className="space-y-3">
              {conceptScores.map((c) => (
                <div key={c.conceptKey} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-200 text-[11px]">{c.conceptKey}</span>
                    <span className="font-mono text-emerald-400 font-semibold">{c.avgScore}%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${c.avgScore}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>{c.masteredCount} Mastered</span>
                    <span>{c.strugglingCount} Struggling</span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                Cross-references theoretical chapter competencies against practical TP exercises.
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
          <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No chapter competencies compiled yet.</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Go to &ldquo;🧠 Course Studio&rdquo; and click &ldquo;⚡ Recompile Course Knowledge Base&rdquo; to build the taxonomy.
            </p>
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
                        <p className="text-[11px] text-slate-400 line-clamp-1">{micro.title}</p>
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
                  className="p-3 bg-slate-900/90 border border-slate-800 rounded-lg space-y-2 flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[11px] font-semibold text-slate-200 truncate">
                        {conceptCode}
                      </span>
                      <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[9px] shrink-0">
                        {data.labs.join(', ')}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">
                      Practiced in: {data.labTitles.slice(0, 2).join(' • ')}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActiveUnanchoredAction({ conceptCode, action: 'assign' });
                        setSelectedChapterCode(chaptersTaxonomy[0]?.chapter_code || '');
                        setActionError(null);
                      }}
                      className="h-6 text-[10px] px-2 border-slate-700 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/50 flex-1"
                    >
                      ➕ Assign Chapter
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
                      🔗 Link Alias
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

              <div className="text-xs text-slate-300 space-y-1">
                <div>Concept: <span className="font-mono text-emerald-400 font-semibold">{activeUnanchoredAction.conceptCode}</span></div>
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
                      {chaptersTaxonomy.flatMap((ch) =>
                        (ch.micro_competencies || []).map((mc) => (
                          <option key={mc.code} value={mc.code}>
                            {mc.code} ({mc.title})
                          </option>
                        ))
                      )}
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
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs"
                >
                  {isSubmittingAction ? 'Saving...' : 'Confirm'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
