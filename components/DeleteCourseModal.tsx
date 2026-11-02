'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Course } from '@/types/socratix';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  X,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';

interface DeleteCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course | null;
  onCourseDeleted: (courseId: string) => void;
}

/**
 * Synthesizes a soft, native rejection buzzer using HTML5 Web Audio API.
 * Plays two rapid, low-pass filtered low tones (180Hz -> 130Hz) without external assets.
 */
function playErrorBuzzer() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const startTime = ctx.currentTime;

    const tones = [180, 130];
    tones.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, startTime + idx * 0.1);

      gain.gain.setValueAtTime(0, startTime + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.12, startTime + idx * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + idx * 0.1 + 0.12);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, startTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime + idx * 0.1);
      osc.stop(startTime + idx * 0.1 + 0.13);
    });
  } catch (err) {
    console.warn('Web Audio buzzer error:', err);
  }
}

export default function DeleteCourseModal({
  isOpen,
  onClose,
  course,
  onCourseDeleted,
}: DeleteCourseModalProps) {
  const defaultDemoPin = process.env.NEXT_PUBLIC_JURY_PIN || '2026';
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setPin('');
    setShowPin(false);
    setIsDeleting(false);
    setIsShaking(false);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  // Zero-retention policy: reset input whenever modal opens, closes, or course changes
  useEffect(() => {
    if (isOpen) {
      resetForm();
      const timer = setTimeout(() => {
        pinInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      resetForm();
    }
  }, [isOpen, course?.id, resetForm]);

  // Support ESC key to safely dismiss and clear the modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, handleClose]);

  if (!isOpen || !course) return null;

  const triggerErrorFeedback = (msg: string) => {
    setError(msg);
    setIsShaking(true);
    playErrorBuzzer();
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!pin.trim()) {
      triggerErrorFeedback('Please enter the Jury PIN to authorize deletion.');
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/studio/courses?id=${course.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-jury-pin': pin.trim(),
        },
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to delete course');
      }

      onCourseDeleted(course.id);
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Course deletion rejected';
      triggerErrorFeedback(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFillDemoPin = () => {
    setPin(defaultDemoPin);
    setError(null);
    setIsShaking(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) {
          handleClose();
        }
      }}
    >
      <div className="relative w-full max-w-lg bg-slate-900 border border-rose-900/40 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-rose-950/60 flex items-center justify-between bg-rose-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Delete Course
                <Badge variant="outline" className="text-[10px] border-rose-500/40 text-rose-400">
                  Destructive Action
                </Badge>
              </h2>
              <p className="text-xs text-slate-400">
                Permanent deletion requiring Jury PIN or Teacher authorization.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleDelete} className="p-6 space-y-4">
          {/* Warning Banner */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>You are about to delete:</span>
            </div>
            <div className="text-sm font-bold text-slate-100 pl-6">
              {course.title}{' '}
              <span className="font-mono text-xs text-amber-300/80">({course.code})</span>
            </div>
            <p className="text-[11px] text-slate-400 pl-6 leading-relaxed">
              This will permanently cascade-delete all chapters, PDF extractions, lab assignments, demo presets, and student live sessions associated with this course.
            </p>
          </div>

          {/* Jury PIN Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Enter Jury PIN to Confirm
              </label>
              <button
                type="button"
                onClick={handleFillDemoPin}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 underline underline-offset-2"
                title={`Fill default PIN ${defaultDemoPin}`}
              >
                <Sparkles className="w-3 h-3" />
                <span>Fill Jury PIN ({defaultDemoPin})</span>
              </button>
            </div>

            <div
              className={`relative transition-all duration-150 ${
                isShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''
              }`}
            >
              <input
                ref={pinInputRef}
                type={showPin ? 'text' : 'password'}
                placeholder={`Enter Jury PIN (e.g. ${defaultDemoPin})`}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError(null);
                }}
                className={`w-full bg-slate-950 rounded-xl px-3 py-2.5 text-sm text-slate-100 font-mono tracking-widest focus:outline-none pr-10 transition-colors ${
                  error
                    ? 'border-2 border-rose-500 bg-rose-950/20 text-rose-100 placeholder:text-rose-400/50 focus:border-rose-400'
                    : 'border border-slate-700 focus:border-rose-500'
                }`}
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* INLINE ERROR FEEDBACK DIRECTLY UNDER INPUT */}
            {error && (
              <div className="p-2.5 bg-rose-500/15 border border-rose-500/50 rounded-xl text-xs text-rose-300 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            <p className="text-[10px] text-slate-500">
              Configured Hackathon Jury PIN is <code className="text-slate-300 font-mono">{defaultDemoPin}</code>.
            </p>
          </div>

          {/* Footer buttons */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isDeleting}
              className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs gap-1.5 px-4 font-semibold"
            >
              {isDeleting ? (
                <span>Deleting...</span>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Authorize & Delete Course</span>
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Rejection shake keyframes */}
        <style jsx global>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-6px); }
            40%, 80% { transform: translateX(6px); }
          }
        `}</style>
      </div>
    </div>
  );
}
