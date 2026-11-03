'use client';

import React, { useState, useMemo } from 'react';
import { Course, Lab, StudentLabSession } from '@/types/socratix';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatLabOptionLabel } from '@/lib/utils';
import {
  BarChart3,
  Layers,
  AlertTriangle,
  Users,
  Compass,
  ArrowRight,
  TrendingUp,
  Award,
} from 'lucide-react';

interface TeacherAnalyticsTabProps {
  course: Course;
  labs: Lab[];
  selectedLab: Lab | null;
  onSelectLab?: (lab: Lab) => void;
  sessions: StudentLabSession[];
  onOpenStudioTab?: () => void;
  onOpenCoverageTab?: () => void;
}

export default function TeacherAnalyticsTab({
  course,
  labs,
  selectedLab,
  onSelectLab,
  sessions,
  onOpenStudioTab,
  onOpenCoverageTab,
}: TeacherAnalyticsTabProps) {
  // Scope filter: 'ALL' for course-wide overview, or a specific lab ID
  const [scopeLabId, setScopeLabId] = useState<string>(selectedLab?.id || 'ALL');

  // Sync with selectedLab prop if it changes externally
  React.useEffect(() => {
    if (selectedLab && scopeLabId !== 'ALL' && scopeLabId !== selectedLab.id) {
      setScopeLabId(selectedLab.id);
    }
  }, [selectedLab, scopeLabId]);

  const hasLabs = labs.length > 0;
  const isAllScope = scopeLabId === 'ALL';

  const currentLab = useMemo(
    () => (isAllScope ? null : labs.find((l) => l.id === scopeLabId) || labs[0] || null),
    [isAllScope, scopeLabId, labs]
  );

  const activeSessions = useMemo(() => {
    if (isAllScope) return sessions;
    return sessions.filter((s) => s.lab_id === scopeLabId);
  }, [isAllScope, scopeLabId, sessions]);

  const totalStudents = activeSessions.length;
  const blockedCount = activeSessions.filter((s) => s.status === 'BLOCKED').length;
  const completedCount = activeSessions.filter((s) => s.status === 'COMPLETED').length;

  const avgProgress = useMemo(() => {
    if (totalStudents === 0) return 0;
    const sum = activeSessions.reduce((acc, s) => acc + (s.progress_percent || 0), 0);
    return Math.round(sum / totalStudents);
  }, [activeSessions, totalStudents]);

  // 1. Milestone Progress breakdown (single lab scope)
  const milestoneStats = useMemo(() => {
    if (!currentLab?.activities) return [];
    const stats: Array<{
      activityOrder: number;
      activityTitle: string;
      milestoneId: string;
      milestoneTitle: string;
      completedCount: number;
      completionRate: number;
      blockedCount: number;
    }> = [];

    for (const act of currentLab.activities) {
      for (const m of act.milestones || []) {
        const cCount = activeSessions.filter((s) =>
          s.completed_milestone_ids?.includes(m.id)
        ).length;
        const bCount = activeSessions.filter(
          (s) => s.status === 'BLOCKED' && s.current_milestone_id === m.id
        ).length;
        const rate = totalStudents > 0 ? Math.round((cCount / totalStudents) * 100) : 0;

        stats.push({
          activityOrder: act.order,
          activityTitle: act.title,
          milestoneId: m.id,
          milestoneTitle: m.title,
          completedCount: cCount,
          completionRate: rate,
          blockedCount: bCount,
        });
      }
    }
    return stats;
  }, [currentLab?.activities, activeSessions, totalStudents]);

  // 2. Micro-Concept Scores (single lab scope)
  const coveredConcepts = useMemo(
    () => currentLab?.covered_micro_concepts || [],
    [currentLab?.covered_micro_concepts]
  );

  const conceptScores = useMemo(() => {
    const scores: Array<{
      conceptKey: string;
      avgScore: number;
      masteredCount: number;
      strugglingCount: number;
    }> = [];

    for (const concept of coveredConcepts) {
      let scoreSum = 0;
      let scoredStudents = 0;
      let masteredCount = 0;
      let strugglingCount = 0;

      for (const s of activeSessions) {
        const entry = s.micro_competencies_state?.[concept];
        if (entry && entry.signal_count > 0) {
          scoreSum += entry.score;
          scoredStudents += 1;
          if (entry.status === 'MASTERED') masteredCount += 1;
          if (entry.status === 'STRUGGLING') strugglingCount += 1;
        }
      }

      const avg = scoredStudents > 0 ? Math.round(scoreSum / scoredStudents) : 0;
      scores.push({
        conceptKey: concept,
        avgScore: avg,
        masteredCount,
        strugglingCount,
      });
    }
    return scores;
  }, [coveredConcepts, activeSessions]);

  // 3. Course-wide aggregated concept performance (ALL scope)
  const allConceptsAggregated = useMemo(() => {
    if (!isAllScope) return [];
    const map = new Map<string, { totalScore: number; count: number; mastered: number; struggling: number }>();

    for (const s of activeSessions) {
      const state = s.micro_competencies_state || {};
      for (const [key, entry] of Object.entries(state)) {
        if (entry && entry.signal_count > 0) {
          const prev = map.get(key) || { totalScore: 0, count: 0, mastered: 0, struggling: 0 };
          prev.totalScore += entry.score;
          prev.count += 1;
          if (entry.status === 'MASTERED') prev.mastered += 1;
          if (entry.status === 'STRUGGLING') prev.struggling += 1;
          map.set(key, prev);
        }
      }
    }

    return Array.from(map.entries())
      .map(([conceptKey, data]) => ({
        conceptKey,
        avgScore: data.count > 0 ? Math.round(data.totalScore / data.count) : 0,
        evaluatedStudents: data.count,
        masteredCount: data.mastered,
        strugglingCount: data.struggling,
      }))
      .sort((a, b) => a.avgScore - b.avgScore); // Lowest score first to highlight friction
  }, [isAllScope, activeSessions]);

  // 4. Lab-by-lab cohort summary (ALL scope)
  const labSummaries = useMemo(() => {
    if (!isAllScope) return [];
    return labs.map((l) => {
      const labSess = sessions.filter((s) => s.lab_id === l.id);
      const studentCount = labSess.length;
      const bCount = labSess.filter((s) => s.status === 'BLOCKED').length;
      const cCount = labSess.filter((s) => s.status === 'COMPLETED').length;
      const avg = studentCount > 0
        ? Math.round(labSess.reduce((acc, s) => acc + (s.progress_percent || 0), 0) / studentCount)
        : 0;
      return {
        lab: l,
        studentCount,
        blockedCount: bCount,
        completedCount: cCount,
        avgProgress: avg,
      };
    });
  }, [isAllScope, labs, sessions]);

  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* 1. TOP CONTROLS: SCOPE SELECTOR & QUICK KPIS */}
      {/* ==================================================================== */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-semibold text-slate-400">Analytics Scope:</span>
          {hasLabs ? (
            <select
              value={scopeLabId}
              onChange={(e) => {
                const val = e.target.value;
                setScopeLabId(val);
                if (val !== 'ALL' && onSelectLab) {
                  const target = labs.find((l) => l.id === val);
                  if (target) onSelectLab(target);
                }
              }}
              className="bg-slate-950 border border-slate-700 text-slate-100 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 font-medium min-w-[240px]"
            >
              <option value="ALL">🌐 All Labs — Course Cohort Overview</option>
              <optgroup label="Single Lab Breakdown">
                {labs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {formatLabOptionLabel(l.code, l.title)}
                  </option>
                ))}
              </optgroup>
            </select>
          ) : (
            <select
              disabled
              value=""
              className="bg-slate-950/60 border border-slate-800 text-slate-500 text-xs rounded-lg px-3 py-1.5 cursor-not-allowed italic font-medium"
            >
              <option value="">No Practical Labs configured</option>
            </select>
          )}
        </div>

        {/* Action Link to Curriculum Coverage Matrix */}
        {onOpenCoverageTab && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenCoverageTab}
            className="text-xs text-slate-400 hover:text-emerald-400 h-8 gap-1.5"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span>View Syllabus ↔ Lab Alignment (Coverage Matrix) &rarr;</span>
          </Button>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 2. EMPTY STATE: NO LABS CONFIGURED */}
      {/* ==================================================================== */}
      {!hasLabs ? (
        <div className="p-8 sm:p-10 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm text-center max-w-2xl mx-auto my-6 space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-slate-100">
              No Practical Labs to Analyze
            </h3>
            <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
              Student milestone completion and micro-concept metrics require at least one Practical Lab (TP) in the course curriculum.
            </p>
          </div>
          {onOpenStudioTab && (
            <Button
              type="button"
              onClick={onOpenStudioTab}
              className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs h-9 px-4 rounded-xl shadow-md gap-1.5"
            >
              <span>Open Course Studio (Upload Lab PDFs)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ) : totalStudents === 0 ? (
        /* Empty State: Labs exist but 0 student sessions recorded */
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm text-center max-w-xl mx-auto my-6 space-y-4">
          <Users className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="space-y-1">
            <p className="text-base font-medium text-slate-300">No Student Telemetry Recorded Yet</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Once students connect via <span className="text-emerald-400 font-mono">/student</span>, their milestone evaluations, code checks, and Socratic interactions will appear here in real time.
            </p>
          </div>
          <div className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 max-w-md mx-auto">
            💡 <strong>Hackathon Demo Tip:</strong> Switch to the <strong>&ldquo;📡 Live Lab Sessions&rdquo;</strong> tab and click <strong>&ldquo;🎭 Populate Demo Class&rdquo;</strong> to instantly simulate a live classroom with 4 realistic student sessions!
          </div>
        </div>
      ) : (
        /* ==================================================================== */
        /* 3. COHORT KPIS CARDS (4 Summary Cards) */
        /* ==================================================================== */
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Active Cohort</span>
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white font-mono">{totalStudents}</div>
              <div className="text-[11px] text-slate-500">
                {isAllScope ? `Students across ${course.title}` : `Students on ${currentLab?.code}`}
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Average Progress</span>
                <TrendingUp className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-cyan-400 font-mono">{avgProgress}%</div>
              <div className="text-[11px] text-slate-500">
                {completedCount} students completed (100%)
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Blocked Friction</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-bold text-rose-400 font-mono">{blockedCount}</div>
              <div className="text-[11px] text-slate-500">
                {blockedCount > 0 ? 'Students needing assistance' : 'No active blockers'}
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Tracked Competencies</span>
                <Award className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                {isAllScope ? allConceptsAggregated.length : coveredConcepts.length}
              </div>
              <div className="text-[11px] text-slate-500">
                Assessed via Socratic turns
              </div>
            </div>
          </div>

          {/* ==================================================================== */}
          {/* 4. BREAKDOWN CONTENT: SINGLE LAB VS. ALL LABS */}
          {/* ==================================================================== */}
          {isAllScope ? (
            /* ALL LABS OVERVIEW */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left: Lab by Lab Progression */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-semibold text-slate-100 text-sm">
                      Lab-by-Lab Cohort Progression
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                    {labs.length} Practical Labs
                  </Badge>
                </div>

                <div className="space-y-3">
                  {labSummaries.map(({ lab, studentCount, blockedCount: bCount, completedCount: cCount, avgProgress: avg }) => (
                    <div
                      key={lab.id}
                      className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-2 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-emerald-400 font-semibold shrink-0">
                            {lab.code}
                          </span>
                          <span className="text-slate-200 truncate font-medium">
                            {lab.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                          {bCount > 0 && (
                            <span className="text-rose-400 flex items-center gap-1 font-semibold">
                              <AlertTriangle className="w-3 h-3" /> {bCount} blocked
                            </span>
                          )}
                          <span className="text-slate-400">
                            {studentCount} students &bull; {avg}% avg
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className={`h-full transition-all duration-300 ${
                            bCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${avg}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                        <span>Activities: {lab.activities?.length || 0}</span>
                        <span>{cCount} Finished &bull; {studentCount - cCount - bCount} In Progress</span>
                        <button
                          type="button"
                          onClick={() => setScopeLabId(lab.id)}
                          className="text-emerald-400 hover:text-emerald-300 underline font-medium"
                        >
                          View Breakdown &rarr;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Class-wide Competency Friction & Mastery */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-semibold text-slate-100 text-sm">
                      Curriculum-Wide Competency Health
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                    Ranked by Friction
                  </Badge>
                </div>

                {allConceptsAggregated.length === 0 ? (
                  <div className="text-xs text-slate-500 py-6 text-center italic">
                    No concept evaluations recorded yet across sessions.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allConceptsAggregated.slice(0, 8).map((c) => (
                      <div key={c.conceptKey} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono text-slate-200 text-[11px] truncate max-w-[220px]">
                            {c.conceptKey}
                          </span>
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            {c.strugglingCount > 0 && (
                              <span className="text-rose-400 text-[10px]">
                                {c.strugglingCount} struggling
                              </span>
                            )}
                            <span className="text-emerald-400 font-semibold">{c.avgScore}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className={`h-full transition-all duration-300 ${
                              c.avgScore < 50 ? 'bg-rose-500' : c.avgScore < 75 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${c.avgScore}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* SINGLE LAB BREAKDOWN */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Card: Milestone Completion Breakdown */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-semibold text-slate-100 text-sm">
                      Milestone Progress ({currentLab?.code})
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
          )}
        </>
      )}
    </div>
  );
}
