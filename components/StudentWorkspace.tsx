'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { getBrowserSupabase } from '@/lib/supabase';
import {
  Course,
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
} from 'lucide-react';
import MilestoneCelebrationModal, {
  CompetencyReport,
  playCelebrationChime,
  triggerCelebrationConfetti,
  replayCelebration,
} from './MilestoneCelebrationModal';
import SmartSlideViewerModal from './SmartSlideViewerModal';
import {
  saveActiveContext,
  loadActiveContext,
  savePresetEdits,
  loadPresetEdits,
  clearPresetEdits,
  saveDirectoryHandle,
  loadDirectoryHandle,
} from '@/lib/workspace-persistence';

const DEMO_PERSONAS = [
  { id: '33333333-3333-3333-3333-333333333333', name: 'Bob', role: 'Student' },
  { id: '44444444-4444-4444-4444-444444444444', name: 'Guest Explorer', role: 'Judge / Sandbox' },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Alice', role: 'Student' },
  { id: '55555555-5555-5555-5555-555555555555', name: 'Ines', role: 'Student' },
];

const SEAT_OPTIONS = Array.from({ length: 20 }, (_, i) => `PC ${String(i + 1).padStart(2, '0')}`);

interface ChatItem {
  id: string;
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

export default function StudentWorkspace() {
  // Course & Lab Hierarchy
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [activeLab, setActiveLab] = useState<Lab | null>(null);
  const [activeActivity, setActiveActivity] = useState<LabActivity | null>(null);

  // Student Persona & Physical Workstation
  const [activeStudent, setActiveStudent] = useState(DEMO_PERSONAS[0]);
  const [seatLabel, setSeatLabel] = useState('PC 01');

  // Files & Source Mode ('preset' | 'disk')
  const [sourceMode, setSourceMode] = useState<'preset' | 'disk'>('preset');
  const [activePresetKey, setActivePresetKey] = useState<string>('buggy_encapsulation');
  const [workspaceFiles, setWorkspaceFiles] = useState<DemoPresetFile[]>(DEFAULT_JAVA_PRESETS[0].files);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
  const [folderName, setFolderName] = useState<string>('Demo Sandbox');

  // Disk Handle Ref
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const [needsDiskReconnect, setNeedsDiskReconnect] = useState(false);

  // Chat & Telemetry Session State
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I am **Socratix**, your Socratic mentor. Ask a question or click **"💡 Stuck? Ask for a Hint"** to get guided through your milestones without giving away solutions.',
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

  // Layout Resizing
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(440);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper: Get syntax highlighting language
  const getSyntaxLanguage = (filename: string): string => {
    if (filename.endsWith('.java')) return 'java';
    if (filename.endsWith('.js') || filename.endsWith('.jsx')) return 'javascript';
    if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript';
    if (filename.endsWith('.json')) return 'json';
    return 'text';
  };

  // Helper: Read directory files filtered by course extensions
  const readDirectoryRecursive = useCallback(async (
    handle: FileSystemDirectoryHandle,
    extensions: string[],
    pathPrefix = ''
  ): Promise<DemoPresetFile[]> => {
    const collected: DemoPresetFile[] = [];
    for await (const entry of handle.values()) {
      const relPath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
      if (entry.kind === 'file') {
        const matchesExt = extensions.some((ext) => entry.name.toLowerCase().endsWith(ext.toLowerCase()));
        if (matchesExt) {
          const file = await (entry as FileSystemFileHandle).getFile();
          const content = await file.text();
          collected.push({ name: relPath, content });
        }
      } else if (entry.kind === 'directory') {
        const subFiles = await readDirectoryRecursive(
          entry as FileSystemDirectoryHandle,
          extensions,
          relPath
        );
        collected.push(...subFiles);
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

  // 2. Fetch Labs for Active Course
  useEffect(() => {
    if (!activeCourse) return;

    const supabase = getBrowserSupabase();
    async function fetchCourseLabs() {
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
    }
    fetchCourseLabs();
  }, [activeCourse]);

  // 3. Update Active Activity & Preset when Active Lab Changes
  useEffect(() => {
    if (!activeLab) return;

    const savedCtx = loadActiveContext();
    const act = activeLab.activities?.find((a) => a.id === savedCtx?.activityId)
      || activeLab.activities?.[0]
      || null;
    setActiveActivity(act);

    // Setup Presets
    const labPresets = activeLab.demo_presets && activeLab.demo_presets.length > 0
      ? activeLab.demo_presets
      : DEFAULT_JAVA_PRESETS;

    const targetPresetKey = savedCtx?.activePresetKey || labPresets[0].key;
    const targetPreset = labPresets.find((p) => p.key === targetPresetKey) || labPresets[0];

    setActivePresetKey(targetPreset.key);
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
      const editedFiles = loadPresetEdits(activeLab.id, targetPreset.key);
      setWorkspaceFiles(editedFiles || targetPreset.files);
      setFolderName(`Preset: ${targetPreset.label}`);
      setActiveFileIndex(0);
    }
  }, [activeLab, activeCourse, activeStudent.id, readDirectoryRecursive]);

  // 4. Restore Chat History & Session State from DB on Lab / Student Change
  useEffect(() => {
    if (!activeStudent || !activeLab) return;

    async function restoreSessionContext() {
      try {
        const res = await fetch(`/api/sessions/context?studentId=${activeStudent.id}&labId=${activeLab!.id}`);
        const data = await res.json();
        if (data.session) {
          setSessionState(data.session);
          if (data.session.seat_label) {
            setSeatLabel(data.session.seat_label);
          }
          if (data.session.completion_report) {
            setCompletionReport(data.session.completion_report);
            setCompletedMilestone(activeActivity?.title || 'Milestone Mastered');
          }
        }
        if (data.messages && data.messages.length > 0) {
          const chatItems: ChatItem[] = data.messages.map((m: {
            id: string;
            role: 'user' | 'assistant';
            content: string;
            course_reference?: StructuredCourseReference;
            latency_ms?: number;
          }) => ({
            id: m.id,
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
              content: `Hello ${activeStudent.name}! I am **Socratix**. Ask me a question or click **"💡 Stuck? Ask for a Hint"** to get guided on ${activeLab!.title}.`,
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
          let currentFiles = workspaceFiles;
          if (dirHandleRef.current) {
            try {
              currentFiles = await readDirectoryRecursive(
                dirHandleRef.current,
                activeCourse?.file_extensions || ['.java']
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
              source: sourceMode,
              timestamp: new Date().toISOString(),
            },
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(syncChannel);
    };
  }, [activeStudent.id, workspaceFiles, sourceMode, activeCourse, readDirectoryRecursive]);

  // Panel Resizing Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const maxAllowed = Math.min(800, window.innerWidth * 0.65);
      const newWidth = Math.max(300, Math.min(e.clientX, maxAllowed));
      setLeftPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
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
    dirHandleRef.current = null;
    setSourceMode('preset');
    setActivePresetKey(preset.key);
    setFolderName(`Preset: ${preset.label}`);
    setNeedsDiskReconnect(false);

    if (activeLab) {
      const edited = loadPresetEdits(activeLab.id, preset.key);
      setWorkspaceFiles(edited || preset.files);
    } else {
      setWorkspaceFiles(preset.files);
    }
    setActiveFileIndex(0);
  };

  // Restore Default Preset
  const handleRestorePreset = () => {
    if (!activeLab) return;
    clearPresetEdits(activeLab.id, activePresetKey);
    const presets = activeLab.demo_presets && activeLab.demo_presets.length > 0
      ? activeLab.demo_presets
      : DEFAULT_JAVA_PRESETS;
    const currentPreset = presets.find((p) => p.key === activePresetKey) || presets[0];
    setWorkspaceFiles(currentPreset.files);
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
        await fetch('/api/sessions/context', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
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
      await fetch('/api/sessions/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: activeStudent.id,
          labId: activeLab.id,
        }),
      });

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

  // Core Socratic Invocation (used by both submit and 1-click hint)
  const invokeTutor = async (userQuestion: string, isHint: boolean) => {
    if (!activeCourse || !activeLab || workspaceFiles.length === 0 || isAnalyzing) return;

    setIsAnalyzing(true);

    const userMessageContent = isHint
      ? '💡 [Asked for a Socratic Hint]'
      : userQuestion;

    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: 'user', content: userMessageContent },
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

      const conversationHistory = messages
        .filter((m) => !m.id.startsWith('welcome'))
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: activeCourse.id,
          labId: activeLab.id,
          activityId: activeActivity?.id,
          studentId: activeStudent.id,
          seatLabel,
          question: isHint ? '' : userQuestion,
          isHintRequest: isHint,
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
          },
        ]);

        if (data.session_state) {
          setSessionState(data.session_state);
        }

        // Trigger Milestone Completion celebration & competency report (aligned with v0-socratix)
        const isCompleted = Boolean(
          data.is_milestone_completed ||
          data.is_activity_completed ||
          data.is_lab_completed ||
          data.session_state?.progress_percent === 100 ||
          (data.session_state?.activities_progress && activeActivity?.id && data.session_state.activities_progress[activeActivity.id]?.percent === 100) ||
          (Array.isArray(data.competency_report?.mastered_concepts) && data.competency_report.mastered_concepts.length > 0 && !data.session_state?.has_unresolved_error)
        );

        if (isCompleted && data.competency_report) {
          const report = data.competency_report;
          const milestone = activeActivity?.title || activeLab?.title || 'Milestone Mastered';
          setCompletionReport(report);
          setCompletedMilestone(milestone);
          setIsCelebrationOpen(true);
          playCelebrationChime();
          triggerCelebrationConfetti();
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
    invokeTutor(text, false);
  };

  // 1-Click "Stuck? Ask for a Hint"
  const handleAskForHint = () => {
    invokeTutor('', true);
  };

  const activePresets = activeLab?.demo_presets && activeLab.demo_presets.length > 0
    ? activeLab.demo_presets
    : DEFAULT_JAVA_PRESETS;

  const currentFile = workspaceFiles[activeFileIndex] || { name: 'untitled', content: '' };
  const actProgress = activeActivity && sessionState?.activities_progress?.[activeActivity.id];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {/* ==================================================================== */}
      {/* LEFT PANEL: IDE & WORKSPACE (Resizable) */}
      {/* ==================================================================== */}
      <div
        style={{ width: `${leftPanelWidth}px` }}
        className={`shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-hidden ${
          isDragging ? '' : 'transition-[width] duration-100 ease-out'
        }`}
      >
        {/* Workspace Top Header: Course & Lab Selectors */}
        <div className="p-3 border-b border-slate-800 bg-slate-950/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-emerald-400">🦉 Socratix</span>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-[10px] px-1.5 py-0">
                Workspace v2
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsResetModalOpen(true)}
              className="h-7 text-[11px] text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 px-2 gap-1"
              title="Reset current student session"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
          </div>

          {/* Course & Lab Pickers */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Course</label>
              <select
                value={activeCourse?.id || ''}
                onChange={(e) => {
                  const c = courses.find((x) => x.id === e.target.value);
                  if (c) setActiveCourse(c);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Lab (TP)</label>
              <select
                value={activeLab?.id || ''}
                onChange={(e) => {
                  const l = labs.find((x) => x.id === e.target.value);
                  if (l) setActiveLab(l);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
              >
                {labs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} - {l.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Persona & Seat Selector */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800/80">
            <div>
              <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Student</label>
              <select
                value={activeStudent.id}
                onChange={(e) => {
                  const p = DEMO_PERSONAS.find((x) => x.id === e.target.value);
                  if (p) setActiveStudent(p);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
              >
                {DEMO_PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Seat</label>
              <select
                value={seatLabel}
                onChange={(e) => handleSeatChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 font-mono"
              >
                {SEAT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Activity & Milestone Brief (Collapsible) */}
        {activeLab && activeActivity && (
          <div className="border-b border-slate-800 bg-slate-950/40 p-3 space-y-2">
            {/* Multi-Activity 1-Click Tab Bar (Option B) */}
            {activeLab.activities && activeLab.activities.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 border-b border-slate-800/70">
                {activeLab.activities.map((act) => {
                  const isSelected = activeActivity.id === act.id;
                  const actProg = sessionState?.activities_progress?.[act.id];
                  const isCompleted = actProg?.percent === 100;
                  return (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setActiveActivity(act)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${
                        isSelected
                          ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-sm'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                      title={`Switch to Activity ${act.order}: ${act.title}`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isSelected ? 'bg-emerald-400 ring-2 ring-emerald-500/30' : 'bg-slate-600'
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
                <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-200 truncate">
                  Activity {activeActivity.order}: {activeActivity.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsBriefExpanded(!isBriefExpanded)}
                className="text-slate-400 hover:text-slate-200 text-xs shrink-0 p-1 hover:bg-slate-800/80 rounded transition-colors"
                title={isBriefExpanded ? "Hide activity brief & milestones" : "Show activity brief & milestones"}
              >
                {isBriefExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Dual Progress Gauges */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-slate-900 border border-slate-800 rounded p-1.5">
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Activity</span>
                  <span className="font-semibold text-emerald-400">
                    {actProgress ? `${actProgress.completed_milestones.length}/${actProgress.total_milestones}` : `0/${activeActivity.milestones.length}`}
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${actProgress?.percent || 0}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded p-1.5">
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Total Lab</span>
                  <span className="font-semibold text-cyan-400">
                    {sessionState?.progress_percent || 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-cyan-500 h-full transition-all duration-300"
                    style={{ width: `${sessionState?.progress_percent || 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Expanded Brief Details */}
            {isBriefExpanded && (
              <div className="pt-2 text-xs space-y-2 border-t border-slate-800/60">
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  {activeActivity.instructions_markdown}
                </p>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-semibold text-slate-500">Milestones Checklist</div>
                  {activeActivity.milestones.map((m) => {
                    const isDone = sessionState?.completed_milestone_ids?.includes(m.id);
                    return (
                      <div key={m.id} className="flex items-center gap-1.5 text-[11px]">
                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        )}
                        <span className={isDone ? 'text-emerald-300 line-through' : 'text-slate-300'}>
                          {m.title}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {activeActivity.target_files && activeActivity.target_files.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-slate-800/60">
                    <span className="text-[10px] uppercase font-semibold text-slate-500">Target Files:</span>
                    {activeActivity.target_files.map((file) => (
                      <Badge
                        key={file}
                        variant="outline"
                        className="text-[10px] font-mono text-emerald-400 border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0"
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
        <div className="p-3 border-b border-slate-800 bg-slate-900/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-400 flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-emerald-400" />
              Source: <span className="text-slate-200">{folderName}</span>
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectFolder}
                className="h-6 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700 hover:border-emerald-500/50 px-2.5 gap-1.5 transition-all shadow-sm"
              >
                <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                Folder
              </Button>
            </div>
          </div>

          {/* Quick Presets Buttons */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {activePresets.map((preset) => (
              <button
                key={preset.key}
                onClick={() => handleSelectPreset(preset)}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  sourceMode === 'preset' && activePresetKey === preset.key
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
            {sourceMode === 'preset' && (
              <button
                onClick={handleRestorePreset}
                className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-500 hover:text-slate-300"
                title="Restore default preset code"
              >
                ↺ Restore
              </button>
            )}
          </div>

          {/* Disk Reconnection Banner after F5 */}
          {needsDiskReconnect && (
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-300 flex items-center justify-between">
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
        <div className="flex bg-slate-950/70 border-b border-slate-800 overflow-x-auto text-xs px-2 pt-1 gap-1">
          {workspaceFiles.map((file, idx) => (
            <button
              key={file.name}
              onClick={() => setActiveFileIndex(idx)}
              className={`px-3 py-1.5 rounded-t font-mono text-xs border-t border-l border-r transition-colors ${
                activeFileIndex === idx
                  ? 'bg-slate-900 border-slate-800 text-emerald-400 font-semibold'
                  : 'bg-slate-950/40 border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {file.name.split('/').pop()}
            </button>
          ))}
        </div>

        {/* Code Editor / Viewer */}
        <div className="flex-1 min-h-0 bg-slate-950 relative overflow-hidden">
          {sourceMode === 'disk' ? (
            <div className="h-full overflow-y-auto p-4">
              <SyntaxHighlighter
                language={getSyntaxLanguage(currentFile.name)}
                style={vscDarkPlus}
                customStyle={{
                  background: 'transparent',
                  margin: 0,
                  fontSize: '12px',
                  lineHeight: '1.5',
                }}
                showLineNumbers
              >
                {currentFile.content || '// Empty file'}
              </SyntaxHighlighter>
            </div>
          ) : (
            <textarea
              value={currentFile.content}
              onChange={(e) => handleCodeChange(e.target.value)}
              className="w-full h-full block p-4 bg-transparent text-slate-200 font-mono text-xs leading-relaxed focus:outline-none resize-none overflow-y-auto"
              spellCheck={false}
            />
          )}
        </div>

        {/* Editor Footer Status */}
        <div className="px-3 py-1 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between">
          <span>{currentFile.name}</span>
          <span>{sourceMode === 'disk' ? 'Disk (Read Only)' : 'Preset (Editable)'}</span>
        </div>
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={() => setIsDragging(true)}
        className="w-1.5 bg-slate-800 hover:bg-emerald-500 cursor-col-resize shrink-0 transition-colors"
      />

      {/* ==================================================================== */}
      {/* RIGHT PANEL: SOCRATIC CHAT & GUIDANCE */}
      {/* ==================================================================== */}
      <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
        {/* Chat Header */}
        <div className="p-3.5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-sm text-slate-100">Socratic Mentor</span>
            {activeLab && (
              <Badge variant="outline" className="text-xs text-slate-400 border-slate-700">
                {activeLab.code}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Target:</span>
            <span className="font-mono text-emerald-400 font-medium">
              {activeStudent.name} ({seatLabel})
            </span>
          </div>
        </div>

        {/* Pinned Milestone Completion Banner (v0-socratix) */}
        {completionReport && (
          <div className="mx-4 mt-3 p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border border-emerald-500/50 flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-emerald-950/40 animate-in fade-in slide-in-from-top-2 duration-300 shrink-0">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </span>
              <div>
                <div className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider flex items-center gap-2">
                  <span>🏆 Milestone Mastered</span>
                  <span className="text-slate-500">•</span>
                  <span>{completedMilestone || activeActivity?.title || 'Milestone Mastered'}</span>
                </div>
                <div className="text-xs text-slate-300 mt-0.5">
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
                className="text-xs text-slate-400 hover:text-emerald-400 h-8 px-2.5 flex items-center gap-1.5 hover:bg-slate-800"
                title="Replay Celebration Sound & Fireworks"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Replay 🎉</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsCelebrationOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs h-8 px-3.5 rounded-lg shadow-md"
              >
                View Report Card 🏆
              </Button>
            </div>
          </div>
        )}

        {/* Dialogue Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-none'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none space-y-2'
                }`}
              >
                <div className="prose prose-invert prose-xs max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>

                {/* Socratic Slide Citation Pill */}
                {msg.courseReference && (
                  <div className="pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => {
                        setActiveSlideReference(msg.courseReference || null);
                        setIsSlideModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-[11px] font-medium"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{msg.courseReference.label}</span>
                      <span className="text-[10px] text-emerald-300 font-mono">
                        (Slide #{msg.courseReference.page_number})
                      </span>
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
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-slate-900/60 border border-slate-800 rounded-xl p-3 w-fit animate-pulse">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>Analyzing code socratic-style with muse-spark-1.3...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input & Action Bar */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/40">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            {/* 1-Click Hint Button */}
            <Button
              type="button"
              onClick={handleAskForHint}
              disabled={isAnalyzing}
              className="h-10 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-semibold text-xs px-3.5 rounded-xl gap-1.5 shadow-md shadow-amber-950/20 shrink-0"
              title="Get an instant Socratic hint for your active milestone"
            >
              <Lightbulb className="w-4 h-4 text-slate-950 fill-slate-950" />
              <span>Stuck? Hint</span>
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
              className="flex-1 bg-slate-900 border-slate-800 text-xs h-10 rounded-xl focus-visible:ring-emerald-500"
            />

            <Button
              type="submit"
              disabled={isAnalyzing || !input.trim()}
              className="h-10 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 rounded-xl gap-1.5 shadow-md shadow-emerald-950/20"
            >
              <Send className="w-3.5 h-3.5" />
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
      />

      {/* Custom Dark-Themed Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-100">
                  Reset Student Session?
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Reset session for <span className="font-semibold text-slate-200">{activeStudent.name}</span> on{' '}
                  <span className="font-semibold text-slate-200">{activeLab?.title || 'this lab'}</span>? This will clear all dialogue history, code edits, and telemetry.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResetting}
                className="h-8 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 hover:border-slate-600"
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
    </div>
  );
}
