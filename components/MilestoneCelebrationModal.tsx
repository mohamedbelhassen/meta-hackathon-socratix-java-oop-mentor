'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, BookOpen, Sparkles, X } from 'lucide-react';

export interface CompetencyReport {
  congratulations: string;
  mastered_concepts: string[];
  friction_points: string[];
  revision_recommendations: string[];
}

interface MilestoneCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestoneId?: string;
  report: CompetencyReport | null;
}

// Zero-dependency Major Arpeggio Synthesizer via HTML5 Web Audio API
export function playCelebrationChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Notes: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz), C6 (1046.50Hz)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const startTime = ctx.currentTime + 0.05;

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime + index * 0.12);

      // Smooth ADSR envelope
      gain.gain.setValueAtTime(0, startTime + index * 0.12);
      gain.gain.linearRampToValueAtTime(0.18, startTime + index * 0.12 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + index * 0.12 + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime + index * 0.12);
      osc.stop(startTime + index * 0.12 + 0.6);
    });
  } catch (err) {
    console.warn('Web Audio chime error:', err);
  }
}

// Festive Confetti trigger with high z-index to always render on top of modals
export function triggerCelebrationConfetti() {
  if (typeof window === 'undefined') return;
  try {
    // Dual fireworks burst: left and right cannons with high z-index
    confetti({
      zIndex: 99999,
      particleCount: 70,
      angle: 60,
      spread: 60,
      origin: { x: 0.05, y: 0.65 },
      colors: ['#10b981', '#34d399', '#f59e0b', '#38bdf8', '#a855f7'],
    });

    confetti({
      zIndex: 99999,
      particleCount: 70,
      angle: 120,
      spread: 60,
      origin: { x: 0.95, y: 0.65 },
      colors: ['#10b981', '#34d399', '#f59e0b', '#38bdf8', '#a855f7'],
    });

    // Center star burst
    confetti({
      zIndex: 99999,
      particleCount: 60,
      spread: 90,
      origin: { x: 0.5, y: 0.5 },
      colors: ['#10b981', '#fbbf24', '#38bdf8'],
    });
  } catch (e) {
    console.warn('Confetti animation error:', e);
  }
}

export function replayCelebration() {
  playCelebrationChime();
  triggerCelebrationConfetti();
}

export default function MilestoneCelebrationModal({
  isOpen,
  onClose,
  milestoneId = 'LAB5_ENCAPSULATION',
  report,
}: MilestoneCelebrationModalProps) {
  useEffect(() => {
    if (isOpen) {
      playCelebrationChime();
      triggerCelebrationConfetti();
    }
  }, [isOpen]);

  if (!isOpen || !report) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border-2 border-emerald-500/50 rounded-2xl shadow-2xl shadow-emerald-500/20 p-6 md:p-8 text-slate-100 flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          title="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Celebration Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="flex items-center gap-2">
            <span className="p-3 rounded-full bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/40">
              <Sparkles className="w-8 h-8 animate-pulse" />
            </span>
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs px-3 py-1 font-mono uppercase tracking-wider">
            Milestone Completed • {milestoneId}
          </Badge>
          <h2 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
            Activity Successfully Mastered!
          </h2>
          <p className="text-sm md:text-base text-slate-300 max-w-lg mt-1 leading-relaxed">
            {report.congratulations ||
              'Outstanding work! Your Java code meets all architectural contracts and passes every verification step.'}
          </p>
        </div>

        {/* 3-Part Competency Report */}
        <div className="flex flex-col gap-4">
          {/* 1. Mastered OOP Concepts */}
          {report.mastered_concepts && report.mastered_concepts.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-emerald-500/30">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-2.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Mastered OOP Concepts</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {report.mastered_concepts.map((concept, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="bg-emerald-950/40 border-emerald-500/40 text-emerald-300 text-xs py-1 px-2.5 font-sans"
                  >
                    ✓ {concept}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 2. Friction Points Overcome */}
          {report.friction_points && report.friction_points.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-amber-500/30">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm mb-2.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Hurdles Overcome During Mentoring</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300 list-disc list-inside">
                {report.friction_points.map((pt, idx) => (
                  <li key={idx} className="leading-relaxed">
                    <span className="text-slate-200">{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 3. Recommended Course Slides */}
          {report.revision_recommendations && report.revision_recommendations.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-indigo-500/30">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm mb-2.5">
                <BookOpen className="w-4 h-4" />
                <span>Recommended Course Slides for Consolidation</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {report.revision_recommendations.map((ref, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-xs text-indigo-300 font-mono bg-indigo-950/30 px-3 py-1.5 rounded-lg border border-indigo-500/20"
                  >
                    <span>📖 {ref}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={replayCelebration}
            className="text-slate-400 hover:text-emerald-400 text-xs flex items-center gap-1.5 hover:bg-slate-800"
            title="Replay Celebration Sound & Fireworks"
          >
            <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Replay Fireworks & Chime 🎉</span>
          </Button>
          <Button
            type="button"
            onClick={onClose}
            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-6 py-2 rounded-xl text-sm transition-all shadow-lg shadow-emerald-600/30"
          >
            Inspect Completed Workspace
          </Button>
        </div>
      </div>
    </div>
  );
}
