'use client';

import React, { useState } from 'react';
import {
  Course,
  CourseChapter,
  Lab,
  StudentLabSession,
  ChatMessage,
  DemoPresetFile,
  StructuredCourseReference,
} from '@/types/socratix';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getBrowserSupabase } from '@/lib/supabase';
import { formatLabOptionLabel } from '@/lib/utils';
import SmartSlideViewerModal from './SmartSlideViewerModal';
import TeacherMilestonesBreakdownModal from './TeacherMilestonesBreakdownModal';
import { formatSlideCitationLabel } from '@/lib/pdf-cleaner';
import { reconcileMicroCompetenciesWithProgress } from '@/lib/telemetry-merger';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Code2,
  ExternalLink,
  MessageSquare,
  RotateCcw,
  Search,
  Sparkles,
  Users,
  X,
  Layers,
  Monitor,
  ChevronDown,
} from 'lucide-react';
import { CodeBlockHighlighter } from './CodeBlockHighlighter';

interface TeacherLiveSessionsTabProps {
  course: Course & { course_chapters?: CourseChapter[] };
  labs: Lab[];
  selectedLab: Lab | null;
  onSelectLab: (lab: Lab) => void;
  sessions: StudentLabSession[];
  onRefresh: () => void;
  onOpenStudioTab?: () => void;
}

