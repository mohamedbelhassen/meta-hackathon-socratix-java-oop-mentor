'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, Send, FileCode, Sparkles, BookOpen, UserCheck } from 'lucide-react';

// Types for chat messages and local Java files
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  courseReference?: string;
  inspectedFiles?: string[];
  latencyMs?: number;
}

export interface JavaFile {
  name: string;
  content: string;
}

// Fixed UUIDs from supabase/seed.sql for seamless Hackathon Demo
const DEMO_PROFILES = [
  {
    id: '33333333-3333-3333-3333-333333333333',
    label: 'Bob (Room A0-10 - PC 02)',
    mode: 'Student',
    room: 'Room A0-10',
    pc: 'PC 02',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    label: 'Guest (Room A0-10 - PC 12)',
    mode: 'Guest',
    room: 'Room A0-10',
    pc: 'PC 12',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    label: 'Alice (Room A0-10 - PC 01)',
    mode: 'Student',
    room: 'Room A0-10',
    pc: 'PC 01',
  },
];

const ACTIVE_LAB_SESSION_ID = '55555555-5555-5555-5555-555555555555';

// Demo Presets so Hackathon Judges can test in 1 click without local Java files
const DEMO_CODE_PRESETS: Record<string, JavaFile[]> = {
  buggy_encapsulation: [
    {
      name: 'Item.java',
      content: `public class Item {\n  double price; // Missing private modifier!\n  String name;\n\n  public Item(String name, double price) {\n    this.name = name;\n    this.price = price;\n  }\n}`,
    },
    {
      name: 'YallaPOS.java',
      content: `public class YallaPOS {\n  public static void main(String[] args) {\n    Item item = new Item("Coffee", 4.5);\n    item.price = -100.0; // Direct unsafe access!\n  }\n}`,
    },
  ],
  buggy_polymorphism: [
    {
      name: 'YallaPOS.java',
      content: `public class YallaPOS {\n  public static void main(String[] args) {\n    Article[] cart = new Article[10];\n    cart[0] = new Service("Home Delivery", 15.0); // ERROR: Service is not an Article\n  }\n}`,
    },
    {
      name: 'Facturable.java',
      content: `public interface Facturable {\n  double getMontantTTC();\n}`,
    },
  ],
  fixed_polymorphism: [
    {
      name: 'YallaPOS.java',
      content: `public class YallaPOS {\n  public static void main(String[] args) {\n    Facturable[] cart = new Facturable[10];\n    cart[0] = new Service("Home Delivery", 15.0);\n  }\n}`,
    },
    {
      name: 'Facturable.java',
      content: `public interface Facturable {\n  double getMontantTTC();\n}`,
    },
  ],
};

