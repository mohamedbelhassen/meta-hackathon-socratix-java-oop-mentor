'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, X, Code2, MessageSquare, Activity } from 'lucide-react';

// Initialize Supabase client (using public anon key for frontend Realtime)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// TypeScript Interfaces based on our English Supabase schema
interface StudentProfile {
  display_name: string;
}

interface CompetencyRecord {
  id: string;
  student_id: string;
  lab_session_id: string;
  current_milestone: string;
  milestone_status: 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'VALIDATED';
  chapter: string;
  micro_concept: string;
  score_delta: number;
  mastery_score?: number;
  last_diagnostic_note: string;
  updated_at: string;
  profiles: StudentProfile | null; // Joined foreign key data
}

interface ChatMessageRecord {
  id: string;
  role: 'user' | 'assistant' | 'teacher_override';
  content: string;
  code_snapshot: Array<{ name: string; content: string }> | Record<string, unknown>;
  created_at: string;
}

export default function TeacherDashboardMatrix() {
  const [records, setRecords] = useState<CompetencyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // State for inspecting a specific student's Chat History & Targeted Code Snapshot
  const [selectedRecord, setSelectedRecord] = useState<CompetencyRecord | null>(null);
  const [studentMessages, setStudentMessages] = useState<ChatMessageRecord[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);

  // Fetch initial telemetry data and subscribe to Supabase Realtime changes
  useEffect(() => {
    fetchTelemetryData();

    // Set up Supabase Realtime Subscription on student_competencies
    const channel = supabase
      .channel('realtime-telemetry')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, and DELETE
          schema: 'public',
          table: 'student_competencies',
        },
        (payload) => {
          console.log('Realtime update received!', payload);
          // Re-fetch data to ensure we have the joined profile display_name
          fetchTelemetryData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTelemetryData = async () => {
    try {
      const { data, error } = await supabase
        .from('student_competencies')
        .select(`
          *,
          profiles ( display_name )
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setRecords((data as unknown as CompetencyRecord[]) || []);
    } catch (error) {
      console.error('Error fetching telemetry:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load targeted JSONB code_snapshot and Socratic chat history when clicking a student
  const handleInspectStudent = async (record: CompetencyRecord) => {
    setSelectedRecord(record);
    setIsLoadingChat(true);
    try {
      const { data: sessionData } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('student_id', record.student_id)
        .eq('lab_session_id', record.lab_session_id)
        .maybeSingle();

      if (sessionData?.id) {
        const { data: messagesData } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionData.id)
          .order('created_at', { ascending: true });

        setStudentMessages((messagesData as ChatMessageRecord[]) || []);
      } else {
        setStudentMessages([]);
      }
    } catch (err) {
      console.error('Error loading student chat history:', err);
      setStudentMessages([]);
    } finally {
      setIsLoadingChat(false);
    }
  };

  // Standardized Status Badges
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
      case 'VALIDATED':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30">
            COMPLETED
          </Badge>
        );
      case 'IN_PROGRESS':
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/50 hover:bg-amber-500/30">
            IN PROGRESS
          </Badge>
        );
      case 'BLOCKED':
        return (
          <Badge className="bg-rose-500/20 text-rose-400 border border-rose-500/50 animate-pulse hover:bg-rose-500/30">
            BLOCKED
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-700 text-slate-300 border border-slate-600">
            {status || 'UNKNOWN'}
          </Badge>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-slate-200 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
              📊 Live Class Telemetry Matrix
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Real-time Socratic AI monitoring for Yalla POS Lab Sessions (FSG)
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/30 px-3.5 py-1.5 rounded-full border border-emerald-900/50 self-start sm:self-auto">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Supabase Realtime Active
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                Completed Concepts
              </p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                {records.filter((r) => r.milestone_status === 'COMPLETED').length}
              </p>
            </div>
            <Activity className="w-8 h-8 text-emerald-500/30" />
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                In Progress
              </p>
              <p className="text-2xl font-bold text-amber-400 mt-1">
                {records.filter((r) => r.milestone_status === 'IN_PROGRESS').length}
              </p>
            </div>
            <Activity className="w-8 h-8 text-amber-500/30" />
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                Blocked (Needs Attention)
              </p>
              <p className="text-2xl font-bold text-rose-400 mt-1">
                {records.filter((r) => r.milestone_status === 'BLOCKED').length}
              </p>
            </div>
            <Activity className="w-8 h-8 text-rose-500/30" />
          </div>
        </div>

        {/* Matrix Table (shadcn/ui Table) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500 animate-pulse">
              Loading telemetry data...
            </div>
          ) : records.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No telemetry data recorded for this session yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-950 border-b border-slate-800 hover:bg-slate-950">
                  <TableHead className="p-4 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                    Student
                  </TableHead>
                  <TableHead className="p-4 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                    Current Milestone
                  </TableHead>
                  <TableHead className="p-4 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                    Micro Concept
                  </TableHead>
                  <TableHead className="p-4 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                    Status
                  </TableHead>
                  <TableHead className="p-4 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                    AI Diagnostic Note
                  </TableHead>
                  <TableHead className="p-4 text-right text-xs uppercase tracking-wider text-slate-500 font-semibold">
                    Inspect
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-800/50">
                {records.map((record) => (
                  <TableRow
                    key={record.id}
                    className="hover:bg-slate-800/30 transition-colors border-slate-800/50"
                  >
                    <TableCell className="p-4 font-medium text-slate-200">
                      {record.profiles?.display_name || 'Unknown Student'}
                    </TableCell>
                    <TableCell className="p-4 text-sm font-mono text-slate-400">
                      {record.current_milestone}
                    </TableCell>
                    <TableCell className="p-4">
                      <span className="text-xs font-mono bg-slate-800 border border-slate-700 px-2 py-1 rounded text-slate-300">
                        {record.micro_concept}
                      </span>
                    </TableCell>
                    <TableCell className="p-4">
                      {getStatusBadge(record.milestone_status)}
                    </TableCell>
                    <TableCell
                      className="p-4 text-sm text-slate-400 max-w-xs truncate"
                      title={record.last_diagnostic_note || 'No diagnostic note'}
                    >
                      {record.last_diagnostic_note || (
                        <span className="italic opacity-50">No diagnostic note</span>
                      )}
                    </TableCell>
                    <TableCell className="p-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleInspectStudent(record)}
                        className="h-8 text-xs bg-slate-950 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-emerald-400"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1.5" />
                        Code & Chat
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Targeted JSONB Code Snapshot & Socratic Chat Inspector Drawer */}
        {selectedRecord && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  🔍 Student Workspace Inspection:{' '}
                  <span className="text-emerald-400">
                    {selectedRecord.profiles?.display_name || 'Unknown Student'}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Milestone: <code className="text-slate-300">{selectedRecord.current_milestone}</code> •
                  Concept: <code className="text-slate-300">{selectedRecord.micro_concept}</code>
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {isLoadingChat ? (
              <div className="p-6 text-center text-slate-500 animate-pulse text-sm">
                Loading targeted JSONB code snapshot and chat history...
              </div>
            ) : studentMessages.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                No Socratic chat messages recorded for this student yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Socratic Dialogue */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    Socratic Conversation Log
                  </h3>
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                    {studentMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-lg text-xs leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-emerald-950/40 border border-emerald-800/50 text-emerald-200'
                            : 'bg-slate-950 border border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="font-bold uppercase text-[10px] text-slate-400 mb-1">
                          {msg.role === 'user' ? 'Student Question' : 'Socratix (muse-spark-1.3)'}
                        </div>
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column: Targeted JSONB Code Snapshot */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                    Targeted JSONB Code Snapshot (Inspected Files Only)
                  </h3>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {studentMessages
                      .filter(
                        (m) =>
                          m.role === 'user' &&
                          Array.isArray(m.code_snapshot) &&
                          m.code_snapshot.length > 0
                      )
                      .slice(-1)
                      .map((msg) =>
                        (msg.code_snapshot as Array<{ name: string; content: string }>).map(
                          (file, i) => (
                            <div
                              key={i}
                              className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden"
                            >
                              <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-xs font-mono text-emerald-400">
                                {file.name}
                              </div>
                              <pre className="p-3 text-xs font-mono text-slate-300 overflow-x-auto">
                                {file.content}
                              </pre>
                            </div>
                          )
                        )
                      )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
