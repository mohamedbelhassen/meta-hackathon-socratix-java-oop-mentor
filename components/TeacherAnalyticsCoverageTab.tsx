'use client';

import React from 'react';
import { Course, Lab, StudentLabSession } from '@/types/socratix';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  Layers,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Check,
  Compass,
} from 'lucide-react';

interface TeacherAnalyticsCoverageTabProps {
  course: Course;
  labs: Lab[];
  selectedLab: Lab | null;
  sessions: StudentLabSession[];
}

export default function TeacherAnalyticsCoverageTab({
  course,
  labs,
  selectedLab,
  sessions,
}: TeacherAnalyticsCoverageTabProps) {
  const labSessions = sessions.filter((s) => s.lab_id === selectedLab?.id);
  const totalStudents = labSessions.length;

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

  // 3. Compute Global Curriculum Coverage Matrix: Course Competency Matrix vs Labs
  // Map micro-competencies across all labs
  const conceptToLabsMap = new Map<string, string[]>();

  for (const lab of labs) {
    for (const concept of lab.covered_micro_concepts || []) {
      const list = conceptToLabsMap.get(concept) || [];
      if (!list.includes(lab.code)) {
        list.push(lab.code);
      }
      conceptToLabsMap.set(concept, list);
    }
  }

  const chaptersTaxonomy = course.competency_matrix || [];

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
      </div>
    </div>
  );
}
