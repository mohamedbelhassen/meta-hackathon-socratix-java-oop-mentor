'use client';

import React, { useState } from 'react';
import { Lab } from '@/types/socratix';
import {
  X,
  Layers,
  ExternalLink,
  Search,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { parseBilingualDescription, getLocalizedLabTitle } from '@/lib/bilingual-helper';

interface LabsBatchIngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  labs: Lab[];
  onInspectLab: (lab: Lab) => void;
  onOpenAnalytics?: () => void;
}

export default function LabsBatchIngestionModal({
  isOpen,
  onClose,
  labs,
  onInspectLab,
  onOpenAnalytics,
}: LabsBatchIngestionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [lang, setLang] = useState<'en' | 'fr'>('en'); // Default to EN for jury accessibility

  if (!isOpen) return null;

  const totalActivities = labs.reduce((acc, lb) => acc + (lb.activities?.length || 0), 0);
  const totalMilestones = labs.reduce(
    (acc, lb) =>
      acc +
      (lb.activities?.reduce((mAcc, act) => mAcc + (act.milestones?.length || 0), 0) || 0),
    0
  );
  const totalPresets = labs.reduce((acc, lb) => acc + (lb.demo_presets?.length || 0), 0);

  const filteredLabs = labs.filter((lb) => {
    const q = searchQuery.toLowerCase();
    const titleEn = lb.title_i18n?.en?.toLowerCase() || '';
    const titleFr = lb.title_i18n?.fr?.toLowerCase() || '';
    return (
      lb.title.toLowerCase().includes(q) ||
      titleEn.includes(q) ||
      titleFr.includes(q) ||
      lb.code.toLowerCase().includes(q) ||
      (lb.description && lb.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  Labs Decomposed & Ready for Telemetry
                </h2>
                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-[11px] font-mono">
                  {labs.length} TP Ingested
                </Badge>
              </div>
              <p className="text-xs text-slate-400">
                Meta AI <span className="font-mono text-cyan-400">muse-spark-1.3</span> derived hierarchical activities, sequential milestones, and 1-click presets for all lab assignments.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4-KPI AGGREGATED SUMMARY BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-slate-950/40 border-b border-slate-800 text-xs">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-mono text-slate-400">Total Labs</span>
            <div className="text-xl font-extrabold text-white mt-0.5">{labs.length}</div>
            <span className="text-[10px] text-slate-500">TP1 .. TP12 Ingested</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-mono text-cyan-400">Activities Extracted</span>
            <div className="text-xl font-extrabold text-cyan-300 mt-0.5">{totalActivities}</div>
            <span className="text-[10px] text-slate-500">Separated exercises</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-mono text-emerald-400">Derived Milestones</span>
            <div className="text-xl font-extrabold text-emerald-400 mt-0.5">{totalMilestones}</div>
            <span className="text-[10px] text-slate-500">Strict validation criteria</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-mono text-amber-400">Demo Presets</span>
            <div className="text-xl font-extrabold text-amber-300 mt-0.5">{totalPresets}</div>
            <span className="text-[10px] text-slate-500">1-click code setups</span>
          </div>
        </div>

        {/* SEARCH & FILTERS WITH LANGUAGE TOGGLE */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by TP code, title, or concept..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Bilingual Language Switcher */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
              <span className="text-[10px] text-slate-500 px-1.5">Description:</span>
              <button
                onClick={() => setLang('en')}
                className={`px-2 py-0.5 rounded-lg text-xs font-bold transition ${
                  lang === 'en'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang('fr')}
                className={`px-2 py-0.5 rounded-lg text-xs font-bold transition ${
                  lang === 'fr'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                FR
              </button>
            </div>

            <span className="text-xs text-slate-400 font-mono">
              Showing {filteredLabs.length} of {labs.length} labs
            </span>
          </div>
        </div>

        {/* LABS LIST */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredLabs.length > 0 ? (
            filteredLabs.map((lb) => {
              const bDesc = parseBilingualDescription(lb.description);
              const displayDesc = bDesc[lang] || bDesc.en || bDesc.fr;

              return (
                <div
                  key={lb.id}
                  className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 font-mono font-bold text-xs">
                        TP {lb.lab_number}
                      </span>
                      <h3 className="text-sm font-bold text-white truncate">{getLocalizedLabTitle(lb, lang)}</h3>
                      <span className="text-xs text-slate-500 font-mono">({lb.code})</span>
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {displayDesc}
                    </p>

                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {lb.activities?.length || 0} act. &bull;{' '}
                      {lb.activities?.reduce((acc, act) => acc + (act.milestones?.length || 0), 0) || 0} milestones
                    </span>

                    {lb.covered_micro_concepts && lb.covered_micro_concepts.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap pl-2 border-l border-slate-800">
                        {lb.covered_micro_concepts.slice(0, 3).map((mc, mIdx) => (
                          <span
                            key={mIdx}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-400 font-mono"
                          >
                            {mc}
                          </span>
                        ))}
                        {lb.covered_micro_concepts.length > 3 && (
                          <span className="text-[9px] text-slate-500 font-mono">
                            +{lb.covered_micro_concepts.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onInspectLab(lb)}
                    className="text-xs h-8 bg-slate-900 border-slate-800 text-cyan-400 hover:text-cyan-300 hover:bg-slate-800"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1.5" />
                    <span>Inspect</span>
                  </Button>

                  {lb.pdf_url && (
                    <a
                      href={lb.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 transition"
                      title="Open University PDF"
                    >
                      <span>PDF</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })
          ) : (
            <div className="py-12 text-center text-slate-500">
              No labs match your filter.
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
          >
            Close Briefing
          </Button>

          {onOpenAnalytics && (
            <Button
              onClick={() => {
                onClose();
                onOpenAnalytics();
              }}
              className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-950/50"
            >
              <span>View Course ↔ Lab Coverage Matrix (Analytics)</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

