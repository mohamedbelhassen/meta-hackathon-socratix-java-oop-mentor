'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import ThemeToggle from './ThemeToggle';
import SignOutButton from './SignOutButton';
import { getBrowserSupabase } from '@/lib/supabase';
import {
  Course,
  CourseChapter,
  Lab,
  LabActivity,
  DemoPreset,
  DemoPresetFile,
  StudentLabSession,
  StructuredCourseReference,
} from '@/types/socratix';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FolderOpen,
  Send,
  FileCode,
  FileText,
  Sparkles,
  BookOpen,
  RotateCcw,
  Lightbulb,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Layers,
  AlertTriangle,
  Info,
  User,
  LogIn,
  GraduationCap,
} from 'lucide-react';
import {
  CompetencyReport,
  playCelebrationChime,
  triggerCelebrationConfetti,
  replayCelebration,
} from './MilestoneCelebrationModal';

const MilestoneCelebrationModal = dynamic(() => import('./MilestoneCelebrationModal'), { ssr: false });
const SmartSlideViewerModal = dynamic(() => import('./SmartSlideViewerModal'), { ssr: false });
const PdfViewerModal = dynamic(() => import('./PdfViewerModal'), { ssr: false });
const CourseSyllabusModal = dynamic(() => import('./CourseSyllabusModal'), { ssr: false });
const WorkspaceCodeEditor = dynamic(() => import('./WorkspaceCodeEditor'), { ssr: false });
import { cleanInstructionsMarkdown, formatSlideCitationLabel } from '@/lib/pdf-cleaner';
import { formatLabOptionLabel, isJurySandboxEnabled } from '@/lib/utils';
import {
  saveActiveContext,
  loadActiveContext,
  savePresetEdits,
  loadPresetEdits,
  clearPresetEdits,
  saveDirectoryHandle,
  loadDirectoryHandle,
} from '@/lib/workspace-persistence';

export interface StudentPersona {
  id: string;
  name: string;
  role: string;
  email?: string;
  isCustom?: boolean;
  isOnline?: boolean;
  isCurrentUser?: boolean;
  is_guest?: boolean;
}

const DEMO_PERSONAS: StudentPersona[] = [
  { id: '33333333-3333-3333-3333-333333333333', name: 'Bob', role: 'Student', is_guest: true },
  { id: '44444444-4444-4444-4444-444444444444', name: 'Guest Explorer', role: 'Judge / Sandbox', is_guest: true },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Alice', role: 'Student', is_guest: true },
  { id: '55555555-5555-5555-5555-555555555555', name: 'Ines', role: 'Student', is_guest: true },
];

const SEAT_OPTIONS = Array.from({ length: 20 }, (_, i) => `PC ${String(i + 1).padStart(2, '0')}`);

interface ChatItem {
  id: string;
  activityId?: string | null;
  role: 'user' | 'assistant';
  content: string;
  courseReference?: StructuredCourseReference | null;
  latencyMs?: number;
}

// Fallback presets if lab has no custom presets
const DEFAULT_JAVA_PRESETS: DemoPreset[] = [
  {
    key: 'buggy_encapsulation',
    label: 'Buggy Encapsulation',
    description: 'Item price lacks private visibility modifier.',
    preset_type: 'buggy',
    files: [
      {
        name: 'Item.java',
        content: `public class Item {\n  double price; // Missing private modifier!\n  String name;\n\n  public Item(String name, double price) {\n    this.name = name;\n    this.price = price;\n  }\n}`,
      },
      {
        name: 'YallaPOS.java',
        content: `public class YallaPOS {\n  public static void main(String[] args) {\n    Item item = new Item("Coffee", 4.5);\n    item.price = -100.0; // Direct unsafe access!\n  }\n}`,
      },
    ],
  },
  {
    key: 'fixed_encapsulation',
    label: 'Fixed Encapsulation',
    description: 'Item price is private with defensive setter.',
    preset_type: 'solution',
    files: [
      {
        name: 'Item.java',
        content: `public class Item {\n  private double price;\n  private String name;\n\n  public Item(String name, double price) {\n    this.name = name;\n    setPrice(price);\n  }\n\n  public double getPrice() {\n    return price;\n  }\n\n  public void setPrice(double price) {\n    if (price < 0) throw new IllegalArgumentException("Price cannot be negative");\n    this.price = price;\n  }\n}`,
      },
      {
        name: 'YallaPOS.java',
        content: `public class YallaPOS {\n  public static void main(String[] args) {\n    Item item = new Item("Coffee", 4.5);\n    System.out.println("Item price: " + item.getPrice());\n  }\n}`,
      },
    ],
  },
];

export function isSolutionPreset(preset: DemoPreset): boolean {
  if (preset.preset_type === 'solution') return true;
  if (preset.preset_type === 'buggy') return false;
  const key = (preset.key || '').toLowerCase();
  const label = (preset.label || '').toLowerCase();
  return (
    key.endsWith('_solution') ||
    key.includes('fixed') ||
    key.includes('solution') ||
    label.includes('solution') ||
    label.includes('fixed') ||
    label.includes('corrigé')
  );
}

function generateFallbackStarterFiles(
  act: LabActivity | null,
  activeCourse: Course | null,
  existingFiles: DemoPresetFile[] = []
): DemoPresetFile[] {
  const targetFiles = act?.target_files && act.target_files.length > 0
    ? act.target_files
    : [activeCourse?.file_extensions?.[0] ? `index${activeCourse.file_extensions[0]}` : 'index.html'];

  return targetFiles.map((fname) => {
    // If the student already has edited content for this file in previous activity, preserve it!
    const existing = existingFiles.find((f) => f.name.toLowerCase() === fname.toLowerCase());
    if (existing && existing.content && existing.content.trim().length > 20) {
      return existing;
    }

    const lower = fname.toLowerCase();
    if (lower.endsWith('.html') || lower.endsWith('.htm')) {
      return {
        name: fname,
        content: `<!DOCTYPE html>\n<html lang="fr">\n<head>\n  <meta charset="UTF-8">\n  <title>${act?.title || 'Exercice'}</title>\n</head>\n<body>\n  <!-- TODO: ${act?.title || 'Contenu'} -->\n</body>\n</html>\n`,
      };
    }
    if (lower.endsWith('.css')) {
      return {
        name: fname,
        content: `/* Styles — ${act?.title || 'Exercice'} */\n`,
      };
    }
    if (lower.endsWith('.py')) {
      return {
        name: fname,
        content: `# ${fname} — ${act?.title || 'Exercice'}\n`,
      };
    }
    if (lower.endsWith('.c') || lower.endsWith('.cpp')) {
      return {
        name: fname,
        content: `// ${fname} — ${act?.title || 'Exercice'}\n#include <stdio.h>\n\nint main(void) {\n    return 0;\n}\n`,
      };
    }
    if (lower.endsWith('.js') || lower.endsWith('.ts')) {
      return {
        name: fname,
        content: `// ${fname} — ${act?.title || 'Exercice'}\n`,
      };
    }
    if (lower.endsWith('.sql')) {
      return {
        name: fname,
        content: `-- ${fname} — ${act?.title || 'Exercice'}\n`,
      };
    }
    const className = fname.replace(/\.java$/, '');
    return {
      name: fname,
      content: `// ${fname} — Activity ${act?.order || 1}: ${act?.title || 'Exercice'}\npublic class ${className} {\n    public static void main(String[] args) {\n        // TODO: Implement solution for Activity ${act?.order || 1}\n    }\n}\n`,
    };
  });
}

const IGNORED_DIRECTORIES = new Set([
  'node_modules', '.git', '.svn', 'target', 'build', 'dist', 'out', '.next', 'vendor', '.idea', '.vscode', '__pycache__',
]);
const MAX_WORKSPACE_FILES = 30;
const MAX_FILE_BYTES = 64 * 1024; // 64 KB max per file