export default function StudentWorkspace() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I am **Socratix**. Ask me a question about your *Yalla POS* project. I will read your local files to help you move forward without giving you the direct solution.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');

  // Active Student Profile (Defaults to Bob for the Red-to-Green Live Demo)
  const [activeProfile, setActiveProfile] = useState(DEMO_PROFILES[0]);

  // Local Java Workspace state
  const [selectedFolder, setSelectedFolder] = useState<string | null>('Demo Sandbox (YallaPOS)');
  const [workspaceFiles, setWorkspaceFiles] = useState<JavaFile[]>(DEMO_CODE_PRESETS.buggy_encapsulation);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);

  // Keep reference to FileSystemDirectoryHandle for automatic re-reading before every chat message
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAnalyzing]);

  // Helper: Recursively read all .java files from a FileSystemDirectoryHandle
  const readJavaDirectoryRecursive = async (
    handle: FileSystemDirectoryHandle,
    pathPrefix = ''
  ): Promise<JavaFile[]> => {
    const collected: JavaFile[] = [];
    for await (const entry of handle.values()) {
      const relativePath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
      if (entry.kind === 'file' && entry.name.endsWith('.java')) {
        const file = await (entry as FileSystemFileHandle).getFile();
        const content = await file.text();
        collected.push({ name: relativePath, content });
      } else if (entry.kind === 'directory') {
        const subFiles = await readJavaDirectoryRecursive(
          entry as FileSystemDirectoryHandle,
          relativePath
        );
        collected.push(...subFiles);
      }
    }
    return collected;
  };

  // Open Native Browser Directory Picker (File System Access API)
  const handleSelectFolder = async () => {
    try {
      if (!window.showDirectoryPicker) {
        alert(
          'Your browser does not support the File System Access API. Please use Chrome or Edge, or use the built-in Demo Presets below.'
        );
        return;
      }

      const dirHandle = await window.showDirectoryPicker();
      dirHandleRef.current = dirHandle;
      setSelectedFolder(dirHandle.name);

      const filesData = await readJavaDirectoryRecursive(dirHandle);
      setWorkspaceFiles(filesData);
      setActiveFileIndex(0);
    } catch (err) {
      console.warn('Directory selection cancelled or failed:', err);
    }
  };

  // Load a 1-Click Judge Demo Preset
  const handleLoadPreset = (presetKey: string, label: string) => {
    dirHandleRef.current = null;
    setSelectedFolder(label);
    setWorkspaceFiles(DEMO_CODE_PRESETS[presetKey]);
    setActiveFileIndex(0);
  };

  // Send question + Ghost Context (.java files) to /api/tutor
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || workspaceFiles.length === 0 || isAnalyzing) return;

    const userText = input.trim();
    setInput('');
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: 'user', content: userText },
    ]);

    // Contextual Multi-Step Loading Animation
    setIsAnalyzing(true);
    setLoadingStep('Fetching local Java files...');

    const stepTimer = setTimeout(() => {
      setLoadingStep('Socratic analysis by muse-spark-1.3...');
    }, 1200);

    try {
      // If a real local folder is linked via File System Access API, re-read fresh disk contents!
      let currentFiles = workspaceFiles;
      if (dirHandleRef.current) {
        currentFiles = await readJavaDirectoryRecursive(dirHandleRef.current);
        setWorkspaceFiles(currentFiles);
      }

      const startTime = performance.now();

      // Ghost Context: Silently attach current .java files + studentId + labSessionId
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userText,
          files: currentFiles,
          studentId: activeProfile.id,
          labSessionId: ACTIVE_LAB_SESSION_ID,
        }),
      });

      const data = await response.json();
      const elapsedMs = Math.round(performance.now() - startTime);

      if (data.success && data.data?.socratic_reply) {
        const reply = data.data.socratic_reply;
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: reply.message_markdown,
            courseReference: reply.course_reference,
            inspectedFiles: reply.inspected_files,
            latencyMs: data.meta?.latency_ms || elapsedMs,
          },
        ]);
      } else {
        throw new Error(data.error || 'Failed to analyze code');
      }
    } catch (error) {
      console.error('Tutor API error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Sorry, an error occurred during the analysis. Please check your connection.',
        },
      ]);
    } finally {
      clearTimeout(stepTimer);
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {/* LEFT PANEL: WORKSPACE (IDE Sidebar) */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col">
        {/* Workspace Header */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
              🦉 Socratix Workspace
            </h1>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px]">
              Zero-Install
            </Badge>
          </div>

          {/* Student / Workstation Selector for Demo */}
          <div className="mt-3 space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-emerald-400" /> Active Session Identity
            </label>
            <select
              value={activeProfile.id}
              onChange={(e) => {
                const found = DEMO_PROFILES.find((p) => p.id === e.target.value);
                if (found) setActiveProfile(found);
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {DEMO_PROFILES.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
            <div className="text-xs text-slate-400 pt-1 flex items-center justify-between">
              <span>👤 Mode: {activeProfile.mode}</span>
              <span>
                📍 {activeProfile.room} - {activeProfile.pc}
              </span>
            </div>
          </div>
        </div>

        {/* File System Access API Trigger */}
        <div className="p-4 border-b border-slate-800 space-y-2">
          <Button
            onClick={handleSelectFolder}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2"
          >
            <FolderOpen className="w-4 h-4" />
            {selectedFolder ? `Linked: ${selectedFolder}` : 'Link Java Lab Folder'}
          </Button>

          {/* 1-Click Judge Presets */}
          <div className="pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Judge Quick Presets (No Local Files Needed)
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() =>
                  handleLoadPreset('buggy_encapsulation', 'Preset 1: Missing private (Lab 5)')
                }
                className="text-left text-[11px] px-2.5 py-1.5 rounded bg-slate-800/80 hover:bg-slate-800 text-rose-300 border border-rose-500/20 transition"
              >
                🔴 Load Buggy Encapsulation (Lab 5)
              </button>
              <button
                type="button"
                onClick={() =>
                  handleLoadPreset('buggy_polymorphism', 'Preset 2: Array Type Error (Lab 9)')
                }
                className="text-left text-[11px] px-2.5 py-1.5 rounded bg-slate-800/80 hover:bg-slate-800 text-amber-300 border border-amber-500/20 transition"
              >
                🟠 Load Buggy Array Type (Lab 9)
              </button>
              <button
                type="button"
                onClick={() =>
                  handleLoadPreset('fixed_polymorphism', 'Preset 3: Fixed Facturable[] (Lab 9)')
                }
                className="text-left text-[11px] px-2.5 py-1.5 rounded bg-slate-800/80 hover:bg-slate-800 text-emerald-300 border border-emerald-500/20 transition"
              >
                🟢 Load Fixed Facturable[] (Flip Bob to Green!)
              </button>
            </div>
          </div>
        </div>

        {/* Linked Java Files List & Live Code Inspector */}
        <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Linked Files (Yalla POS)
              </h2>
              <span className="text-[11px] font-mono text-emerald-400">
                {workspaceFiles.length} file(s)
              </span>
            </div>
            <ul className="space-y-1.5">
              {workspaceFiles.map((file, idx) => (
                <li
                  key={idx}
                  onClick={() => setActiveFileIndex(idx)}
                  className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md cursor-pointer transition ${
                    activeFileIndex === idx
                      ? 'bg-slate-800 text-emerald-300 border border-slate-700'
                      : 'text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  <FileCode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono truncate">{file.name}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Editable Live Code Preview */}
          {workspaceFiles[activeFileIndex] && (
            <div className="flex-1 flex flex-col min-h-[180px]">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span className="font-mono text-emerald-400">
                  {workspaceFiles[activeFileIndex].name}
                </span>
                <span className="text-[10px] text-slate-500">Live Buffer</span>
              </div>
              <textarea
                value={workspaceFiles[activeFileIndex].content}
                onChange={(e) => {
                  const updated = [...workspaceFiles];
                  updated[activeFileIndex] = {
                    ...updated[activeFileIndex],
                    content: e.target.value,
                  };
                  setWorkspaceFiles(updated);
                }}
                spellCheck={false}
                className="w-full flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 resize-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: SOCRATIC CHAT */}
      <div className="flex-1 flex flex-col bg-slate-950 relative">
        {/* Chat Header */}
        <div className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h2 className="font-semibold text-slate-100">AI Tutor - Java OOP</h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-400">
              muse-spark-1.3
            </span>
            <span className="hidden sm:inline text-slate-500">Prompt Caching Active</span>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl rounded-2xl p-4 shadow-md ${
                  msg.role === 'user'
                    ? 'bg-emerald-700 text-white rounded-br-none'
                    : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div>
                    <div className="prose prose-invert prose-emerald max-w-none text-sm leading-relaxed">
                      <ReactMarkdown
                        components={{
                          code({ className, children }: React.ComponentPropsWithoutRef<'code'>) {
                            const match = /language-(\w+)/.exec(className || '');
                            const codeString = String(children).replace(/\n$/, '');
                            const isMultiLine = match || codeString.includes('\n');

                            return isMultiLine ? (
                              <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match ? match[1] : 'java'}
                                PreTag="div"
                                className="rounded-md my-2 text-xs"
                              >
                                {codeString}
                              </SyntaxHighlighter>
                            ) : (
                              <code className="bg-slate-900 text-emerald-300 px-1.5 py-0.5 rounded text-xs font-mono">
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>

                    {/* Course Slide Reference & Telemetry Footer */}
                    {msg.courseReference && (
                      <div className="mt-3 pt-2.5 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                          <BookOpen className="w-3.5 h-3.5" />
                          {msg.courseReference}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                          {msg.inspectedFiles && msg.inspectedFiles.length > 0 && (
                            <span>Inspected: {msg.inspectedFiles.join(', ')}</span>
                          )}
                          {msg.latencyMs && (
                            <span className="text-emerald-400/80">⚡ {msg.latencyMs}ms</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm">{msg.content}</div>
                )}
              </div>
            </div>
          ))}

          {/* Dynamic Contextual Loading Indicator */}
          {isAnalyzing && (
            <div className="flex justify-start">
              <div className="bg-slate-800/60 border border-slate-700 rounded-2xl rounded-bl-none p-4 flex items-center gap-3 shadow-md">
                <div className="flex gap-1">
                  <span
                    className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  ></span>
                  <span
                    className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  ></span>
                  <span
                    className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  ></span>
                </div>
                <span className="text-xs text-slate-400 font-mono animate-pulse">
                  {loadingStep}
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-2">
            <Input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isAnalyzing || workspaceFiles.length === 0}
              placeholder={
                workspaceFiles.length > 0
                  ? 'Ask a question about your code...'
                  : 'Link a Java folder to start'
              }
              className="flex-1 bg-slate-950 border-slate-700 text-white h-11 focus-visible:ring-emerald-500"
            />
            <Button
              type="submit"
              disabled={!input.trim() || isAnalyzing || workspaceFiles.length === 0}
              className="h-11 px-5 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <Send className="w-4 h-4 mr-1.5" />
              Ask Socratix
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
