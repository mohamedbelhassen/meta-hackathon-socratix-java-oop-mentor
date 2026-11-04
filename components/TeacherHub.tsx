'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Plus,
  Trash2,
  Compass,
  ChevronDown,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import TeacherLiveSessionsTab from './TeacherLiveSessionsTab';
import ThemeToggle from './ThemeToggle';

// Dynamic imports for secondary tabs and modals to reduce initial JS bundle (PERF-08)
const TeacherAnalyticsTab = dynamic(() => import('./TeacherAnalyticsTab'), { ssr: false });
const TeacherCoverageTab = dynamic(() => import('./TeacherCoverageTab'), { ssr: false });
const CourseStudioPanel = dynamic(() => import('./CourseStudioPanel'), { ssr: false });
const CreateCourseModal = dynamic(() => import('./CreateCourseModal'), { ssr: false });
const DeleteCourseModal = dynamic(() => import('./DeleteCourseModal'), { ssr: false });

export default function TeacherHub() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<(Course & { course_chapters?: CourseChapter[]; labs?: Lab[] }) | null>(null);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [selectedLab, setSelectedLab] = useState<Lab | null>(null);
  const [sessions, setSessions] = useState<StudentLabSession[]>([]);
  const [activeTab, setActiveTab] = useState<'live' | 'analytics' | 'coverage' | 'studio'>('live');
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);

  // In-memory cache for student profiles to eliminate N+1 queries on Realtime updates (PERF-03)
  const profilesCacheRef = useRef<Map<string, { display_name: string; is_guest: boolean; email?: string | null }>>(new Map());

  // Modals for Course Management (Point #3)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const courseId = selectedCourse?.id;

  // 1. Fetch courses once on mount
  const fetchCourses = useCallback(async () => {
    try {
      const res = await fetch('/api/studio/courses');
      const data = await res.json();
      if (data.courses && Array.isArray(data.courses) && data.courses.length > 0) {
        setCourses(data.courses);
        setSelectedCourse((prev) => prev || data.courses[0]);
      }
    } catch (err) {
      console.error('[TeacherHub] Error fetching courses:', err);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // 2. Fetch course chapters, labs, and student sessions when active course id changes
  const refreshCourseData = useCallback(async () => {
    if (!courseId) return;

    const supabase = getBrowserSupabase();

    // Fetch updated course row, labs, chapters, and sessions (excluding raw pages_json for PERF-01/PERF-03)
    const [courseRes, labsRes, chaptersRes, sessionsRes] = await Promise.all([
      supabase.from('courses').select('id, code, title, description, content_language, tutor_language, file_extensions, competency_matrix, compiled_knowledge_base, compiled_tutor_prompt, is_published, teacher_id').eq('id', courseId).single(),
      supabase.from('labs').select('id, course_id, lab_number, code, title, title_i18n, description, description_i18n, pdf_url, is_active, covered_micro_concepts, activities, demo_presets').eq('course_id', courseId).order('lab_number', { ascending: true }),
      supabase.from('course_chapters').select('id, course_id, chapter_number, code, title, title_i18n, pdf_url, markdown_content, key_analogies').eq('course_id', courseId).order('chapter_number', { ascending: true }),
      supabase.from('student_lab_sessions').select('*, profiles(display_name, is_guest, email)').eq('course_id', courseId),
    ]);

    if (!labsRes.error && labsRes.data) {
      const fetchedLabs = labsRes.data as unknown as Lab[];
      setLabs(fetchedLabs);
      setSelectedLab((prev) => {
        if (!prev || !fetchedLabs.some((l) => l.id === prev.id)) {
          return fetchedLabs[0] || null;
        }
        return prev;
      });
    }

    const fetchedCourse = (!courseRes.error && courseRes.data) ? (courseRes.data as unknown as Course) : null;
    const fetchedChapters = (!chaptersRes.error && chaptersRes.data) ? (chaptersRes.data as unknown as CourseChapter[]) : [];
    const fetchedLabsList = (!labsRes.error && labsRes.data) ? (labsRes.data as unknown as Lab[]) : [];

    setSelectedCourse((prev) => {
      const base = fetchedCourse || prev;
      if (!base) return null;
      const isSameCourse = prev?.id === base.id;
      return {
        ...base,
        course_chapters: !chaptersRes.error
          ? fetchedChapters
          : (isSameCourse ? prev?.course_chapters || [] : []),
        labs: !labsRes.error
          ? fetchedLabsList
          : (isSameCourse ? prev?.labs || [] : []),
      };
    });

    if (!sessionsRes.error && sessionsRes.data) {
      const fetchedSessions = sessionsRes.data as StudentLabSession[];
      fetchedSessions.forEach((s) => {
        if (s.student_id && s.profiles) {
          profilesCacheRef.current.set(s.student_id, s.profiles);
        }
      });
      setSessions(fetchedSessions);
    }
  }, [courseId]);

  useEffect(() => {
    if (courseId) {
      refreshCourseData();
    }
  }, [courseId, refreshCourseData]);

  // 3. Supabase Realtime Subscription for Live Sessions (O(1) profiles cache without N+1 queries)
  useEffect(() => {
    if (!courseId) return;

    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`teacher-sessions-${courseId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_lab_sessions',
          filter: `course_id=eq.${courseId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const updatedRow = payload.new as StudentLabSession;
            let profile = profilesCacheRef.current.get(updatedRow.student_id);

            // Fetch profile only if student has never been cached before
            if (!profile) {
              const { data: profData } = await supabase
                .from('profiles')
                .select('display_name, is_guest, email')
                .eq('id', updatedRow.student_id)
                .maybeSingle();

              if (profData) {
                profile = profData;
                profilesCacheRef.current.set(updatedRow.student_id, profData);
              }
            }

            const enriched: StudentLabSession = {
              ...updatedRow,
              profiles: profile || undefined,
            };

            setSessions((prev) => {
              const idx = prev.findIndex((s) => s.id === enriched.id);
              if (idx >= 0) {
                // If enriched payload lacks profile but prev had one, preserve it
                if (!enriched.profiles && prev[idx].profiles) {
                  enriched.profiles = prev[idx].profiles;
                }
                const copy = [...prev];
                copy[idx] = enriched;
                return copy;
              }
              return [enriched, ...prev];
            });
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
  }, [courseId]);

  // Macro KPIs
  const currentLabSessions = sessions.filter((s) => s.lab_id === selectedLab?.id);
  const totalActive = currentLabSessions.length;
  const blockedCount = currentLabSessions.filter((s) => s.status === 'BLOCKED').length;
  const completedCount = currentLabSessions.filter((s) => s.status === 'COMPLETED').length;

  const handleCourseCreated = (newCourse: Course) => {
    setCourses((prev) => [newCourse, ...prev.filter((c) => c.id !== newCourse.id)]);
    setSelectedCourse(newCourse);
    setActiveTab('studio');
  };

  const handleCourseDeleted = (deletedCourseId: string) => {
    setCourses((prev) => {
      const remaining = prev.filter((c) => c.id !== deletedCourseId);
      setSelectedCourse(remaining[0] || null);
      return remaining;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              🦉 Socratix ERP
            </span>
            <Badge variant="outline" className="border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-transparent text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
              Teacher Hub v2
            </Badge>

            {/* Course Selector & Actions */}
            <div className="hidden sm:flex items-center gap-2 ml-4 pl-4 border-l border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-700 dark:text-slate-400 font-semibold">Course:</span>
              <div className="relative inline-flex items-center">
                <select
                  value={selectedCourse?.id || ''}
                  onChange={(e) => {
                    const target = courses.find((c) => c.id === e.target.value);
                    if (target) {
                      setSelectedLab(null);
                      setLabs([]);
                      setSelectedCourse({
                        ...target,
                        course_chapters: [],
                        labs: [],
                      });
                    }
                  }}
                  className="appearance-none bg-white dark:bg-slate-950 border border-slate-300 hover:border-slate-400 dark:border-slate-700 text-[#0f172a] dark:text-slate-100 text-xs rounded-xl pl-3 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] font-semibold min-w-[220px] max-w-[360px] xl:max-w-[440px] truncate transition-all shadow-xs cursor-pointer"
                  title={selectedCourse ? `${selectedCourse.title} (${selectedCourse.code})` : 'Select course'}
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900 text-[#0f172a] dark:text-[#f1f5f9]">
                      {c.title} ({c.code})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute right-2.5 pointer-events-none" />
              </div>

              {/* Create New Course */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
                className="h-8 text-xs border-emerald-400 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-transparent hover:bg-emerald-100 dark:hover:bg-emerald-500/10 px-2.5 gap-1.5 font-semibold"
                title="Create a new course in Course Studio"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden md:inline">New Course</span>
              </Button>

              {/* Delete Active Course */}
              {selectedCourse && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="h-8 w-8 p-0 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 rounded-lg transition-all"
                  title={`Delete course ${selectedCourse.code} (Protected by Jury PIN)`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Realtime Status Indicator, Theme Switcher & Shortcut */}
          <div className="flex items-center gap-2.5">
            <ThemeToggle size="sm" />

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs shadow-xs">
              <Radio
                className={`w-3.5 h-3.5 ${
                  isRealtimeActive ? 'text-[#059669] dark:text-emerald-400 animate-pulse' : 'text-slate-400 dark:text-slate-500'
                }`}
              />
              <span className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                {isRealtimeActive ? 'Realtime Connected' : 'Connecting...'}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('/student', '_blank')}
              className="h-8 text-xs border border-emerald-400 dark:border-emerald-500/40 text-[#059669] dark:text-emerald-400 bg-emerald-50 dark:bg-transparent hover:bg-[#059669] hover:text-white dark:hover:bg-emerald-500/20 px-3 gap-1.5 font-semibold rounded-lg shadow-sm transition-all"
              title="Open Student Workspace in a new window for side-by-side demo"
            >
              <span>Student View</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Navigation Tabs & KPI Banner */}
        <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between border-t border-slate-200 dark:border-slate-800/60">
          {/* 4 Tabs */}
          <nav className="flex space-x-1">
            <button
              onClick={() => setActiveTab('live')}
              className={`flex items-center gap-1.5 py-2 px-3 border-b-2 text-xs font-bold transition-all ${
                activeTab === 'live'
                  ? 'border-[#059669] text-[#059669]'
                  : 'border-transparent text-slate-500 hover:text-[#059669] dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-500/30'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>📡 Live Lab Sessions</span>
              {blockedCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-400 text-[10px] font-bold font-mono">
                  {blockedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1.5 py-2 px-3 border-b-2 text-xs font-bold transition-all ${
                activeTab === 'analytics'
                  ? 'border-[#059669] text-[#059669]'
                  : 'border-transparent text-slate-500 hover:text-[#059669] dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-500/30'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>📊 Class Analytics</span>
            </button>

            <button
              onClick={() => setActiveTab('coverage')}
              className={`flex items-center gap-1.5 py-2 px-3 border-b-2 text-xs font-bold transition-all ${
                activeTab === 'coverage'
                  ? 'border-[#059669] text-[#059669]'
                  : 'border-transparent text-slate-500 hover:text-[#059669] dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-500/30'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>🧭 Curriculum Coverage</span>
            </button>

            <button
              onClick={() => setActiveTab('studio')}
              className={`flex items-center gap-1.5 py-2 px-3 border-b-2 text-xs font-bold transition-all ${
                activeTab === 'studio'
                  ? 'border-[#059669] text-[#059669]'
                  : 'border-transparent text-slate-500 hover:text-[#059669] dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-500/30'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>🧠 Course Studio</span>
            </button>
          </nav>

          {/* Quick Stats Pill */}
          <div className="hidden md:flex items-center gap-3.5 text-xs font-mono text-slate-700 dark:text-slate-400 py-1.5 font-medium">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <strong className="text-[#0f172a] dark:text-slate-200 font-bold">{totalActive}</strong> students
            </span>
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <strong className="text-rose-700 dark:text-rose-400 font-bold">{blockedCount}</strong> blocked
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400" />
              <strong className="text-[#059669] dark:text-emerald-400 font-bold">{completedCount}</strong> finished
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {!selectedCourse ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-slate-600 dark:text-slate-400 space-y-4 max-w-xl mx-auto my-8 shadow-xl">
            <BookOpen className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto" />
            <div className="space-y-1">
              <p className="text-base font-semibold text-slate-900 dark:text-slate-300">No Course Selected</p>
              <p className="text-xs text-slate-600 dark:text-slate-500 max-w-md mx-auto">
                Please create a course or select one from the dropdown above to manage live sessions and analytics.
              </p>
            </div>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              size="sm"
              className="bg-[#059669] hover:bg-[#047857] text-white text-xs gap-1.5 font-semibold px-4 rounded-xl shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Course</span>
            </Button>
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
                onOpenStudioTab={() => setActiveTab('studio')}
              />
            )}

            {activeTab === 'analytics' && (
              <TeacherAnalyticsTab
                course={selectedCourse}
                labs={labs}
                selectedLab={selectedLab}
                onSelectLab={(l) => setSelectedLab(l)}
                sessions={sessions}
                onOpenStudioTab={() => setActiveTab('studio')}
                onOpenCoverageTab={() => setActiveTab('coverage')}
              />
            )}

            {activeTab === 'coverage' && (
              <TeacherCoverageTab
                course={selectedCourse}
                labs={labs}
                onCourseUpdated={refreshCourseData}
                onOpenStudioTab={() => setActiveTab('studio')}
              />
            )}

            {activeTab === 'studio' && (
              <CourseStudioPanel
                course={selectedCourse}
                onCourseUpdated={refreshCourseData}
                onOpenAnalyticsTab={() => setActiveTab('coverage')}
                onCreateCourse={() => setIsCreateModalOpen(true)}
                onDeleteCourse={() => setIsDeleteModalOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* Course Management Modals (Point #3) */}
      <CreateCourseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCourseCreated={handleCourseCreated}
      />
      <DeleteCourseModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        course={selectedCourse}
        onCourseDeleted={handleCourseDeleted}
      />
    </div>
  );
}
