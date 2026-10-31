'use client';

import React, { useState } from 'react';
import { Course, Lab, StudentLabSession, ChatMessage, DemoPresetFile } from '@/types/socratix';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getBrowserSupabase } from '@/lib/supabase';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Code2,
  MessageSquare,
  RotateCcw,
  Search,
  Sparkles,
  Users,
  X,
  Layers,
  Monitor,
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface TeacherLiveSessionsTabProps {
  course: Course;
  labs: Lab[];
  selectedLab: Lab | null;
  onSelectLab: (lab: Lab) => void;
  sessions: StudentLabSession[];
  onRefresh: () => void;
}

export default function TeacherLiveSessionsTab({
  course,
  labs,
  selectedLab,
  onSelectLab,
  sessions,
  onRefresh,
}: TeacherLiveSessionsTabProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'BLOCKED' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);

  // Drill-down Popover State
  const [drillDownData, setDrillDownData] = useState<{
    studentName: string;
    conceptKey: string;
    score: number;
    summary: string;
    occurrences: Array<{
      activity_id: string;
      file: string;
      location: string;
      status: 'PASS' | 'FAIL';
      note: string;
    }>;
  } | null>(null);

  // Inspector Drawer State
  const [inspectingSession, setInspectingSession] = useState<StudentLabSession | null>(null);
  const [inspectedCodeFiles, setInspectedCodeFiles] = useState<DemoPresetFile[]>([]);
  const [inspectedChatHistory, setInspectedChatHistory] = useState<ChatMessage[]>([]);
  const [isLoadingInspection, setIsLoadingInspection] = useState(false);

  // Filter sessions for the active lab
  const labSessions = sessions.filter((s) => s.lab_id === selectedLab?.id);

  // Apply filters
  const filteredSessions = labSessions.filter((s) => {
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = s.profiles?.display_name?.toLowerCase() || '';
      const seat = s.seat_label?.toLowerCase() || '';
      return name.includes(q) || seat.includes(q);
    }
    return true;
  });

  // Classroom Bottleneck Detection
  // Check if >= 2 students (or >= 40% of active) are blocked on the same milestone
  const blockedSessions = labSessions.filter((s) => s.status === 'BLOCKED');
  const bottleneckMap = new Map<string, StudentLabSession[]>();

  for (const s of blockedSessions) {
    if (s.current_milestone_id) {
      const key = `${s.current_activity_id || 'act_1'}_${s.current_milestone_id}`;
      const list = bottleneckMap.get(key) || [];
      list.push(s);
      bottleneckMap.set(key, list);
    }
  }

  let bottleneckAlert: {
    activityId: string;
    milestoneId: string;
    milestoneTitle: string;
    students: StudentLabSession[];
  } | null = null;

  for (const [key, stuckList] of Array.from(bottleneckMap.entries())) {
    if (stuckList.length >= 2) {
      const [, mId] = key.split('_');
      let mTitle = mId;
      selectedLab?.activities?.forEach((a) => {
        const found = a.milestones?.find((m) => m.id === mId);
        if (found) mTitle = found.title;
      });

      bottleneckAlert = {
        activityId: stuckList[0].current_activity_id || 'act_1',
        milestoneId: mId,
        milestoneTitle: mTitle,
        students: stuckList,
      };
      break;
    }
  }

  // Populate Demo Class in 1 click
  const handleSeedDemoClass = async () => {
    if (!selectedLab) return;
    setIsSeedingDemo(true);
    try {
      const res = await fetch('/api/sessions/seed-demo-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: course.id,
          labId: selectedLab.id,
        }),
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to seed demo class:', err);
    } finally {
      setIsSeedingDemo(false);
    }
  };

  // Inspect Student Code & Chat
  const handleOpenInspector = async (session: StudentLabSession) => {
    setInspectingSession(session);
    setIsLoadingInspection(true);

    try {
      // 1. Fetch chat history
      const res = await fetch(`/api/sessions/context?studentId=${session.student_id}&labId=${session.lab_id}`);
      const data = await res.json();
      setInspectedChatHistory(data.messages || []);

      // 2. Request live workspace dump via Realtime Broadcast
      const supabase = getBrowserSupabase();
      const channel = supabase.channel('workspace-sync');

      let receivedDump = false;
      channel
        .on('broadcast', { event: 'WORKSPACE_DUMP_RESPONSE' }, ({ payload }) => {
          if (payload?.studentId === session.student_id && payload.files) {
            receivedDump = true;
            setInspectedCodeFiles(payload.files);
            setIsLoadingInspection(false);
          }
        })
        .subscribe(() => {
          channel.send({
            type: 'broadcast',
            event: 'REQUEST_WORKSPACE_DUMP',
            payload: { studentId: session.student_id },
          });
        });

      // Fallback: if no client responded after 1200ms, use last chat message snapshot
      setTimeout(() => {
        if (!receivedDump) {
          const lastMsgWithCode = [...(data.messages || [])]
            .reverse()
            .find((m: ChatMessage) => m.code_snapshot && m.code_snapshot.length > 0);
          if (lastMsgWithCode) {
            setInspectedCodeFiles(lastMsgWithCode.code_snapshot);
          } else {
            setInspectedCodeFiles([{ name: 'No Snapshot', content: '// No code snapshot available' }]);
          }
          setIsLoadingInspection(false);
        }
      }, 1200);
    } catch (err) {
      console.error('Failed to load inspection:', err);
      setIsLoadingInspection(false);
    }
  };

  // Reset Student Session
  const handleResetSession = async (studentId: string, labId: string) => {
    if (!confirm('Are you sure you want to reset this student session?')) return;
    try {
      await fetch('/api/sessions/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, labId }),
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to reset session:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* ==================================================================== */}
      {/* 1. TOP CONTROLS & FILTER BAR */}
      {/* ==================================================================== */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
        {/* Lab Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-semibold text-slate-400">Target Lab:</span>
          <select
            value={selectedLab?.id || ''}
            onChange={(e) => {
              const target = labs.find((l) => l.id === e.target.value);
              if (target) onSelectLab(target);
            }}
            className="bg-slate-950 border border-slate-700 text-slate-100 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 font-medium"
          >
            {labs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} - {l.title}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          {(['ALL', 'BLOCKED', 'IN_PROGRESS', 'COMPLETED'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                statusFilter === filter
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {filter === 'ALL' && 'All'}
              {filter === 'BLOCKED' && '🔴 Blocked'}
              {filter === 'IN_PROGRESS' && '🟠 In Progress'}
              {filter === 'COMPLETED' && '🟢 Completed'}
            </button>
          ))}
        </div>

        {/* Search Input & Demo Seeder Button */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student or PC..."
              className="h-8 pl-8 text-xs bg-slate-950 border-slate-700 w-44 rounded-lg focus-visible:ring-emerald-500"
            />
          </div>

          <Button
            size="sm"
            onClick={handleSeedDemoClass}
            disabled={isSeedingDemo || !selectedLab}
            className="h-8 text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white gap-1.5 px-3 rounded-lg shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isSeedingDemo ? 'Seeding...' : '🎭 Populate Demo Class'}
          </Button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. CLASSROOM BOTTLENECK DETECTOR ALERT */}
      {/* ==================================================================== */}
      {bottleneckAlert && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3.5 animate-in fade-in slide-in-from-top-2">
          <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl mt-0.5">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-rose-300 text-sm">Classroom Bottleneck Detected</span>
              <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[10px]">
                {bottleneckAlert.students.length} Students Stuck
              </Badge>
            </div>
            <p className="text-slate-300 mt-1 leading-relaxed">
              <span className="font-semibold text-white">
                {bottleneckAlert.students
                  .map((s) => `${s.profiles?.display_name || 'Student'} (${s.seat_label})`)
                  .join(', ')}
              </span>{' '}
              are simultaneously blocked on{' '}
              <span className="font-semibold text-rose-300">
                Milestone &ldquo;{bottleneckAlert.milestoneTitle}&rdquo;
              </span>
              . Consider projecting the associated lecture slide to unlock the whole room!
            </p>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. CONSOLIDATED STUDENT TABLE (1 Row per Student) */}
      {/* ==================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase font-semibold text-slate-400">
                <th className="py-3 px-4">Student & Workstation</th>
                <th className="py-3 px-4">Lab & Activity Progress</th>
                <th className="py-3 px-4">Covered Micro-Competencies (Drill-Down)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No student sessions found for this lab.</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Click &ldquo;🎭 Populate Demo Class&rdquo; above to generate test sessions instantly.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => {
                  const microState = session.micro_competencies_state || {};
                  const isBlocked = session.status === 'BLOCKED';
                  const isCompleted = session.status === 'COMPLETED';

                  return (
                    <tr
                      key={session.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isBlocked ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      {/* Col 1: Student & Workstation */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-xs">
                            {session.profiles?.display_name?.[0] || 'S'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 font-medium text-slate-200">
                              <span>{session.profiles?.display_name || 'Anonymous Student'}</span>
                              {session.profiles?.is_guest && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/40 text-amber-400">
                                  Guest
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono mt-0.5">
                              <Monitor className="w-3 h-3 text-slate-500" />
                              <span>{session.seat_label || 'PC --'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Col 2: Progress */}
                      <td className="py-3.5 px-4 min-w-[180px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">Total Progress</span>
                            <span className="font-semibold text-emerald-400">
                              {session.progress_percent}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isCompleted
                                  ? 'bg-emerald-500'
                                  : isBlocked
                                  ? 'bg-rose-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${session.progress_percent}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {session.current_activity_id ? `Activity: ${session.current_activity_id}` : 'General'}
                            {session.current_milestone_id ? ` • Milestone: ${session.current_milestone_id}` : ''}
                          </div>
                        </div>
                      </td>

                      {/* Col 3: Micro-Competencies Drill-Down */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {(selectedLab?.covered_micro_concepts || Object.keys(microState)).map((conceptKey) => {
                            const entry = microState[conceptKey];
                            const status = entry?.status || 'UNTESTED';
                            const score = entry?.score ?? 0;
                            const passCount = entry?.occurrences?.filter((o) => o.status === 'PASS').length ?? 0;
                            const totalCount = entry?.occurrences?.length ?? 0;

                            let badgeStyle = 'bg-slate-800 text-slate-400 border-slate-700';
                            if (status === 'MASTERED') badgeStyle = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25';
                            else if (status === 'IN_PROGRESS') badgeStyle = 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25';
                            else if (status === 'STRUGGLING') badgeStyle = 'bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25';

                            return (
                              <button
                                key={conceptKey}
                                onClick={() =>
                                  setDrillDownData({
                                    studentName: session.profiles?.display_name || 'Student',
                                    conceptKey,
                                    score,
                                    summary: entry?.summary || 'Not yet evaluated.',
                                    occurrences: entry?.occurrences || [],
                                  })
                                }
                                className={`text-[10px] px-2 py-0.5 rounded-md border font-mono transition-colors flex items-center gap-1 ${badgeStyle}`}
                                title="Click to view code occurrence drill-down"
                              >
                                <span>{conceptKey}</span>
                                {totalCount > 0 && (
                                  <span className="font-semibold">
                                    ({passCount}/{totalCount})
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </td>

                      {/* Col 4: Status */}
                      <td className="py-3.5 px-4">
                        {isBlocked ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>BLOCKED</span>
                            <span className="text-[10px] bg-rose-950/60 px-1 rounded text-rose-300">
                              {session.consecutive_errors} errors
                            </span>
                          </div>
                        ) : isCompleted ? (
                          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>COMPLETED</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                            <Clock className="w-3.5 h-3.5" />
                            <span>IN PROGRESS</span>
                          </div>
                        )}
                      </td>

                      {/* Col 5: Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenInspector(session)}
                            className="h-7 text-xs border-slate-700 hover:bg-slate-800 text-slate-300 gap-1"
                          >
                            <Code2 className="w-3 h-3" />
                            Inspect
                          </Button>

                          {session.profiles?.is_guest && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResetSession(session.student_id, session.lab_id)}
                              className="h-7 text-xs text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 p-1.5"
                              title="Reset Guest Session"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 4. DRILL-DOWN OCCURRENCE MODAL / POPOVER */}
      {/* ==================================================================== */}
      {drillDownData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-slate-200 text-sm">
                  {drillDownData.conceptKey} &bull; {drillDownData.studentName}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                onClick={() => setDrillDownData(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 space-y-3">
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400">Score & Summary:</span>
                <span className="font-semibold text-emerald-400">{drillDownData.score}%</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{drillDownData.summary}</p>

              <div className="pt-2">
                <div className="text-[10px] uppercase font-semibold text-slate-400 mb-2">
                  Inspected Code Locations ({drillDownData.occurrences.length})
                </div>
                {drillDownData.occurrences.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No specific code locations evaluated yet.</p>
                ) : (
                  <div className="space-y-2">
                    {drillDownData.occurrences.map((occ, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                          occ.status === 'PASS'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                        }`}
                      >
                        {occ.status === 'PASS' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5">
                          <div className="font-mono font-semibold text-white">
                            {occ.location}
                          </div>
                          <div className="text-[11px] opacity-90">{occ.note}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. INSPECT CODE & CHAT DRAWER */}
      {/* ==================================================================== */}
      {inspectingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-3xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-emerald-400" />
                  Live Inspection: {inspectingSession.profiles?.display_name} ({inspectingSession.seat_label})
                </h3>
                <p className="text-xs text-slate-400">
                  {course.title} &bull; {selectedLab?.code}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                onClick={() => setInspectingSession(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Drawer Body: Code & Dialogue */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
              {/* Left Column: Student Code */}
              <div className="border-r border-slate-800 flex flex-col h-full overflow-hidden bg-slate-950/70">
                <div className="p-2 border-b border-slate-800 bg-slate-900/60 text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                  Live Code Snapshot
                </div>
                <div className="flex-1 overflow-auto p-3">
                  {isLoadingInspection ? (
                    <div className="text-xs text-slate-400 p-4">Syncing live code from student workspace...</div>
                  ) : (
                    inspectedCodeFiles.map((file, idx) => (
                      <div key={idx} className="mb-4">
                        <div className="text-[11px] font-mono text-emerald-400 mb-1 px-1">{file.name}</div>
                        <SyntaxHighlighter
                          language="java"
                          style={vscDarkPlus}
                          customStyle={{ background: '#090d16', fontSize: '11px', margin: 0, borderRadius: '8px' }}
                          showLineNumbers
                        >
                          {file.content || '// Empty'}
                        </SyntaxHighlighter>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Dialogue History */}
              <div className="flex flex-col h-full overflow-hidden bg-slate-900">
                <div className="p-2 border-b border-slate-800 bg-slate-900/60 text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  Socratic Dialogue History ({inspectedChatHistory.length})
                </div>
                <div className="flex-1 overflow-auto p-3 space-y-3">
                  {inspectedChatHistory.length === 0 ? (
                    <div className="text-xs text-slate-500 italic p-4">No messages exchanged yet.</div>
                  ) : (
                    inspectedChatHistory.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-xl text-xs space-y-1 ${
                          msg.role === 'user'
                            ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-200'
                            : 'bg-slate-950 border border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          {msg.role === 'user' ? 'Student' : 'Socratix'}
                        </div>
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                        {msg.course_reference && (
                          <div className="text-[10px] font-mono text-emerald-400 pt-1">
                            Ref: {msg.course_reference.label}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
