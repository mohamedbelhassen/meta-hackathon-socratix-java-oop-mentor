'use client';

import React from 'react';
import { X, CheckCircle2, Clock, Circle, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StudentLabSession, Lab } from '@/types/socratix';

interface TeacherMilestonesBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: StudentLabSession | null;
  lab: Lab | null;
}

export default function TeacherMilestonesBreakdownModal({
  isOpen,
  onClose,
  session,
  lab,
}: TeacherMilestonesBreakdownModalProps) {
  if (!isOpen || !session || !lab) return null;

  const studentName = session.profiles?.display_name || 'Student';
  const seatLabel = session.seat_label || 'PC';
  const activities = [...(lab.activities || [])].sort((a, b) => a.order - b.order);

  // Compute total milestones across all activities
  const totalMilestonesCount = activities.reduce((sum, a) => sum + (a.milestones?.length || 0), 0);
  const completedMilestonesCount = Object.values(session.activities_progress || {}).reduce(
    (sum, p) => sum + (p.completed_milestones?.length || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 rounded-xl text-cyan-400 border border-cyan-500/20 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-100 text-base">
                  Milestones Breakdown &bull; {studentName}
                </h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  {seatLabel}
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {lab.code || `TP ${lab.lab_number}`}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {lab.title} &bull; Detailed milestone checklist & validation telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="text-xs text-slate-400 block font-mono">
                {completedMilestonesCount}/{totalMilestonesCount} Milestones
              </span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                {session.progress_percent}% Complete
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg ml-1"
              onClick={onClose}
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full bg-slate-950 h-1.5 overflow-hidden shrink-0 border-b border-slate-800">
          <div
            className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-300"
            style={{ width: `${session.progress_percent}%` }}
          />
        </div>

        {/* Body: Activity & Milestones Checklist */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {activities.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No decomposed activities found for this lab.
            </div>
          ) : (
            activities.map((act) => {
              const actProg = session.activities_progress?.[act.id];
              const completedList = actProg?.completed_milestones || [];
              const actTotal = act.milestones?.length || 0;
              const isActCompleted = actTotal > 0 && completedList.length >= actTotal;
              const isActCurrent = session.current_activity_id === act.id;
              const isActStarted = completedList.length > 0 || isActCurrent;

              return (
                <div
                  key={act.id}
                  className={`rounded-xl border overflow-hidden transition-all ${
                    isActCompleted
                      ? 'bg-slate-950/40 border-emerald-500/30'
                      : isActCurrent
                      ? 'bg-slate-950/70 border-cyan-500/40 ring-1 ring-cyan-500/20'
                      : 'bg-slate-950/30 border-slate-800/80 opacity-75'
                  }`}
                >
                  {/* Activity Bar */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-900/60 border-b border-slate-800/60">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span
                        className={`w-6 h-6 rounded-lg text-xs font-bold font-mono flex items-center justify-center shrink-0 ${
                          isActCompleted
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : isActCurrent
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {act.order}
                      </span>
                      <h4 className="text-xs font-semibold text-slate-200 truncate">
                        Activity {act.order}: {act.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isActCompleted ? (
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40 text-[10px] gap-1 font-medium">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Mastered ({completedList.length}/{actTotal})</span>
                        </Badge>
                      ) : isActCurrent ? (
                        <Badge className="bg-cyan-500/15 text-cyan-300 border-cyan-500/40 text-[10px] gap-1 font-medium">
                          <Clock className="w-3 h-3 text-cyan-400 animate-pulse" />
                          <span>In Progress ({completedList.length}/{actTotal})</span>
                        </Badge>
                      ) : isActStarted ? (
                        <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/40 text-[10px] font-medium">
                          <span>Partial ({completedList.length}/{actTotal})</span>
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-800/60 text-slate-400 border-slate-700 text-[10px] font-medium">
                          <span>Not Started (0/{actTotal})</span>
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Milestones List */}
                  <div className="p-3 divide-y divide-slate-800/50 space-y-2">
                    {(act.milestones || []).map((m) => {
                      const isCompleted = completedList.includes(m.id);
                      const isCurrent = isActCurrent && session.current_milestone_id === m.id;

                      return (
                        <div
                          key={m.id}
                          className={`pt-2 first:pt-0 flex items-start justify-between gap-3 ${
                            isCompleted ? 'text-slate-200' : isCurrent ? 'text-cyan-200' : 'text-slate-400'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="mt-0.5 shrink-0">
                              {isCompleted ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : isCurrent ? (
                                <Clock className="w-4 h-4 text-cyan-400 animate-pulse" />
                              ) : (
                                <Circle className="w-4 h-4 text-slate-600" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-xs font-medium leading-snug ${isCompleted ? 'text-slate-100' : isCurrent ? 'text-cyan-300 font-semibold' : 'text-slate-400'}`}>
                                <span className="font-mono text-[11px] opacity-75 mr-1.5">
                                  #{m.order || m.id}:
                                </span>
                                {m.title}
                              </p>
                              {m.validation_criteria && (
                                <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5 font-sans">
                                  <span className="text-slate-400/90 font-medium mr-1">Criteria:</span>
                                  {m.validation_criteria}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            {isCompleted ? (
                              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                Completed
                              </span>
                            ) : isCurrent ? (
                              <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30 animate-pulse">
                                Active Step
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                Pending
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
