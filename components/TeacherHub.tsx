'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Course, CourseChapter, Lab, StudentLabSession } from '@/types/socratix';
import { getBrowserSupabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  BarChart3,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Users,
  Radio,
  ExternalLink,
} from 'lucide-react';
import TeacherLiveSessionsTab from './TeacherLiveSessionsTab';
import TeacherAnalyticsCoverageTab from './TeacherAnalyticsCoverageTab';
import CourseStudioPanel from './CourseStudioPanel';

export default function TeacherHub() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<(Course & { course_chapters?: CourseChapter[]; labs?: Lab[] }) | null>(null);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [selectedLab, setSelectedLab] = useState<Lab | null>(null);
  const [sessions, setSessions] = useState<StudentLabSession[]>([]);
  const [activeTab, setActiveTab] = useState<'live' | 'analytics' | 'studio'>('live');
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);

  // 1. Fetch courses
  const fetchCourses = useCallback(async () => {
    try {
      const res = await fetch('/api/studio/courses');
      const data = await res.json();
      if (data.courses && Array.isArray(data.courses)) {
        setCourses(data.courses);
        if (!selectedCourse && data.courses.length > 0) {
          setSelectedCourse(data.courses[0]);
        }
      }
    } catch (err) {
      console.error('[TeacherHub] Error fetching courses:', err);
    }
  }, [selectedCourse]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // 2. Fetch course chapters, labs, and student sessions when selected course changes
  const refreshCourseData = useCallback(async () => {
    if (!selectedCourse) return;

    const supabase = getBrowserSupabase();

    // Fetch updated course row, labs, chapters, and sessions
    const [courseRes, labsRes, chaptersRes, sessionsRes] = await Promise.all([
      supabase.from('courses').select('*').eq('id', selectedCourse.id).single(),
      supabase.from('labs').select('*').eq('course_id', selectedCourse.id).order('lab_number', { ascending: true }),
      supabase.from('course_chapters').select('*').eq('course_id', selectedCourse.id).order('chapter_number', { ascending: true }),
      supabase.from('student_lab_sessions').select('*, profiles(display_name, is_guest, email)').eq('course_id', selectedCourse.id),
    ]);

    if (!labsRes.error && labsRes.data) {
      const fetchedLabs = labsRes.data as Lab[];
      setLabs(fetchedLabs);
      if (!selectedLab || !fetchedLabs.some((l) => l.id === selectedLab.id)) {
        setSelectedLab(fetchedLabs[0] || null);
      }
    }

    const fetchedCourse = (!courseRes.error && courseRes.data) ? (courseRes.data as Course) : null;
    const fetchedChapters = (!chaptersRes.error && chaptersRes.data) ? (chaptersRes.data as CourseChapter[]) : [];
    const fetchedLabsList = (!labsRes.error && labsRes.data) ? (labsRes.data as Lab[]) : [];

    setSelectedCourse((prev) => {
      const base = fetchedCourse || prev;
      if (!base) return null;
      return {
        ...base,
        course_chapters: fetchedChapters.length > 0 ? fetchedChapters : prev?.course_chapters || [],
        labs: fetchedLabsList.length > 0 ? fetchedLabsList : prev?.labs || [],
      };
    });

    if (!sessionsRes.error && sessionsRes.data) {
      setSessions(sessionsRes.data as StudentLabSession[]);
    }
  }, [selectedCourse?.id, selectedLab]);

  useEffect(() => {
    refreshCourseData();
  }, [selectedCourse?.id, refreshCourseData]);

  // 3. Supabase Realtime Subscription for Live Sessions
  useEffect(() => {
    if (!selectedCourse) return;

    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`teacher-sessions-${selectedCourse.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_lab_sessions',
          filter: `course_id=eq.${selectedCourse.id}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const { data: updatedRow } = await supabase
              .from('student_lab_sessions')
              .select('*, profiles(display_name, is_guest, email)')
              .eq('id', (payload.new as { id: string }).id)
              .single();

            if (updatedRow) {
              setSessions((prev) => {
                const idx = prev.findIndex((s) => s.id === updatedRow.id);
                if (idx >= 0) {
                  const copy = [...prev];
                  copy[idx] = updatedRow as StudentLabSession;
                  return copy;
                }
                return [updatedRow as StudentLabSession, ...prev];
              });
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            setSessions((prev) => prev.filter((s) => s.id !== deletedId));
          }
        }
      )
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCourse]);

  // Macro KPIs
  const currentLabSessions = sessions.filter((s) => s.lab_id === selectedLab?.id);
  const totalActive = currentLabSessions.length;
  const blockedCount = currentLabSessions.filter((s) => s.status === 'BLOCKED').length;
  const completedCount = currentLabSessions.filter((s) => s.status === 'COMPLETED').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-emerald-400 flex items-center gap-2">
              🦉 Socratix ERP
            </span>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-xs">
              Teacher Hub v2
            </Badge>

            {/* Course Selector */}
            <div className="hidden sm:flex items-center gap-2 ml-4 pl-4 border-l border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Course:</span>
              <select
                value={selectedCourse?.id || ''}
                onChange={(e) => {
                  const target = courses.find((c) => c.id === e.target.value);
                  if (target) setSelectedCourse(target);
                }}
                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 font-semibold"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Realtime Status Indicator & Shortcut */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 text-xs">
              <Radio
                className={`w-3.5 h-3.5 ${
                  isRealtimeActive ? 'text-emerald-400 animate-pulse' : 'text-slate-500'
                }`}
              />
              <span className="text-[11px] text-slate-400">
                {isRealtimeActive ? 'Realtime Connected' : 'Connecting...'}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('/student', '_blank')}
              className="text-xs border-slate-700 hover:bg-slate-800 text-slate-300 gap-1.5 h-8"
              title="Open Student Workspace in a new window for side-by-side demo"
            >
              <span>Student View</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Navigation Tabs & KPI Banner */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between border-t border-slate-800/60 pt-1">
          {/* 3 Tabs */}
          <nav className="flex space-x-1">
            <button
              onClick={() => setActiveTab('live')}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-semibold transition-colors ${
                activeTab === 'live'
                  ? 'border-emerald-400 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>📡 Live Lab Sessions</span>
              {blockedCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-mono">
                  {blockedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-semibold transition-colors ${
                activeTab === 'analytics'
                  ? 'border-emerald-400 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>📊 Class Analytics & Coverage</span>
            </button>

            <button
              onClick={() => setActiveTab('studio')}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-semibold transition-colors ${
                activeTab === 'studio'
                  ? 'border-emerald-400 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>🧠 Course Studio</span>
            </button>
          </nav>

          {/* Quick Stats Pill */}
          <div className="hidden md:flex items-center gap-4 text-xs font-mono text-slate-400 pb-2">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <strong className="text-slate-200">{totalActive}</strong> students
            </span>
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <strong className="text-rose-400">{blockedCount}</strong> blocked
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <strong className="text-emerald-400">{completedCount}</strong> finished
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!selectedCourse ? (
          <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 space-y-3">
            <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-base font-medium text-slate-300">No Course Selected</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Please create a course or select one from the dropdown above to manage live sessions and analytics.
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'live' && (
              <TeacherLiveSessionsTab
                course={selectedCourse}
                labs={labs}
                selectedLab={selectedLab}
                onSelectLab={(l) => setSelectedLab(l)}
                sessions={sessions}
                onRefresh={refreshCourseData}
              />
            )}

            {activeTab === 'analytics' && (
              <TeacherAnalyticsCoverageTab
                course={selectedCourse}
                labs={labs}
                selectedLab={selectedLab}
                sessions={sessions}
              />
            )}

            {activeTab === 'studio' && (
              <CourseStudioPanel
                course={selectedCourse}
                onCourseUpdated={refreshCourseData}
                onOpenAnalyticsTab={() => setActiveTab('analytics')}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