export default function StudentWorkspace() {
  // Course & Lab Hierarchy
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [chapters, setChapters] = useState<CourseChapter[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [activeLab, setActiveLab] = useState<Lab | null>(null);
  const [activeActivity, setActiveActivity] = useState<LabActivity | null>(null);

  // In-Situ PDF & Syllabus Reader State
  const [activePdfModal, setActivePdfModal] = useState<{ url: string; title: string } | null>(null);
  const [isSyllabusModalOpen, setIsSyllabusModalOpen] = useState(false);

  // Student Persona & Physical Workstation (Point #6: Auth & Registered Students)
  const [registeredStudents, setRegisteredStudents] = useState<StudentPersona[]>([]);
  const [activeStudent, setActiveStudent] = useState<StudentPersona>(DEMO_PERSONAS[0]);
  const [seatLabel, setSeatLabel] = useState('PC 01');
  const [authUser, setAuthUser] = useState<{ id: string; email?: string; name: string; role: 'student' | 'teacher' } | null>(null);

  // Files & Source Mode ('preset' | 'disk')
  const [sourceMode, setSourceMode] = useState<'preset' | 'disk'>('preset');
  const [activePresetKey, setActivePresetKey] = useState<string>('buggy_encapsulation');
  const [workspaceFiles, setWorkspaceFiles] = useState<DemoPresetFile[]>(DEFAULT_JAVA_PRESETS[0].files);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
  const [folderName, setFolderName] = useState<string>('Demo Sandbox');

  // Disk Handle Ref
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const [needsDiskReconnect, setNeedsDiskReconnect] = useState(false);

  // Ref to hold latest workspace state without re-triggering Realtime WebSocket subscriptions
  const latestWorkspaceStateRef = useRef({
    workspaceFiles,
    sourceMode,
    activeCourse,
  });

  useEffect(() => {
    latestWorkspaceStateRef.current = {
      workspaceFiles,
      sourceMode,
      activeCourse,
    };
  }, [workspaceFiles, sourceMode, activeCourse]);

  // Chat & Telemetry Session State
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I am **Socratix**, your Socratic mentor. Click **"🧪 Check"** to evaluate your code, **"💡 Hint"** for a Socratic clue, **"📖 Concept"** for theoretical slides, or ask any question freely.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessionState, setSessionState] = useState<StudentLabSession | null>(null);

  // Modals
  const [activeSlideReference, setActiveSlideReference] = useState<StructuredCourseReference | null>(null);
  const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [completionReport, setCompletionReport] = useState<CompetencyReport | null>(null);
  const [completedMilestone, setCompletedMilestone] = useState<string | null>(null);
  const [isCelebrationOpen, setIsCelebrationOpen] = useState(false);
  const [isBriefExpanded, setIsBriefExpanded] = useState(false);
  const [briefLang, setBriefLang] = useState<'en' | 'fr'>('en');

  // Layout Resizing (50% of screen width initially, freely draggable & customizable)
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(700);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize divider position to 50% of available screen width on mount (or saved custom width)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('socratix_student_panel_width');
        if (saved) {
          const num = Number(saved);
          const maxAllowed = Math.max(800, window.innerWidth * 0.75);
          if (!isNaN(num) && num >= 280 && num <= maxAllowed) {
            setLeftPanelWidth(num);
            return;
          }
        }
      } catch {}
      setLeftPanelWidth(Math.round(window.innerWidth * 0.50));
    }
  }, []);

  // Helper: Get syntax highlighting language
  const getSyntaxLanguage = (filename: string): string => {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.java')) return 'java';
    if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'javascript';
    if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
    if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
    if (lower.endsWith('.css')) return 'css';
    if (lower.endsWith('.kt') || lower.endsWith('.kts')) return 'kotlin';
    if (lower.endsWith('.py')) return 'python';
    if (lower.endsWith('.json')) return 'json';
    if (lower.endsWith('.c') || lower.endsWith('.h')) return 'c';
    if (lower.endsWith('.cpp') || lower.endsWith('.hpp')) return 'cpp';
    if (lower.endsWith('.md')) return 'markdown';
    return 'text';
  };

  // Helper: Read directory files filtered by course extensions (hardened with bounds for PERF-10)
  const readDirectoryRecursive = useCallback(async (
    handle: FileSystemDirectoryHandle,
    extensions: string[],
    pathPrefix = '',
    depth = 0,
    collected: DemoPresetFile[] = []
  ): Promise<DemoPresetFile[]> => {
    if (depth > 5 || collected.length >= MAX_WORKSPACE_FILES) return collected;

    for await (const entry of handle.values()) {
      if (collected.length >= MAX_WORKSPACE_FILES) break;
      const relPath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;

      if (entry.kind === 'directory') {
        if (IGNORED_DIRECTORIES.has(entry.name) || entry.name.startsWith('.')) continue;
        await readDirectoryRecursive(
          entry as FileSystemDirectoryHandle,
          extensions,
          relPath,
          depth + 1,
          collected
        );
      } else if (entry.kind === 'file') {
        const matchesExt = extensions.some((ext) => entry.name.toLowerCase().endsWith(ext.toLowerCase()));
        if (!matchesExt) continue;
        try {
          const file = await (entry as FileSystemFileHandle).getFile();
          if (file.size > MAX_FILE_BYTES) continue;
          const content = await file.text();
          collected.push({ name: relPath, content });
        } catch (err) {
          console.warn(`[StudentWorkspace] Skipping unreadable file ${relPath}:`, err);
        }
      }
    }
    return collected;
  }, []);

  // 1. Initial Load: Fetch Courses
  useEffect(() => {
    async function initCourses() {
      try {
        const res = await fetch('/api/studio/courses');
        const data = await res.json();
        if (data.courses && Array.isArray(data.courses) && data.courses.length > 0) {
          setCourses(data.courses);
          const savedCtx = loadActiveContext();
          const targetCourse = data.courses.find((c: Course) => c.id === savedCtx?.courseId) || data.courses[0];
          setActiveCourse(targetCourse);
          if (savedCtx?.studentId) {
            const p = DEMO_PERSONAS.find((dp) => dp.id === savedCtx.studentId);
            if (p) setActiveStudent(p);
          }
          if (savedCtx?.seatLabel) {
            setSeatLabel(savedCtx.seatLabel);
          }
        }
      } catch (err) {
        console.error('[StudentWorkspace] Failed to fetch courses:', err);
      }
    }
    initCourses();
  }, []);

  // 1b. Synchronize Authenticated User & Registered Students (Point #6: Dual-Track Roster)
  useEffect(() => {
    const supabase = getBrowserSupabase();

    async function syncAuthAndStudents() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let userRole: 'student' | 'teacher' = 'student';
        let currentUserId: string | null = null;
        let displayName = 'My Account';

        if (user) {
          currentUserId = user.id;
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, role, email')
            .eq('id', user.id)
            .maybeSingle();

          userRole = (profile?.role || (user.user_metadata?.role as string) || 'student') as 'student' | 'teacher';
          displayName = profile?.display_name
            || (user.user_metadata?.display_name as string)
            || user.email?.split('@')[0]
            || 'My Account';

          setAuthUser({ id: user.id, email: user.email, name: displayName, role: userRole });
        } else {
          setAuthUser(null);
        }

        // CASE 1: Authenticated Real Student (role === 'student')
        // Strict privacy & IDOR protection: NEVER query other students' profiles or sessions.
        // Lock workspace strictly to their own enrolled account.
        if (currentUserId && userRole === 'student') {
          const selfStudent: StudentPersona = {
            id: currentUserId,
            name: displayName,
            role: 'Student',
            email: user?.email,
            isCustom: true,
            isOnline: true,
            isCurrentUser: true,
            is_guest: false,
          };
          setRegisteredStudents([selfStudent]);
          setActiveStudent(selfStudent);
          saveActiveContext({ studentId: selfStudent.id });
          return;
        }

        // CASE 2: Authenticated Teacher (role === 'teacher')
        // Full pedagogical inspection: query class roster and recent sessions for teacher preview
        if (currentUserId && userRole === 'teacher') {
          const { data: studentProfiles } = await supabase
            .from('profiles')
            .select('id, display_name, email, role, is_guest')
            .eq('role', 'student')
            .eq('is_guest', false)
            .order('display_name', { ascending: true });

          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
          const { data: recentSessions } = await supabase
            .from('student_lab_sessions')
            .select('student_id, updated_at')
            .gte('updated_at', tenMinutesAgo);

          const activeStudentIds = new Set(recentSessions?.map((s) => s.student_id) || []);

          const studentList: StudentPersona[] = (studentProfiles || []).map((sp) => ({
            id: sp.id,
            name: sp.display_name || sp.email?.split('@')[0] || 'Student',
            role: 'Student',
            email: sp.email,
            isCustom: true,
            isOnline: activeStudentIds.has(sp.id),
            isCurrentUser: false,
            is_guest: false,
          }));

          setRegisteredStudents(studentList);

          const savedCtx = loadActiveContext();
          const allPersonas = [...DEMO_PERSONAS, ...studentList];

          if (savedCtx?.studentId && savedCtx.studentId !== currentUserId) {
            const matched = allPersonas.find((p) => p.id === savedCtx.studentId);
            if (matched) {
              setActiveStudent(matched);
              return;
            }
          }

          // Default teacher preview to Guest Explorer or first persona
          const defaultDemo = DEMO_PERSONAS.find((p) => p.name === 'Guest Explorer') || DEMO_PERSONAS[0];
          setActiveStudent(defaultDemo);
          saveActiveContext({ studentId: defaultDemo.id });
          return;
        }

        // CASE 3: Guest / Jury Evaluator / Unauthenticated
        // Strictly zero query for real students: privacy & confidentiality preserved
        setRegisteredStudents([]);
        const savedCtx = loadActiveContext();
        if (savedCtx?.studentId) {
          const matched = DEMO_PERSONAS.find((p) => p.id === savedCtx.studentId);
          if (matched) {
            setActiveStudent(matched);
            return;
          }
        }

        // Default fallback to Bob
        setActiveStudent(DEMO_PERSONAS[0]);
        saveActiveContext({ studentId: DEMO_PERSONAS[0].id });
      } catch (err) {
        console.error('[StudentWorkspace] Failed to sync auth and registered students:', err);
      }
    }

    syncAuthAndStudents();

    const { data: authSub } = supabase.auth.onAuthStateChange(() => {
      syncAuthAndStudents();
    });

    return () => {
      authSub.subscription.unsubscribe();
    };
  }, []);

  // 2. Fetch Labs & Chapters for Active Course
  useEffect(() => {
    if (!activeCourse) return;

    const supabase = getBrowserSupabase();
    async function fetchCourseData() {
      const { data, error } = await supabase
        .from('labs')
        .select('*')
        .eq('course_id', activeCourse!.id)
        .order('lab_number', { ascending: true });

      if (!error && data) {
        setLabs(data as Lab[]);
        const savedCtx = loadActiveContext();
        const initialLab = data.find((l: Lab) => l.id === savedCtx?.labId) || data[0] || null;
        setActiveLab(initialLab);
      }

      const { data: chData, error: chError } = await supabase
        .from('course_chapters')
        .select('id, course_id, chapter_number, code, title, title_i18n, pdf_url, pages_json')
        .eq('course_id', activeCourse!.id)
        .order('chapter_number', { ascending: true });

      if (!chError && chData) {
        setChapters(chData as unknown as CourseChapter[]);
      }
    }
    fetchCourseData();
  }, [activeCourse]);

  // 3. Update Active Activity & Preset when Active Lab Changes
  useEffect(() => {
    if (!activeLab) return;

    const savedCtx = loadActiveContext();
    const act = activeLab.activities?.find((a) => a.id === savedCtx?.activityId)
      || activeLab.activities?.[0]
      || null;
    setActiveActivity(act);

    // Setup Presets scoped to active activity
    const labPresets = activeLab.demo_presets && activeLab.demo_presets.length > 0
      ? activeLab.demo_presets
      : DEFAULT_JAVA_PRESETS;

    const isFirstAct = !act || !activeLab.activities?.length || act.id === activeLab.activities[0]?.id;
    const isEvaluationOrTeacher = Boolean(
      authUser?.role === 'teacher' ||
      (isJurySandboxEnabled() && (
        activeStudent.is_guest === true ||
        activeStudent.id === '44444444-4444-4444-4444-444444444444' ||
        activeStudent.role?.toLowerCase().includes('judge') ||
        activeStudent.role?.toLowerCase().includes('sandbox')
      ))
    );
    const actPresets = labPresets
      .filter((p) => (p.activity_id ? p.activity_id === act?.id : isFirstAct))
      .filter((p) => isEvaluationOrTeacher || !isSolutionPreset(p));

    setSessionState(null);
    setCompletionReport(null);
    setCompletedMilestone(null);

    if (savedCtx?.sourceMode === 'disk') {
      setSourceMode('disk');
      // Check IndexedDB handle for F5 resilience
      loadDirectoryHandle(`${activeStudent.id}_${activeCourse?.id}`).then((handle) => {
        if (handle) {
          dirHandleRef.current = handle;
          setFolderName(handle.name);
          // Check browser permission
          const handleWithPerms = handle as unknown as {
            queryPermission?: (desc: { mode: string }) => Promise<PermissionState>;
          };
          if (handleWithPerms.queryPermission) {
            handleWithPerms.queryPermission({ mode: 'read' }).then((status) => {
              if (status === 'granted') {
                readDirectoryRecursive(handle, activeCourse?.file_extensions || ['.java']).then((files) => {
                  setWorkspaceFiles(files);
                  setActiveFileIndex(0);
                });
              } else {
                setNeedsDiskReconnect(true);
              }
            });
          } else {
            readDirectoryRecursive(handle, activeCourse?.file_extensions || ['.java']).then((files) => {
              setWorkspaceFiles(files);
              setActiveFileIndex(0);
            });
          }
        }
      });
    } else {
      setSourceMode('preset');
      if (actPresets.length > 0) {
        const targetPresetKey = (savedCtx?.activePresetKey && actPresets.some((p) => p.key === savedCtx.activePresetKey))
          ? savedCtx.activePresetKey
          : actPresets[0].key;
        const targetPreset = actPresets.find((p) => p.key === targetPresetKey) || actPresets[0];

        setActivePresetKey(targetPreset.key);
        const editedFiles = loadPresetEdits(activeLab.id, targetPreset.key);
        let finalFiles = targetPreset.files;
        if (editedFiles) {
          const missing = targetPreset.files.filter((pf) => !editedFiles.some((ef) => ef.name === pf.name));
          finalFiles = missing.length > 0 ? [...editedFiles, ...missing] : editedFiles;
        }
        setWorkspaceFiles(finalFiles);
        setFolderName(`Preset: ${targetPreset.label}`);
      } else {
        // No presets for this activity: initialize clean starter skeleton based on target_files
        setActivePresetKey('');
        setFolderName(act ? `Activity ${act.order}: ${act.title}` : 'Starter Files');
        const starterFiles = generateFallbackStarterFiles(act, activeCourse);
        setWorkspaceFiles(starterFiles);
      }
      setActiveFileIndex(0);
    }
  }, [activeLab, activeCourse, activeStudent.id, activeStudent.role, activeStudent.is_guest, authUser?.role, readDirectoryRecursive]);

  // 4. Restore Chat History & Session State from DB on Lab / Student Change
  useEffect(() => {
    if (!activeStudent || !activeLab) return;

    async function restoreSessionContext() {
      try {
        const supabase = getBrowserSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        const res = await fetch(
          `/api/sessions/context?studentId=${activeStudent.id}&labId=${activeLab!.id}`,
          { headers }
        );
        const data = await res.json();
        if (data.session) {
          setSessionState(data.session);
          if (data.session.seat_label) {
            setSeatLabel(data.session.seat_label);
          }
          if (data.session.completion_report) {
            setCompletionReport(data.session.completion_report);
            setCompletedMilestone(activeActivity?.title || 'Milestone Mastered');
          } else {
            setCompletionReport(null);
            setCompletedMilestone(null);
          }
        } else {
          setSessionState(null);
          setCompletionReport(null);
          setCompletedMilestone(null);
        }
        if (data.messages && data.messages.length > 0) {
          const chatItems: ChatItem[] = data.messages.map((m: {
            id: string;
            activity_id?: string | null;
            role: 'user' | 'assistant';
            content: string;
            course_reference?: StructuredCourseReference;
            latency_ms?: number;
          }) => ({
            id: m.id,
            activityId: m.activity_id || null,
            role: m.role,
            content: m.content,
            courseReference: m.course_reference || null,
            latencyMs: m.latency_ms,
          }));
          setMessages(chatItems);
        } else {
          setMessages([
            {
              id: 'welcome',
              role: 'assistant',
              content: `Hello ${activeStudent.name}! I am **Socratix**. Click **"🧪 Check"** to evaluate your code, **"💡 Hint"** for a clue, or **"📖 Concept"** to review the lecture slides for ${activeLab!.title}.`,
            },
          ]);
        }
      } catch (err) {
        console.error('[StudentWorkspace] Error restoring session:', err);
      }
    }
    restoreSessionContext();
  }, [activeStudent, activeLab, activeActivity?.title]);

  // 5. Persist Active Context on Change
  useEffect(() => {
    if (!activeCourse || !activeLab) return;
    saveActiveContext({
      courseId: activeCourse.id,
      labId: activeLab.id,
      activityId: activeActivity?.id,
      studentId: activeStudent.id,
      seatLabel,
      sourceMode,
      activePresetKey,
    });
  }, [activeCourse, activeLab, activeActivity, activeStudent, seatLabel, sourceMode, activePresetKey]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAnalyzing]);

  // Realtime Broadcast Listener for Teacher On-Demand Dumps
  useEffect(() => {
    const supabase = getBrowserSupabase();
    const syncChannel = supabase.channel('workspace-sync');

    syncChannel
      .on('broadcast', { event: 'REQUEST_WORKSPACE_DUMP' }, async ({ payload }) => {
        if (payload?.studentId === activeStudent.id) {
          const currentState = latestWorkspaceStateRef.current;
          let currentFiles = currentState.workspaceFiles;
          if (dirHandleRef.current) {
            try {
              currentFiles = await readDirectoryRecursive(
                dirHandleRef.current,
                currentState.activeCourse?.file_extensions || ['.java']
              );
              setWorkspaceFiles(currentFiles);
            } catch (err) {
              console.error('Error re-reading disk:', err);
            }
          }

          syncChannel.send({
            type: 'broadcast',
            event: 'WORKSPACE_DUMP_RESPONSE',
            payload: {
              studentId: activeStudent.id,
              files: currentFiles,
              source: currentState.sourceMode,
              timestamp: new Date().toISOString(),
            },
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(syncChannel);
    };
  }, [activeStudent.id, readDirectoryRecursive]);

  // Panel Resizing Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const maxAllowed = Math.max(800, window.innerWidth * 0.75);
      const newWidth = Math.max(280, Math.min(e.clientX, maxAllowed));
      setLeftPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setLeftPanelWidth((current) => {
          try {
            localStorage.setItem('socratix_student_panel_width', String(current));
          } catch {}
          return current;
        });
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  // Handle Local Folder Selection
  const handleSelectFolder = async () => {
    try {
      if (!('showDirectoryPicker' in window)) {
        alert('File System Access API is not supported in this browser. Please use Chrome/Edge or Presets.');
        return;
      }
      const dirHandle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
      dirHandleRef.current = dirHandle;
      setSourceMode('disk');
      setFolderName(dirHandle.name);
      setNeedsDiskReconnect(false);

      if (activeCourse) {
        await saveDirectoryHandle(`${activeStudent.id}_${activeCourse.id}`, dirHandle);
        const filesData = await readDirectoryRecursive(dirHandle, activeCourse.file_extensions || ['.java']);
        setWorkspaceFiles(filesData);
        setActiveFileIndex(0);
      }
    } catch (err) {
      console.warn('Folder selection cancelled or failed:', err);
    }
  };

  // Reconnect Disk Handle 1-Click
  const handleReconnectDisk = async () => {
    if (!dirHandleRef.current) return;
    try {
      const handleWithPerms = dirHandleRef.current as unknown as {
        requestPermission?: (desc: { mode: string }) => Promise<PermissionState>;
      };
      const status = handleWithPerms.requestPermission
        ? await handleWithPerms.requestPermission({ mode: 'read' })
        : 'granted';
      if (status === 'granted') {
        setNeedsDiskReconnect(false);
        const filesData = await readDirectoryRecursive(
          dirHandleRef.current,
          activeCourse?.file_extensions || ['.java']
        );
        setWorkspaceFiles(filesData);
      }
    } catch (err) {
      console.error('Reconnect failed:', err);
    }
  };

  // Switch Preset
  const handleSelectPreset = (preset: DemoPreset) => {
    const isSolution = isSolutionPreset(preset);
    const isAllowed = Boolean(
      authUser?.role === 'teacher' ||
      activeStudent.is_guest === true ||
      activeStudent.id === '44444444-4444-4444-4444-444444444444' ||
      activeStudent.role?.toLowerCase().includes('judge') ||
      activeStudent.role?.toLowerCase().includes('sandbox')
    );
    if (isSolution && !isAllowed) {
      return;
    }

    dirHandleRef.current = null;
    setSourceMode('preset');
    setActivePresetKey(preset.key);
    setFolderName(`Preset: ${preset.label}`);
    setNeedsDiskReconnect(false);

    if (activeLab) {
      const edited = loadPresetEdits(activeLab.id, preset.key);
      let finalFiles = preset.files;
      if (edited) {
        const missing = preset.files.filter((pf) => !edited.some((ef) => ef.name === pf.name));
        finalFiles = missing.length > 0 ? [...edited, ...missing] : edited;
      }
      setWorkspaceFiles(finalFiles);
    } else {
      setWorkspaceFiles(preset.files);
    }
    setActiveFileIndex(0);
  };

  // Switch Active Activity & Synchronize Presets
  const handleSelectActivity = (act: LabActivity) => {
    setActiveActivity(act);
    setIsBriefExpanded(false);

    if (sourceMode === 'preset' && activeLab) {
      const allPresets = activeLab.demo_presets && activeLab.demo_presets.length > 0
        ? activeLab.demo_presets
        : DEFAULT_JAVA_PRESETS;
      const isFirstAct = act.id === activeLab.activities?.[0]?.id;
      const isEvaluationOrTeacher = Boolean(
        authUser?.role === 'teacher' ||
        activeStudent.is_guest === true ||
        activeStudent.id === '44444444-4444-4444-4444-444444444444' ||
        activeStudent.role?.toLowerCase().includes('judge') ||
        activeStudent.role?.toLowerCase().includes('sandbox')
      );
      const actPresets = allPresets
        .filter((p) => (p.activity_id ? p.activity_id === act.id : isFirstAct))
        .filter((p) => isEvaluationOrTeacher || !isSolutionPreset(p));

      if (actPresets.length > 0) {
        if (!actPresets.some((p) => p.key === activePresetKey)) {
          handleSelectPreset(actPresets[0]);
        }
      } else {
        // No presets for this activity: initialize language-aware starter skeleton preserving existing work if present
        setActivePresetKey('');
        setFolderName(`Activity ${act.order}: ${act.title}`);
        const starterFiles = generateFallbackStarterFiles(act, activeCourse, workspaceFiles);
        setWorkspaceFiles(starterFiles);
        setActiveFileIndex(0);
      }
    }
  };

  // Restore Default Preset
  const handleRestorePreset = () => {
    if (!activeLab || !activePresetKey) return;
    clearPresetEdits(activeLab.id, activePresetKey);
    const presets = activeLab.demo_presets && activeLab.demo_presets.length > 0
      ? activeLab.demo_presets
      : DEFAULT_JAVA_PRESETS;
    const currentPreset = presets.find((p) => p.key === activePresetKey);
    if (currentPreset) {
      setWorkspaceFiles(currentPreset.files);
    }
  };

  // Handle File Content Edit (in Preset Mode)
  const handleCodeChange = (newCode: string) => {
    if (sourceMode === 'disk' || !workspaceFiles[activeFileIndex]) return;
    const updated = [...workspaceFiles];
    updated[activeFileIndex] = { ...updated[activeFileIndex], content: newCode };
    setWorkspaceFiles(updated);

    if (activeLab) {
      savePresetEdits(activeLab.id, activePresetKey, updated);
    }
  };

  // Switch Physical Seat
  const handleSeatChange = async (newSeat: string) => {
    setSeatLabel(newSeat);
    if (activeStudent && activeLab) {
      try {
        const supabase = getBrowserSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        await fetch('/api/sessions/context', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            studentId: activeStudent.id,
            labId: activeLab.id,
            seatLabel: newSeat,
          }),
        });
      } catch (err) {
        console.error('Failed to update seat:', err);
      }
    }
  };

  // Reset Student Session
  const executeResetSession = async () => {
    if (!activeStudent || !activeLab) return;
    setIsResetting(true);

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
        body: JSON.stringify({
          studentId: activeStudent.id,
          labId: activeLab.id,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to reset session');
      }

      clearPresetEdits(activeLab.id, activePresetKey);
      setSessionState(null);
      setCompletionReport(null);
      setCompletedMilestone(null);
      setMessages([
        {
          id: 'welcome_reset',
          role: 'assistant',
          content: `Session has been reset for **${activeStudent.name}**. You are ready for a fresh start on **${activeLab.title}**!`,
        },
      ]);
      setIsResetModalOpen(false);
    } catch (err) {
      console.error('Failed to reset session:', err);
    } finally {
      setIsResetting(false);
    }
  };

  // Core Socratic Invocation (used by submit, check, hint, and concept)
  const invokeTutor = async (
    userQuestion: string,
    mode: 'question' | 'check' | 'hint' | 'concept' = 'question'
  ) => {
    if (!activeCourse || !activeLab || workspaceFiles.length === 0 || isAnalyzing) return;

    setIsAnalyzing(true);

    let userMessageContent = userQuestion;
    if (mode === 'check') {
      userMessageContent = '🧪 [Requested Code Check & Milestone Evaluation]';
    } else if (mode === 'hint') {
      userMessageContent = '💡 [Asked for a Socratic Hint]';
    } else if (mode === 'concept') {
      userMessageContent = '📖 [Asked for Theory & Slide Concept Explanation]';
    }

    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: 'user', content: userMessageContent, activityId: activeActivity?.id },
    ]);

    try {
      // Re-read files if disk mode
      let currentFiles = workspaceFiles;
      if (dirHandleRef.current) {
        currentFiles = await readDirectoryRecursive(
          dirHandleRef.current,
          activeCourse.file_extensions || ['.java']
        );
        setWorkspaceFiles(currentFiles);
      }

      // Filter conversation history strictly to the active activity to prevent cross-activity contamination
      const isFirstAct = !activeActivity || !activeLab?.activities?.length || activeActivity.id === activeLab.activities[0]?.id;
      const conversationHistory = messages
        .filter((m) => !m.id.startsWith('welcome') && (m.activityId ? m.activityId === activeActivity?.id : isFirstAct))
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const supabase = getBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          courseId: activeCourse.id,
          labId: activeLab.id,
          activityId: activeActivity?.id,
          studentId: activeStudent.id,
          studentName: activeStudent?.name,
          seatLabel,
          question: mode === 'question' ? userQuestion : '',
          isHintRequest: mode === 'hint',
          requestMode: mode,
          files: currentFiles,
          history: conversationHistory,
        }),
      });

      const data = await res.json();

      if (res.ok && data.socratic_reply) {
        const reply = data.socratic_reply;
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: reply.message_markdown,
            courseReference: reply.course_reference || null,
            latencyMs: data.latency_ms,
            activityId: activeActivity?.id,
          },
        ]);

        if (data.session_state) {
          setSessionState(data.session_state);
        }

        // Trigger celebration ONLY when the activity or lab was newly mastered in this specific turn
        const isNewlyMastered = Boolean(data.is_activity_completed || data.is_lab_completed);

        if (isNewlyMastered && data.competency_report) {
          const report = data.competency_report;
          const milestone = activeActivity?.title || activeLab?.title || 'Activity Mastered';
          setCompletionReport(report);
          setCompletedMilestone(milestone);
          setIsCelebrationOpen(true);
          playCelebrationChime();
          triggerCelebrationConfetti();
        } else if (Array.isArray(data.newly_completed_milestone_ids) && data.newly_completed_milestone_ids.length > 0) {
          // Subtle audio confirmation for intermediate milestone without interrupting student with full celebration modal
          playCelebrationChime();
        }
      } else {
        throw new Error(data.error || 'Failed to analyze code');
      }
    } catch (err) {
      console.error('[StudentWorkspace] Tutor error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Sorry, an error occurred while connecting to the Socratic tutor. Please try again.',
        },
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Form Submit Handler
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    invokeTutor(text, 'question');
  };

  // 1-Click Handlers: Check Code, Socratic Hint, Theory & Concept
  const handleCheckCode = () => {
    invokeTutor('', 'check');
  };

  const handleAskForHint = () => {
    invokeTutor('', 'hint');
  };

  const handleExplainConcept = () => {
    invokeTutor('', 'concept');
  };

  const allLabPresets = activeLab?.demo_presets && activeLab.demo_presets.length > 0
    ? activeLab.demo_presets
    : DEFAULT_JAVA_PRESETS;

  const isEvaluationOrTeacherMode = Boolean(
    authUser?.role === 'teacher' ||
    (isJurySandboxEnabled() && (
      activeStudent.is_guest === true ||
      activeStudent.id === '44444444-4444-4444-4444-444444444444' ||
      activeStudent.role?.toLowerCase().includes('judge') ||
      activeStudent.role?.toLowerCase().includes('sandbox')
    ))
  );

  // Filter presets strictly for the active activity and hide solutions from regular students
  // Legacy backward-compatibility: if presets lack activity_id, attribute them strictly to Activity 1 (activities[0]).
  const isFirstActivity = !activeActivity || !activeLab?.activities?.length || activeActivity.id === activeLab.activities[0]?.id;
  const activePresets = (activeActivity
    ? allLabPresets.filter((p) => (p.activity_id ? p.activity_id === activeActivity.id : isFirstActivity))
    : allLabPresets
  ).filter((p) => isEvaluationOrTeacherMode || !isSolutionPreset(p));

  const currentFile = workspaceFiles[activeFileIndex] || { name: 'untitled', content: '' };
  const actProgress = activeActivity && sessionState?.activities_progress?.[activeActivity.id];

  const isBuggyPreset = sourceMode === 'preset' && activePresets.find((p) => p.key === activePresetKey)?.preset_type === 'buggy';
  const isCurrentActivityCompleted = actProgress?.percent === 100 && !isBuggyPreset;
  const activeActivityReport = isCurrentActivityCompleted
    ? (actProgress?.completion_report || completionReport)
    : (!isBuggyPreset && sessionState?.progress_percent === 100 ? completionReport : null);

  const nextActivity = activeLab?.activities?.find(
    (a) => a.order === (activeActivity?.order || 0) + 1
  );

  const currentActivityMessages = messages.filter((m) => {
    if (m.activityId) {
      return m.activityId === activeActivity?.id;
    }
    // Legacy messages with no activityId: attribute strictly to Activity 1
    return isFirstActivity;
  });

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 font-sans overflow-hidden">
      {/* ==================================================================== */}
      {/* LEFT PANEL: IDE & WORKSPACE (Resizable) */}
      {/* ==================================================================== */}
      <div
        style={{ width: `${leftPanelWidth}px` }}
        className={`shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full overflow-hidden ${
          isDragging ? '' : 'transition-[width] duration-100 ease-out'
        }`}
      >
        {/* Workspace Top Header: Course & Lab Selectors */}
        <div className="p-2 sm:p-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#059669] dark:text-emerald-400">🦉 Socratix</span>
              <Badge variant="outline" className="border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-transparent text-emerald-800 dark:text-emerald-300 text-[10px] px-1.5 py-0 font-semibold">
                Workspace v2
              </Badge>
              {authUser ? (
                authUser.role === 'teacher' ? (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="border-amber-300 dark:border-amber-500/40 bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 text-[10px] px-2 py-0 flex items-center gap-1 font-mono font-semibold">
                      <GraduationCap className="w-2.5 h-2.5 text-amber-700 dark:text-amber-400" />
                      <span className="max-w-[110px] truncate">{authUser.name}</span>
                      <span className="text-[9px] text-amber-700 dark:text-amber-400/80 border-l border-amber-300 dark:border-amber-500/30 pl-1 font-medium">Teacher Preview</span>
                    </Badge>
                    <Link
                      href="/teacher"
                      className="text-[10px] text-amber-800 dark:text-amber-400 hover:text-amber-950 dark:hover:text-amber-300 underline font-semibold transition"
                      title="Return to Teacher Hub"
                    >
                      Hub &rarr;
                    </Link>
                    <SignOutButton />
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="border-emerald-300 dark:border-emerald-500/30 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 text-[10px] px-1.5 py-0 flex items-center gap-1 font-mono font-semibold">
                      <User className="w-2.5 h-2.5 text-emerald-700 dark:text-emerald-400" />
                      <span className="max-w-[100px] truncate">{authUser.name}</span>
                    </Badge>
                    <SignOutButton />
                  </div>
                )
              ) : (
                <Link
                  href="/login"
                  className="text-[10px] text-slate-600 dark:text-slate-400 hover:text-[#059669] dark:hover:text-emerald-400 flex items-center gap-1 transition ml-1 font-medium"
                  title="Sign in with an email account"
                >
                  <LogIn className="w-3 h-3" />
                  <span>Sign In</span>
                </Link>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <ThemeToggle size="sm" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsResetModalOpen(true)}
                className="h-7 text-xs text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2 gap-1 rounded-lg"
                title="Reset current student session"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </Button>
            </div>
          </div>

          {/* Course & Lab Pickers */}
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div>
              <label className="text-[9px] uppercase font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Course</label>
              <div className="relative flex items-center">
                <select
                  value={activeCourse?.id || ''}
                  onChange={(e) => {
                    const c = courses.find((x) => x.id === e.target.value);
                    if (c) setActiveCourse(c);
                  }}
                  className="appearance-none w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-2.5 pr-7 py-1 text-[#0f172a] dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500 font-medium shadow-sm transition cursor-pointer"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900 text-[#0f172a] dark:text-[#f1f5f9]">
                      {c.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute right-2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-[9px] uppercase font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">Lab (TP)</label>
              <div className="relative flex items-center">
                <select
                  value={activeLab?.id || ''}
                  onChange={(e) => {
                    const l = labs.find((x) => x.id === e.target.value);
                    if (l) {
                      setActiveLab(l);
                      setSessionState(null);
                      setCompletionReport(null);
                      setCompletedMilestone(null);
                      const firstAct = l.activities?.[0] || null;
                      setActiveActivity(firstAct);
                      saveActiveContext({
                        labId: l.id,
                        activityId: firstAct?.id,
                        activePresetKey: undefined,
                      });
                    }
                  }}
                  className="appearance-none w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-2.5 pr-7 py-1 text-[#0f172a] dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500 font-medium shadow-sm transition cursor-pointer"
                >
                  {labs.map((l) => (
                    <option key={l.id} value={l.id} className="bg-white dark:bg-slate-900 text-[#0f172a] dark:text-[#f1f5f9]">
                    {formatLabOptionLabel(l.code, l.title)}
                  </option>
                ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute right-2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Quick Syllabus & Materials Launcher */}
          {activeCourse && (
            <div>
              <button
                type="button"
                onClick={() => setIsSyllabusModalOpen(true)}
                className="w-full py-1 px-2.5 rounded-md text-[11px] font-semibold bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-white flex items-center justify-between transition group shadow-xs"
                title="Browse course syllabus, lecture slides and chapter PDFs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="truncate">Course Slides & Chapters</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-[10px] font-mono">
                  <span className="px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 font-semibold">
                    {chapters.length} chap.
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30 font-semibold">
                    {labs.length} TP
                  </span>
                </div>
              </button>
            </div>
          )}

          {/* Persona & Seat Selector */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200 dark:border-slate-800/80">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                  {authUser?.role === 'student' ? 'Student Profile' : 'Student'}
                </label>
                {authUser?.role === 'student' ? (
                  <span className="text-[9px] text-[#059669] dark:text-emerald-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#059669] dark:bg-emerald-400 animate-pulse" />
                    You (Enrolled)
                  </span>
                ) : authUser?.role === 'teacher' ? (
                  <span className="text-[9px] text-amber-600 dark:text-amber-400/90 font-medium flex items-center gap-1" title="Teacher previewing student workspace">
                    <GraduationCap className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                    Preview Mode
                  </span>
                ) : (
                  <span className="text-[9px] text-[#059669] dark:text-emerald-400/90 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#059669] dark:bg-emerald-400" />
                    {isJurySandboxEnabled() ? 'Jury Sandbox' : 'Guest Workstation'}
                  </span>
                )}
              </div>

              {authUser?.role === 'student' ? (
                <div
                  className="w-full bg-slate-100 dark:bg-slate-900 border border-emerald-500/40 rounded-md px-2.5 py-1 text-slate-800 dark:text-slate-200 text-xs flex items-center justify-between gap-1.5 shadow-xs"
                  title={`Enrolled Student: ${activeStudent.name}`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[#059669] dark:text-emerald-300 text-[9px] font-bold shrink-0">
                      {activeStudent.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 truncate text-xs">{activeStudent.name}</span>
                  </div>
                  {activeStudent.email && (
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-[110px] shrink-0">
                      {activeStudent.email}
                    </span>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={activeStudent.id}
                    onChange={(e) => {
                      const all = [...DEMO_PERSONAS, ...registeredStudents];
                      const p = all.find((x) => x.id === e.target.value);
                      if (p) {
                        setActiveStudent(p);
                        setSessionState(null);
                        setCompletionReport(null);
                        setCompletedMilestone(null);
                        saveActiveContext({ studentId: p.id });
                      }
                    }}
                    className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-2.5 pr-7 py-1 text-[#0f172a] dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500 font-sans shadow-sm transition"
                  >
                    {(isJurySandboxEnabled() || authUser?.role === 'teacher') && (
                      <optgroup label="🎭 Demo Personas (Instant Sandbox)" className="bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-300 font-semibold">
                        {DEMO_PERSONAS.map((p) => (
                          <option key={p.id} value={p.id} className="bg-white dark:bg-slate-900 text-[#0f172a] dark:text-[#f1f5f9] font-normal">
                            {p.name} ({p.role})
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {!isJurySandboxEnabled() && !authUser && (
                      <option value="" disabled className="bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 italic">
                        Please sign in with student email
                      </option>
                    )}

                    {authUser?.role === 'teacher' && (
                      <optgroup label="👤 Enrolled Students (Class Roster)" className="bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-300 font-semibold">
                        {registeredStudents.length > 0 ? (
                          registeredStudents.map((p) => (
                            <option key={p.id} value={p.id} className="bg-white dark:bg-slate-900 text-[#0f172a] dark:text-[#f1f5f9] font-normal">
                              {p.isOnline ? `🟢 ${p.name} (Online)` : `⚪ ${p.name}`}
                            </option>
                          ))
                        ) : (
                          <option value="" disabled className="bg-white dark:bg-slate-900 text-slate-500 italic">
                            No registered students yet
                          </option>
                        )}
                      </optgroup>
                    )}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 block mb-1">Seat</label>
              <div className="relative">
                <select
                  value={seatLabel}
                  onChange={(e) => handleSeatChange(e.target.value)}
                  className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-2.5 pr-7 py-1 text-[#0f172a] dark:text-slate-100 text-xs focus:outline-none focus:border-emerald-500 font-mono shadow-sm transition"
                >
                  {SEAT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} className="bg-white dark:bg-slate-900 text-[#0f172a] dark:text-[#f1f5f9]">
                      {opt}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Activity & Milestone Brief (Collapsible) */}
        {activeLab && activeActivity && (
          <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 p-2 sm:p-2.5 space-y-1.5">
            {/* Multi-Activity 1-Click Tab Bar (Option B) */}
            {activeLab.activities && activeLab.activities.length > 1 && (
              <div
                onWheel={(e) => {
                  if (e.deltaY !== 0) {
                    e.currentTarget.scrollLeft += e.deltaY;
                  }
                }}
                className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800/70 scrollbar-thin"
              >
                {activeLab.activities.map((act) => {
                  const isSelected = activeActivity.id === act.id;
                  const actProg = sessionState?.activities_progress?.[act.id];
                  const isCompleted = actProg?.percent === 100;
                  return (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => handleSelectActivity(act)}
                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium transition-all shrink-0 ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/40 text-[#059669] dark:text-emerald-300 font-semibold shadow-xs'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs'
                      }`}
                      title={`Switch to Activity ${act.order}: ${act.title}`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400 shrink-0" />
                      ) : (
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isSelected ? 'bg-[#059669] dark:bg-emerald-400 ring-2 ring-emerald-500/30' : 'bg-slate-400 dark:bg-slate-600'
                          }`}
                        />
                      )}
                      <span className="truncate max-w-[150px] sm:max-w-[200px]">
                        Act. {act.order}: {act.title}
                      </span>
                      {actProg && (
                        <span className="text-[10px] opacity-75 font-mono">
                          ({actProg.completed_milestones.length}/{actProg.total_milestones})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Layers className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-200 truncate">
                  Activity {activeActivity.order}: {activeActivity.title}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {activeLab?.pdf_url && (
                  <button
                    type="button"
                    onClick={() => setActivePdfModal({ url: activeLab.pdf_url!, title: `${activeLab.code || 'Lab'} — Official Subject Sheet` })}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-800 dark:text-cyan-400 hover:text-cyan-950 dark:hover:text-cyan-300 bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-950/60 dark:hover:bg-cyan-900/50 border border-cyan-300 dark:border-cyan-500/40 px-2 py-0.5 rounded-md transition shadow-xs"
                    title="Read original full Lab Subject PDF"
                  >
                    <FileText className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    <span>Lab PDF ↗</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsBriefExpanded(!isBriefExpanded)}
                  className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 text-xs shrink-0 p-1 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 rounded transition-colors"
                  title={isBriefExpanded ? "Hide activity brief & milestones" : "Show activity brief & milestones"}
                >
                  {isBriefExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Dual Progress Gauges */}
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 shadow-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-0.5 font-medium">
                  <span>Activity</span>
                  <span className="font-semibold text-[#059669] dark:text-emerald-400">
                    {actProgress ? `${actProgress.completed_milestones.length}/${actProgress.total_milestones}` : `0/${activeActivity.milestones.length}`}
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#059669] dark:bg-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${actProgress?.percent || 0}%` }}
                  />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 shadow-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-0.5 font-medium">
                  <span>Total Lab</span>
                  <span className="font-semibold text-cyan-700 dark:text-cyan-400">
                    {sessionState?.progress_percent || 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-cyan-600 dark:bg-cyan-500 h-full transition-all duration-300"
                    style={{ width: `${sessionState?.progress_percent || 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Expanded Brief Details */}
            {isBriefExpanded && (
              <div className="pt-2 text-xs space-y-2 border-t border-slate-200 dark:border-slate-800/60">
                <div className="flex items-center justify-between pb-0.5">
                  <span className="text-[10px] uppercase font-semibold text-slate-500">
                    Activity Instructions:
                  </span>
                  {activeActivity.instructions_i18n?.fr && (
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-1.5 py-0.5 text-[10px] shadow-xs">
                      <button
                        type="button"
                        onClick={() => setBriefLang('en')}
                        className={`font-semibold transition ${
                          briefLang === 'en' ? 'text-[#059669] dark:text-emerald-400 font-bold' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                        title="English instructions"
                      >
                        EN
                      </button>
                      <span className="text-slate-300 dark:text-slate-700">|</span>
                      <button
                        type="button"
                        onClick={() => setBriefLang('fr')}
                        className={`font-semibold transition ${
                          briefLang === 'fr' ? 'text-cyan-700 dark:text-cyan-400 font-bold' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                        title="French original instructions"
                      >
                        FR
                      </button>
                    </div>
                  )}
                </div>

                <div className="prose prose-slate dark:prose-invert prose-xs max-w-none text-slate-700 dark:text-slate-300 leading-relaxed text-[11px] space-y-1.5 bg-white dark:bg-slate-950/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/80 shadow-xs [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_code]:bg-slate-100 dark:[&_code]:bg-slate-900 [&_code]:text-emerald-700 dark:[&_code]:text-emerald-300 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[10px] [&_strong]:text-slate-900 dark:[&_strong]:text-slate-100 [&_p]:my-1">
                  <ReactMarkdown>
                    {cleanInstructionsMarkdown(
                      briefLang === 'fr' && activeActivity.instructions_i18n?.fr
                        ? activeActivity.instructions_i18n.fr
                        : (activeActivity.instructions_i18n?.en || activeActivity.instructions_markdown)
                    )}
                  </ReactMarkdown>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-semibold text-slate-500">Milestones Checklist</div>
                  {activeActivity.milestones.map((m) => {
                    const isDone = sessionState?.completed_milestone_ids?.includes(m.id);
                    return (
                      <div key={m.id} className="flex items-center gap-1.5 text-[11px]">
                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400 shrink-0" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        )}
                        <span className={isDone ? 'text-emerald-700 dark:text-emerald-300 line-through font-medium' : 'text-slate-700 dark:text-slate-300'}>
                          {m.title}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {activeActivity.target_files && activeActivity.target_files.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-slate-200 dark:border-slate-800/60">
                    <span className="text-[10px] uppercase font-semibold text-slate-500">Target Files:</span>
                    {activeActivity.target_files.map((file) => (
                      <Badge
                        key={file}
                        variant="outline"
                        className="text-[10px] font-mono text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0 font-medium"
                      >
                        {file}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Source Switcher: Presets vs Disk */}
        <div className="p-2 sm:p-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400" />
              Source: <span className="text-slate-900 dark:text-slate-200 font-semibold">{folderName}</span>
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectFolder}
                className="h-6 text-[11px] font-medium bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border-slate-300 dark:border-slate-700 hover:border-emerald-500/50 px-2.5 gap-1.5 transition-all shadow-xs"
              >
                <FolderOpen className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400" />
                Folder
              </Button>
            </div>
          </div>

          {/* Quick Presets Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {activePresets.length > 0 ? (
              <>
                {activePresets.map((preset) => {
                  const isSolution = isSolutionPreset(preset);
                  return (
                    <button
                      key={preset.key}
                      onClick={() => handleSelectPreset(preset)}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors inline-flex items-center gap-1 ${
                        sourceMode === 'preset' && activePresetKey === preset.key
                          ? isSolution
                            ? 'bg-cyan-50 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/40 font-semibold'
                            : 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 font-semibold'
                          : isSolution
                          ? 'bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-400/90 border-slate-300 dark:border-slate-700 hover:text-cyan-900 dark:hover:text-cyan-300 hover:bg-slate-50'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50'
                      }`}
                      title={isSolution ? 'Reference Solution (Jury / Teacher / Guest Persona)' : preset.description}
                    >
                      <span>{preset.label}</span>
                      {isSolution && (
                        <span className="text-[9px] px-1 py-0 rounded bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-500/30 font-mono font-bold">
                          JURY
                        </span>
                      )}
                    </button>
                  );
                })}
                {sourceMode === 'preset' && activePresetKey && (
                  <button
                    onClick={handleRestorePreset}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 bg-white dark:bg-transparent"
                    title="Restore default preset code"
                  >
                    ↺ Restore
                  </button>
                )}
              </>
            ) : (
              <span className="text-[10px] text-slate-500 dark:text-slate-400 italic flex items-center gap-1.5 py-0.5">
                <Info className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                No presets for Act. {activeActivity?.order || 1} (Re-analyze lab in Studio to auto-generate)
              </span>
            )}
          </div>

          {/* Disk Reconnection Banner after F5 */}
          {needsDiskReconnect && (
            <div className="p-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded text-xs text-amber-900 dark:text-amber-300 flex items-center justify-between font-medium">
              <span>Reconnect local folder</span>
              <Button
                size="sm"
                onClick={handleReconnectDisk}
                className="h-6 text-[11px] bg-amber-600 hover:bg-amber-500 text-white px-2"
              >
                Allow Access
              </Button>
            </div>
          )}
        </div>

        {/* Tab List of Files */}
        <div className="flex bg-slate-100 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 overflow-x-auto text-xs px-2 pt-1 gap-1">
          {workspaceFiles.map((file, idx) => (
            <button
              key={file.name}
              onClick={() => setActiveFileIndex(idx)}
              className={`px-3 py-1.5 rounded-t font-mono text-xs border-t border-l border-r transition-colors ${
                activeFileIndex === idx
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-emerald-700 dark:text-emerald-400 font-semibold'
                  : 'bg-slate-200/50 dark:bg-slate-950/40 border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {file.name.split('/').pop()}
            </button>
          ))}
        </div>

        {/* Code Editor / Viewer (CodeMirror 6 — editable presets, read-only disk) */}
        <div className="flex-1 min-h-0 bg-white dark:bg-slate-950 relative overflow-hidden">
          <WorkspaceCodeEditor
            key={`${sourceMode}:${currentFile.name}`}
            value={currentFile.content || ''}
            language={getSyntaxLanguage(currentFile.name)}
            readOnly={sourceMode === 'disk'}
            onChange={handleCodeChange}
          />
        </div>

        {/* Editor Footer Status */}
        <div className="px-3 py-1 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 flex justify-between">
          <span>{currentFile.name}</span>
          <span>{sourceMode === 'disk' ? 'Disk (Read Only)' : 'Preset (Editable)'}</span>
        </div>
      </div>

      {/* Resize Handle / Splitter (Draggable & double-click to reset to 50%) */}
      <div
        onMouseDown={() => setIsDragging(true)}
        onDoubleClick={() => {
          const defaultWidth = Math.round(window.innerWidth * 0.50);
          setLeftPanelWidth(defaultWidth);
          try {
            localStorage.setItem('socratix_student_panel_width', String(defaultWidth));
          } catch {}
        }}
        title="Glisser pour ajuster la largeur / Double-cliquer pour réinitialiser à 50%"
        className={`w-1.5 relative group cursor-col-resize shrink-0 transition-colors z-20 ${
          isDragging ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-200 dark:bg-slate-800 hover:bg-emerald-500'
        }`}
      >
        {/* Invisible wider hit area (12px) for effortless mouse/trackpad grabbing */}
        <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize" />
      </div>

      {/* ==================================================================== */}
      {/* RIGHT PANEL: SOCRATIC CHAT & GUIDANCE */}
      {/* ==================================================================== */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
        {/* Chat Header */}
        <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">Socratic Mentor</span>
            {activeLab && (
              <Badge variant="outline" className="text-xs text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 font-mono">
                {activeLab.code}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Target:</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
              {activeStudent.name} ({seatLabel})
            </span>
            <ThemeToggle size="sm" showLabel={true} />
          </div>
        </div>

        {/* Pinned Milestone Completion Banner (v0-socratix) */}
        {activeActivityReport && (
          <div className="mx-4 mt-3 p-3.5 rounded-xl bg-gradient-to-r from-emerald-50 via-white to-white dark:from-emerald-950/70 dark:via-slate-900 dark:to-slate-900 border border-emerald-300 dark:border-emerald-500/50 flex flex-wrap items-center justify-between gap-3 shadow-md dark:shadow-lg dark:shadow-emerald-950/40 animate-in fade-in slide-in-from-top-2 duration-300 shrink-0">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-[#059669] dark:text-emerald-400 ring-1 ring-emerald-300 dark:ring-emerald-500/40">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </span>
              <div>
                <div className="text-xs font-mono text-[#059669] dark:text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-2">
                  <span>🏆 Milestone Mastered</span>
                  <span className="text-slate-400 dark:text-slate-500">•</span>
                  <span>{activeActivity?.title || completedMilestone || 'Milestone Mastered'}</span>
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                  All contracts met! Review your competency report & consolidation slides.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={replayCelebration}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-[#059669] dark:hover:text-emerald-400 h-8 px-2.5 flex items-center gap-1.5 hover:bg-emerald-50 dark:hover:bg-slate-800"
                title="Replay Celebration Sound & Fireworks"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400 animate-pulse" />
                <span>Replay 🎉</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setCompletionReport(activeActivityReport);
                  setIsCelebrationOpen(true);
                }}
                className="bg-[#059669] hover:bg-[#047857] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white dark:text-slate-950 font-bold text-xs h-8 px-3.5 rounded-lg shadow-md"
              >
                View Report Card 🏆
              </Button>
              {nextActivity && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSelectActivity(nextActivity)}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs h-8 px-3 rounded-lg shadow-md flex items-center gap-1 shrink-0"
                  title={`Continue to Activity ${nextActivity.order}`}
                >
                  <span>Next: Act. {nextActivity.order} →</span>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Dialogue Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {currentActivityMessages.length === 0 && (
            <div className="flex flex-col items-start">
              <div className="max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none space-y-2">
                <div className="prose prose-slate dark:prose-invert prose-xs max-w-none">
                  <p>
                    Hello <strong>{activeStudent.name}</strong>! You are working on <strong>Activity {activeActivity?.order}: {activeActivity?.title}</strong>.
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Ask me a question or click <strong>&quot;🧪 Check&quot;</strong>, <strong>&quot;💡 Hint&quot;</strong>, or <strong>&quot;📖 Concept&quot;</strong> to get guided on this activity!
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentActivityMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-[#059669] dark:bg-emerald-600 text-white rounded-br-none'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none space-y-2'
                }`}
              >
                <div className={`prose prose-xs max-w-none ${msg.role === 'user' ? 'prose-invert' : 'prose-slate dark:prose-invert'}`}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>

                {/* Socratic Slide Citation Pill */}
                {msg.courseReference && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
                    <button
                      onClick={() => {
                        setActiveSlideReference(msg.courseReference || null);
                        setIsSlideModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors text-[11px] font-semibold text-left"
                    >
                      <BookOpen className="w-3.5 h-3.5 shrink-0" />
                      <span>{formatSlideCitationLabel(msg.courseReference)}</span>
                      {!formatSlideCitationLabel(msg.courseReference).toLowerCase().includes('slide') && (
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono shrink-0">
                          (Slide #{msg.courseReference.page_number})
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {msg.latencyMs && (
                <span className="text-[9px] text-slate-500 mt-1 px-1 font-mono">
                  muse-spark-1.3 &bull; {msg.latencyMs}ms
                </span>
              )}
            </div>
          ))}

          {isAnalyzing && (
            <div className="flex items-center gap-2.5 text-xs font-medium text-[#059669] dark:text-emerald-400 bg-white dark:bg-slate-900/80 border border-emerald-300 dark:border-emerald-500/30 rounded-xl px-4 py-3 w-fit min-w-[360px] whitespace-nowrap shadow-md dark:shadow-emerald-950/30 animate-pulse">
              <Sparkles className="w-4 h-4 animate-spin shrink-0" />
              <span>Analyzing code socratic-style with muse-spark-1.3...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input & Action Bar */}
        <div className="p-3 sm:p-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 sm:gap-2.5">
            {/* 1. Check Code Button */}
            <Button
              type="button"
              onClick={handleCheckCode}
              disabled={isAnalyzing}
              className="h-10 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-xs sm:text-sm px-3.5 sm:px-4.5 rounded-xl gap-2 shadow-md shadow-emerald-950/20 shrink-0 transition-all active:scale-95"
              title="Evaluate current workspace code against active milestones"
            >
              <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
              <span>Check</span>
            </Button>

            {/* 2. Socratic Hint Button */}
            <Button
              type="button"
              onClick={handleAskForHint}
              disabled={isAnalyzing}
              className="h-10 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-semibold text-xs sm:text-sm px-3.5 sm:px-4.5 rounded-xl gap-2 shadow-md shadow-amber-950/20 shrink-0 transition-all active:scale-95"
              title="Get an instant Socratic hint for your active milestone"
            >
              <Lightbulb className="w-4 h-4 text-slate-950 fill-slate-950 shrink-0" />
              <span>Hint</span>
            </Button>

            {/* 3. Concept / Theory Button */}
            <Button
              type="button"
              onClick={handleExplainConcept}
              disabled={isAnalyzing}
              className="h-10 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-xs sm:text-sm px-3.5 sm:px-4.5 rounded-xl gap-2 shadow-md shadow-indigo-950/20 shrink-0 transition-all active:scale-95"
              title="Explain theoretical lecture concepts and relevant slides for this activity"
            >
              <BookOpen className="w-4 h-4 text-white shrink-0" />
              <span>Concept</span>
            </Button>

            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                activeActivity
                  ? `Ask Socratix about ${activeActivity.title}...`
                  : 'Ask Socratix a question...'
              }
              disabled={isAnalyzing}
              className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm h-10 px-3.5 rounded-xl focus-visible:ring-emerald-500 shadow-sm"
            />

            <Button
              type="submit"
              disabled={isAnalyzing || !input.trim()}
              className="h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm px-4 sm:px-5 rounded-xl gap-2 shadow-md shadow-emerald-950/20 shrink-0 transition-all active:scale-95"
            >
              <Send className="w-4 h-4 shrink-0" />
              <span>Send</span>
            </Button>
          </form>
        </div>
      </div>

      {/* Smart Slide Viewer Modal */}
      <SmartSlideViewerModal
        isOpen={isSlideModalOpen}
        onClose={() => setIsSlideModalOpen(false)}
        reference={activeSlideReference}
        courseTitle={activeCourse?.title || 'Course Slides'}
      />

      {/* Milestone Celebration Modal */}
      <MilestoneCelebrationModal
        isOpen={isCelebrationOpen}
        onClose={() => setIsCelebrationOpen(false)}
        report={completionReport}
        milestoneId={completedMilestone || activeActivity?.title || 'Milestone Completed'}
        studentName={activeStudent?.name}
        seatLabel={seatLabel}
        onContinueNext={nextActivity ? () => handleSelectActivity(nextActivity) : undefined}
        nextActivityLabel={nextActivity ? `Activity ${nextActivity.order}` : undefined}
      />

      {/* Dual-Theme Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Reset Student Session?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Reset session for <span className="font-semibold text-slate-900 dark:text-slate-200">{activeStudent.name}</span> on{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-200">{activeLab?.title || 'this lab'}</span>? This will clear all dialogue history, code edits, and telemetry.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResetting}
                className="h-8 text-xs bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={executeResetSession}
                disabled={isResetting}
                className="h-8 text-xs bg-rose-600 hover:bg-rose-500 text-white font-medium gap-1.5 shadow-sm shadow-rose-950/30"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                {isResetting ? 'Resetting...' : 'Confirm Reset'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* In-Situ PDF Document Viewer Modal */}
      <PdfViewerModal
        isOpen={Boolean(activePdfModal)}
        onClose={() => setActivePdfModal(null)}
        pdfUrl={activePdfModal?.url || null}
        title={activePdfModal?.title || 'Document PDF'}
      />

      {/* In-Situ Course Syllabus & Chapters Library Modal */}
      <CourseSyllabusModal
        isOpen={isSyllabusModalOpen}
        onClose={() => setIsSyllabusModalOpen(false)}
        course={activeCourse}
        chapters={chapters}
        labs={labs}
        onOpenPdf={(pdfUrl, title) => {
          setIsSyllabusModalOpen(false);
          setActivePdfModal({ url: pdfUrl, title });
        }}
      />
    </div>
  );
}
