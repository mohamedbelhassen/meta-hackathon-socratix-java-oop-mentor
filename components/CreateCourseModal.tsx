'use client';

import React, { useState } from 'react';
import { Course } from '@/types/socratix';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  X,
  BookPlus,
  Sparkles,
  AlertCircle,
  FileCode,
  Globe2,
  Clock,
  Check,
} from 'lucide-react';

interface CreateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCourseCreated: (newCourse: Course) => void;
}

export default function CreateCourseModal({
  isOpen,
  onClose,
  onCourseCreated,
}: CreateCourseModalProps) {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentLanguage, setContentLanguage] = useState<'fr' | 'en' | 'ar'>('fr');
  const [tutorLanguage, setTutorLanguage] = useState<'en' | 'fr'>('en');
  const [fileExtensions, setFileExtensions] = useState('');
  const [stuckThresholdTurns, setStuckThresholdTurns] = useState(2);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const PRESET_CONFIGS = [
    {
      name: 'Web Dev',
      exts: '.html, .htm, .css, .js',
      code: 'WEB_DEV',
      title: 'Modern Web Development (HTML5, CSS3 & JavaScript)',
      badgeColor: 'border-amber-500/30 text-amber-300 bg-amber-500/10',
    },
    {
      name: 'Kotlin',
      exts: '.kt, .kts',
      code: 'KOTLIN_DEV',
      title: 'Kotlin Programming & Android Fundamentals',
      badgeColor: 'border-purple-500/30 text-purple-300 bg-purple-500/10',
    },
    {
      name: 'React Native',
      exts: '.tsx, .jsx, .ts, .js, .json',
      code: 'REACT_NATIVE',
      title: 'Cross-Platform Mobile Apps with React Native & Expo',
      badgeColor: 'border-cyan-500/30 text-cyan-300 bg-cyan-500/10',
    },
    {
      name: 'Java',
      exts: '.java',
      code: 'JAVA_OOP',
      title: 'Object-Oriented Programming in Java',
      badgeColor: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10',
    },
    {
      name: 'Python',
      exts: '.py',
      code: 'PYTHON_AI',
      title: 'Python for Data Science & AI',
      badgeColor: 'border-blue-500/30 text-blue-300 bg-blue-500/10',
    },
    {
      name: 'TypeScript',
      exts: '.ts, .tsx, .js',
      code: 'FULLSTACK_TS',
      title: 'Full-Stack TypeScript & Node.js',
      badgeColor: 'border-sky-500/30 text-sky-300 bg-sky-500/10',
    },
    {
      name: 'C',
      exts: '.c, .h',
      code: 'C_SYSTEMS',
      title: 'Systems Programming in C',
      badgeColor: 'border-slate-500/30 text-slate-300 bg-slate-500/10',
    },
    {
      name: 'C++',
      exts: '.cpp, .hpp',
      code: 'CPP_ALGO',
      title: 'Modern C++ & Algorithms',
      badgeColor: 'border-indigo-500/30 text-indigo-300 bg-indigo-500/10',
    },
  ];

  const handleApplyPreset = (preset: typeof PRESET_CONFIGS[0]) => {
    setFileExtensions(preset.exts);
    if (!code.trim()) {
      setCode(preset.code);
    }
    if (!title.trim()) {
      setTitle(preset.title);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const cleanTitle = title.trim();

    if (!cleanCode) {
      setError('Course code is required (e.g. PYTHON_AI, C_SYSTEMS).');
      return;
    }
    if (!cleanTitle) {
      setError('Course title is required.');
      return;
    }

    const extensionsArray = fileExtensions
      .split(',')
      .map((ext) => ext.trim())
      .filter((ext) => ext.length > 0)
      .map((ext) => (ext.startsWith('.') ? ext : `.${ext}`));

    if (extensionsArray.length === 0) {
      setError('Please specify at least one file extension (e.g. .c, .h or .py), or click one of the quick presets below.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/studio/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          title: cleanTitle,
          description: description.trim() || undefined,
          content_language: contentLanguage,
          tutor_language: tutorLanguage,
          file_extensions: extensionsArray,
          stuck_threshold_turns: stuckThresholdTurns,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to create course');
      }

      onCourseCreated(data.course);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Course creation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <BookPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Create New Course
                <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
                  Course Studio
                </Badge>
              </h2>
              <p className="text-xs text-slate-400">
                Register a new curriculum before importing chapters and lab statements.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Code & Title */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Course Code <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. PYTHON_AI"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                required
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Unique uppercase identifier</span>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Course Title <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Python for Data Science & AI"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                required
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Full official course title</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              Pedagogical Description
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Comprehensive university course covering object-oriented programming, design patterns, and defensive programming in Java."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          {/* Languages & File Extensions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1 flex items-center gap-1">
                <Globe2 className="w-3.5 h-3.5 text-slate-400" />
                Slides Language
              </label>
              <select
                value={contentLanguage}
                onChange={(e) => setContentLanguage(e.target.value as 'fr' | 'en' | 'ar')}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="fr">French (Français)</option>
                <option value="en">English (English)</option>
                <option value="ar">Arabic (العربية)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Tutor Dialogue
              </label>
              <select
                value={tutorLanguage}
                onChange={(e) => setTutorLanguage(e.target.value as 'en' | 'fr')}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="en">English (Jury Default)</option>
                <option value="fr">French (Français)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1 flex items-center gap-1">
                <FileCode className="w-3.5 h-3.5 text-sky-400" />
                File Extensions
              </label>
              <input
                type="text"
                placeholder="e.g. .c, .h or .py or .java"
                value={fileExtensions}
                onChange={(e) => setFileExtensions(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Comma-separated (e.g. <code className="text-slate-400">.c, .h</code>)
              </span>
            </div>
          </div>

          {/* Quick Extension Chips & Presets */}
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" /> Curriculum Presets (Click to Auto-Configure):
              </span>
              <span className="text-slate-500">Includes Web, Kotlin, React Native</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESET_CONFIGS.map((preset) => {
                const isSelected = fileExtensions === preset.exts;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`text-[10px] px-2.5 py-1 rounded-lg font-mono transition border flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-950/40'
                        : `bg-slate-800/80 hover:bg-slate-700 text-slate-300 ${preset.badgeColor}`
                    }`}
                    title={`Click to apply ${preset.name} preset (${preset.exts})`}
                  >
                    <span className="font-sans font-bold">{preset.name}</span>
                    <span className="text-[9px] opacity-75">({preset.exts.split(',')[0]}...)</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stuck Threshold & Dual Criteria */}
          <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-2xl space-y-2">
            <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Stuck Threshold (Turns before BLOCKED status)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={5}
                value={stuckThresholdTurns}
                onChange={(e) => setStuckThresholdTurns(Number(e.target.value))}
                className="w-16 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 text-center font-bold focus:outline-none focus:border-emerald-500 shrink-0"
              />
              <div className="text-[11px] text-slate-400 leading-relaxed">
                Marks an active student as <span className="text-rose-400 font-semibold">🔴 BLOCKED</span> if they fail for{' '}
                <span className="text-slate-200 font-semibold">&ge; {stuckThresholdTurns} consecutive turns</span> with unresolved errors{' '}
                <span className="text-amber-300/90 font-medium">OR</span> remain stuck on the same milestone for{' '}
                <span className="text-slate-200 font-semibold">&ge; 10 minutes</span> without progress.
              </div>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5 px-4 font-semibold"
            >
              {isSubmitting ? (
                <span>Creating...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Create Course</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