export default function TeacherLiveSessionsTab({
  course,
  labs,
  selectedLab,
  onSelectLab,
  sessions,
  onRefresh,
  onOpenStudioTab,
}: TeacherLiveSessionsTabProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'BLOCKED' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);

  const hasLabs = labs.length > 0;
  const chaptersCount = course.course_chapters?.length || 0;
  const isCompiled = Boolean(course.compiled_knowledge_base);

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
      remediated?: boolean;
    }>;
  } | null>(null);

  // Inspector Drawer State
  const [inspectingSession, setInspectingSession] = useState<StudentLabSession | null>(null);
  const [inspectedCodeFiles, setInspectedCodeFiles] = useState<DemoPresetFile[]>([]);
  const [inspectedChatHistory, setInspectedChatHistory] = useState<ChatMessage[]>([]);
  const [isLoadingInspection, setIsLoadingInspection] = useState(false);

  // Smart Slide Viewer Modal State for Teacher Drawer
  const [selectedSlideReference, setSelectedSlideReference] = useState<StructuredCourseReference | null>(null);
  const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);

  // Milestone Breakdown Modal State
  const [selectedSessionForMilestones, setSelectedSessionForMilestones] = useState<StudentLabSession | null>(null);

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
  const bottleneckMap = new Map<string, { activityId: string; milestoneId: string; students: StudentLabSession[] }>();

  for (const s of blockedSessions) {
    if (s.current_milestone_id) {
      const actId = s.current_activity_id || 'act_1';
      const mId = s.current_milestone_id;
      const key = `${actId}::${mId}`;
      const entry = bottleneckMap.get(key) || { activityId: actId, milestoneId: mId, students: [] };
      entry.students.push(s);
      bottleneckMap.set(key, entry);
    }
  }

  let bottleneckAlert: {
    activityId: string;
    milestoneId: string;
    milestoneTitle: string;
    students: StudentLabSession[];
  } | null = null;

  for (const entry of Array.from(bottleneckMap.values())) {
    if (entry.students.length >= 2) {
      let mTitle = entry.milestoneId;
      selectedLab?.activities?.forEach((a) => {
        const found = a.milestones?.find((m) => m.id === entry.milestoneId);
        if (found) mTitle = found.title;
      });

      bottleneckAlert = {
        activityId: entry.activityId,
        milestoneId: entry.milestoneId,
        milestoneTitle: mTitle,
        students: entry.students,
      };
      break;
    }
  }

  // Populate Demo Class in 1 click
  const handleSeedDemoClass = async () => {
    if (!selectedLab) return;
    setIsSeedingDemo(true);
    try {
      const supabase = getBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/sessions/seed-demo-class', {
        method: 'POST',
        headers,
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
      // 1. Fetch chat history with teacher authorization
      const supabase = getBrowserSupabase();
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (authSession?.access_token) {
        headers['Authorization'] = `Bearer ${authSession.access_token}`;
      }

      const res = await fetch(
        `/api/sessions/context?studentId=${session.student_id}&labId=${session.lab_id}`,
        { headers }
      );
      const data = await res.json();
      setInspectedChatHistory(data.messages || []);

      // 2. Request live workspace dump via Realtime Broadcast
      const channel = supabase.channel('workspace-sync');

      let receivedDump = false;
      let channelRemoved = false;
      const cleanupChannel = () => {
        if (!channelRemoved) {
          channelRemoved = true;
          supabase.removeChannel(channel);
        }
      };

      channel
        .on('broadcast', { event: 'WORKSPACE_DUMP_RESPONSE' }, ({ payload }) => {
          if (payload?.studentId === session.student_id && payload.files) {
            receivedDump = true;
            setInspectedCodeFiles(payload.files);
            setIsLoadingInspection(false);
            cleanupChannel();
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
        cleanupChannel();
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
      const supabase = getBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/sessions/reset', {
        method: 'POST',
        headers,
        body: JSON.stringify({ studentId, labId }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        alert(errJson.error || 'Failed to reset student session.');
        return;
      }

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
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
        {/* Lab Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-bold text-slate-700 dark:text-slate-400">Target Lab:</span>
          {hasLabs ? (
            <div className="relative inline-flex items-center">
              <select
                value={selectedLab?.id || ''}
                onChange={(e) => {
                  const target = labs.find((l) => l.id === e.target.value);
                  if (target) onSelectLab(target);
                }}
                className="appearance-none bg-white dark:bg-slate-950 border border-slate-300 hover:border-slate-400 dark:border-slate-700 text-[#0f172a] dark:text-slate-100 text-xs rounded-xl pl-3 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] font-semibold shadow-xs transition cursor-pointer"
              >
                {labs.map((l) => (
                  <option key={l.id} value={l.id} className="bg-white dark:bg-slate-900 text-[#0f172a] dark:text-[#f1f5f9]">
                    {formatLabOptionLabel(l.code, l.title)}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute right-2.5 pointer-events-none" />
            </div>
          ) : (
            <div className="relative inline-flex items-center">
              <select
                disabled
                value=""
                className="appearance-none bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-500 text-xs rounded-xl pl-3 pr-8 py-1.5 cursor-not-allowed italic font-medium"
              >
                <option value="">No Practical Labs (TP) yet</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none opacity-50" />
            </div>
          )}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs shadow-xs">
          {(['ALL', 'BLOCKED', 'IN_PROGRESS', 'COMPLETED'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              disabled={!hasLabs}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                !hasLabs
                  ? 'text-slate-400 cursor-not-allowed'
                  : statusFilter === filter
                  ? 'bg-white dark:bg-slate-800 text-[#059669] dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-transparent'
                  : 'text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
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
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={!hasLabs}
              placeholder="Search student or PC..."
              className="h-8 pl-8 pr-7 text-xs bg-white dark:bg-slate-950 border border-slate-300 hover:border-slate-400 dark:border-slate-700 text-[#0f172a] dark:text-slate-100 w-44 rounded-xl focus-visible:ring-2 focus-visible:ring-[#059669]/20 focus-visible:border-[#059669] disabled:opacity-50 shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-100 p-0.5 rounded-full hover:bg-slate-800 transition"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Button
            size="sm"
            onClick={handleSeedDemoClass}
            disabled={isSeedingDemo || !selectedLab || !hasLabs}
            title={
              !hasLabs
                ? 'Upload lab PDFs in Course Studio (Step 4) before populating demo sessions.'
                : 'Seed dynamic test sessions for active lab'
            }
            className={`h-8 text-xs gap-1.5 px-3 rounded-lg shadow-sm transition-all ${
              !hasLabs
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isSeedingDemo ? 'Seeding...' : '🎭 Populate Demo Class'}
          </Button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. INCOMPLETE COURSE SETUP BANNER (When labs.length === 0) */}
      {/* ==================================================================== */}
      {!hasLabs ? (
        <div className="p-8 sm:p-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-center max-w-2xl mx-auto my-6 space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Course Setup Incomplete for Live Lab Sessions
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
              Live workstation telemetry and the <strong>Populate Demo Class</strong> sandbox require at least one Practical Lab (TP) assignment. Complete your course configuration in Course Studio.
            </p>
          </div>

          {/* Step checklist preview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left text-xs bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-slate-300">
                {chaptersCount > 0 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                )}
                <span>1. Chapters ({chaptersCount})</span>
              </div>
              <p className="text-[10px] text-slate-500">
                {chaptersCount > 0 ? 'Lecture slides uploaded' : 'Upload lecture PDFs'}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-slate-300">
                {isCompiled ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                )}
                <span>2. Compiled KB</span>
              </div>
              <p className="text-[10px] text-slate-500">
                {isCompiled ? 'Knowledge base synthesized' : 'Synthesize curriculum in Studio'}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>3. Practical Labs (0)</span>
              </div>
              <p className="text-[10px] text-amber-700 dark:text-amber-400/80 font-medium">
                Upload & decompose TP PDFs
              </p>
            </div>
          </div>

          {onOpenStudioTab && (
            <Button
              type="button"
              onClick={onOpenStudioTab}
              className="bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs h-9 px-4 rounded-xl shadow-md gap-1.5 transition-all"
            >
              <span>Open Course Studio (Step 4: Upload Lab PDFs)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* ==================================================================== */}
          {/* 2b. CLASSROOM BOTTLENECK DETECTOR ALERT */}
          {/* ==================================================================== */}
          {bottleneckAlert && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-500/40 rounded-2xl flex items-start gap-3.5 shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="p-2 bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30 rounded-xl mt-0.5 shrink-0">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-black text-rose-900 dark:text-rose-300 text-sm">Classroom Bottleneck Detected</span>
                  <Badge className="bg-rose-200/90 dark:bg-rose-500/20 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30 text-[10px] font-bold">
                    {bottleneckAlert.students.length} Students Stuck
                  </Badge>
                </div>
                <p className="text-slate-800 dark:text-slate-300 mt-1.5 leading-relaxed">
                  <span className="font-bold text-[#0f172a] dark:text-white underline decoration-rose-400">
                    {bottleneckAlert.students
                      .map((s) => `${s.profiles?.display_name || 'Student'} (${s.seat_label})`)
                      .join(', ')}
                  </span>{' '}
                  are simultaneously blocked on{' '}
                  <span className="font-bold text-rose-800 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/60 px-1.5 py-0.5 rounded border border-rose-300 dark:border-rose-800">
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase font-bold text-slate-700 dark:text-slate-400 tracking-wider">
                    <th className="py-2.5 px-3.5">Student & Workstation</th>
                    <th className="py-2.5 px-3.5">Lab & Activity Progress</th>
                    <th className="py-2.5 px-3.5">Covered Micro-Competencies (Drill-Down)</th>
                    <th className="py-2.5 px-3.5">Status</th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No student sessions found for this lab.</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Ask students to connect on <span className="font-mono text-[#059669] dark:text-emerald-400 font-bold">/student</span>, or click <strong className="text-slate-900 dark:text-slate-300 font-bold">&ldquo;🎭 Populate Demo Class&rdquo;</strong> above to generate test sessions instantly.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((session) => {
                      const microState = reconcileMicroCompetenciesWithProgress(
                        session.micro_competencies_state || {},
                        session.activities_progress || {},
                        session.progress_percent || 0
                      );
                      const isBlocked = session.status === 'BLOCKED';
                      const isCompleted = session.status === 'COMPLETED';

                      const curActivity = selectedLab?.activities?.find((a) => a.id === session.current_activity_id);
                      const curMilestone = curActivity?.milestones?.find((m) => m.id === session.current_milestone_id);
                      const activityLabel = curActivity
                        ? `Act. ${curActivity.order}: ${curActivity.title}`
                        : (session.current_activity_id ? `Activity ${session.current_activity_id}` : 'General');
                      const milestoneLabel = curMilestone
                        ? `Jalon ${curMilestone.order}: ${curMilestone.title}`
                        : (session.current_milestone_id ? `Jalon ${session.current_milestone_id}` : '');

                      return (
                        <tr
                          key={session.id}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                            isBlocked ? 'bg-rose-50/40 dark:bg-rose-950/10' : ''
                          }`}
                        >
                          {/* Col 1: Student & Workstation */}
                          <td className="py-2.5 px-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-slate-800 dark:text-slate-300 text-[11px]">
                                {session.profiles?.display_name?.[0] || 'S'}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-200 text-xs">
                                  <span>{session.profiles?.display_name || 'Anonymous Student'}</span>
                                  {session.profiles?.is_guest && (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-amber-100 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-400 font-semibold">
                                      Guest
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-400 font-mono font-medium mt-0.5">
                                  <Monitor className="w-2.5 h-2.5 text-slate-500" />
                                  <span>{session.seat_label || 'PC --'}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Col 2: Progress (Interactive Milestones Breakdown) */}
                          <td className="py-2.5 px-3.5 min-w-[190px]">
                            <button
                              type="button"
                              onClick={() => setSelectedSessionForMilestones(session)}
                              title="Click to view detailed milestones breakdown across all activities"
                              className="w-full text-left space-y-1 p-1 -m-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:ring-1 hover:ring-cyan-500/30 transition-all cursor-pointer group"
                            >
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-700 dark:text-slate-400 font-semibold group-hover:text-emerald-700 dark:group-hover:text-cyan-300 transition-colors flex items-center gap-1">
                                  <span>Total Progress</span>
                                  <span className="text-[9px] opacity-0 group-hover:opacity-100 text-emerald-600 dark:text-cyan-400 font-normal transition-opacity">
                                    &bull; Details &rarr;
                                  </span>
                                </span>
                                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                  {session.progress_percent}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden group-hover:ring-1 group-hover:ring-emerald-500/40 transition">
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
                              <div className="text-[10px] truncate transition-colors">
                                <span className="text-slate-800 dark:text-slate-300 font-semibold">{activityLabel}</span>
                                {milestoneLabel && (
                                  <span className="text-slate-600 dark:text-slate-400 font-medium"> &bull; {milestoneLabel}</span>
                                )}
                              </div>
                            </button>
                          </td>

                          {/* Col 3: Micro-Competencies Drill-Down */}
                          <td className="py-2.5 px-3.5">
                            <div className="flex flex-wrap gap-1">
                              {(selectedLab?.covered_micro_concepts || Object.keys(microState)).map((conceptKey) => {
                                const entry = microState[conceptKey];
                                const status = entry?.status || 'UNTESTED';
                                const score = entry?.score ?? 0;
                                const passCount = entry?.occurrences?.filter((o) => o.status === 'PASS').length ?? 0;
                                const totalCount = entry?.occurrences?.length ?? 0;

                                const hasRemediation = entry?.occurrences?.some((o) => o.remediated);

                                let badgeStyle = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-200';
                                if (status === 'MASTERED') badgeStyle = 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 hover:bg-emerald-200 font-semibold';
                                else if (status === 'IN_PROGRESS') badgeStyle = 'bg-amber-100 dark:bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 hover:bg-amber-200 font-semibold';
                                else if (status === 'STRUGGLING') badgeStyle = 'bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/40 hover:bg-rose-200 font-semibold';

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
                                    className={`text-[10px] px-1.5 py-0.5 rounded border font-mono transition-colors flex items-center gap-1 ${badgeStyle}`}
                                    title={hasRemediation ? `${conceptKey}: Acquis (après remédiation) • Cliquez pour inspecter` : 'Click to view code occurrence drill-down'}
                                  >
                                    <span>{conceptKey}</span>
                                    {totalCount > 0 && (
                                      <span className="font-semibold flex items-center gap-0.5">
                                        ({passCount}/{totalCount})
                                        {hasRemediation && (
                                          <Sparkles className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                        )}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </td>

                          {/* Col 4: Status */}
                          <td className="py-2.5 px-3.5">
                            {isBlocked ? (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-400 text-[11px] font-bold animate-pulse">
                                <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                <span>BLOCKED</span>
                                <span className="text-[9px] bg-rose-200 dark:bg-rose-950/60 px-1 rounded text-rose-900 dark:text-rose-300 font-mono">
                                  {session.consecutive_errors}
                                </span>
                              </div>
                            ) : isCompleted ? (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-400 text-[11px] font-bold">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>COMPLETED</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-400 text-[11px] font-bold">
                                <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                <span>IN PROGRESS</span>
                              </div>
                            )}
                          </td>

                          {/* Col 5: Actions */}
                          <td className="py-2.5 px-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenInspector(session)}
                                className="h-7.5 text-xs font-semibold border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 hover:text-emerald-700 dark:text-slate-200 dark:hover:text-emerald-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-xs gap-1.5 px-2.5 rounded-xl transition"
                              >
                                <Code2 className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400" />
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
        </>
      )}

      {/* ==================================================================== */}
      {/* 4. DRILL-DOWN OCCURRENCE MODAL / POPOVER */}
      {/* ==================================================================== */}
      {drillDownData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl max-h-[85vh] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-[#0f172a] dark:text-slate-100 text-sm">
                  {drillDownData.conceptKey} &bull; {drillDownData.studentName}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                onClick={() => setDrillDownData(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
              <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl flex items-center justify-between text-xs shrink-0">
                <span className="text-slate-700 dark:text-slate-400 font-semibold">Score & Summary:</span>
                <span className={`font-bold ${drillDownData.score === 100 ? 'text-emerald-700 dark:text-emerald-400' : drillDownData.score > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-rose-700 dark:text-rose-400'}`}>
                  {drillDownData.score}%
                </span>
              </div>
              <p className="text-xs text-slate-800 dark:text-slate-300 leading-relaxed font-medium shrink-0">{drillDownData.summary}</p>

              <div className="pt-2">
                <div className="text-[10px] uppercase font-bold text-slate-700 dark:text-slate-400 mb-2">
                  Inspected Code Locations ({drillDownData.occurrences.length})
                </div>
                {drillDownData.occurrences.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No specific code locations evaluated yet.</p>
                ) : (
                  <div className="space-y-2">
                    {drillDownData.occurrences.map((occ, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 shadow-sm ${
                          occ.status === 'PASS'
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-950 dark:text-emerald-200'
                            : 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/30 text-rose-950 dark:text-rose-200'
                        }`}
                      >
                        {occ.status === 'PASS' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-[#0f172a] dark:text-white">
                              {occ.location}
                            </span>
                            {occ.remediated && (
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 px-1.5 py-0.5 rounded font-sans font-semibold">
                                Acquis (après remédiation)
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-700 dark:text-slate-300 leading-snug">{occ.note}</div>
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
          <div className="w-full max-w-3xl h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-[#059669] dark:text-emerald-400" />
                  Live Inspection: {inspectingSession.profiles?.display_name} ({inspectingSession.seat_label})
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                  {course.title} &bull; {selectedLab?.code}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition"
                onClick={() => setInspectingSession(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Drawer Body: Code & Dialogue */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
              {/* Left Column: Student Code */}
              <div className="border-r border-slate-200 dark:border-slate-800 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950/70">
                <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-xs font-bold text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400" />
                  Live Code Snapshot
                </div>
                <div className="flex-1 overflow-auto p-3">
                  {isLoadingInspection ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400 p-4 font-medium">Syncing live code from student workspace...</div>
                  ) : (
                    inspectedCodeFiles.map((file, idx) => (
                      <div key={idx} className="mb-4">
                        <div className="text-[11px] font-mono font-bold text-[#059669] dark:text-emerald-400 mb-1 px-1">{file.name}</div>
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#090d16] overflow-hidden shadow-xs">
                          <CodeBlockHighlighter
                            language={file.name.split('.').pop()?.toLowerCase() || 'java'}
                            code={file.content || '// Empty'}
                            fontSize="11px"
                            showLineNumbers
                            customStyle={{ background: 'transparent', margin: 0 }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Dialogue History */}
              <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900">
                <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs font-bold text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400" />
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
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-emerald-950 dark:text-emerald-200'
                            : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300'
                        }`}
                      >
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {msg.role === 'user' ? 'Student' : 'Socratix'}
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed font-medium">{msg.content}</div>
                        {msg.course_reference && (
                          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSlideReference(msg.course_reference as StructuredCourseReference);
                                setIsSlideModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-[#059669] dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors text-[11px] font-semibold text-left"
                              title="Inspect referenced course slide in Smart Slide Viewer"
                            >
                              <BookOpen className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate max-w-[280px]">
                                {formatSlideCitationLabel(msg.course_reference as StructuredCourseReference)}
                              </span>
                              <ExternalLink className="w-3 h-3 shrink-0 ml-0.5 opacity-70" />
                            </button>
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

      {/* Smart Slide Viewer Modal for Teacher Inspection */}
      <SmartSlideViewerModal
        isOpen={isSlideModalOpen}
        onClose={() => setIsSlideModalOpen(false)}
        reference={selectedSlideReference}
        courseTitle={course?.title || 'Course Slides'}
        contentLanguage={course?.content_language}
      />

      {/* Teacher Milestones Breakdown Modal across all Activities */}
      <TeacherMilestonesBreakdownModal
        isOpen={Boolean(selectedSessionForMilestones)}
        onClose={() => setSelectedSessionForMilestones(null)}
        session={selectedSessionForMilestones}
        lab={selectedLab}
      />
    </div>
  );
}
