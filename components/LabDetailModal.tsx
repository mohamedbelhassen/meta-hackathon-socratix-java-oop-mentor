'use client';

import React, { useState } from 'react';
import { Lab, LabActivity, DemoPreset } from '@/types/socratix';
import {
  X,
  Layers,
  CheckCircle2,
  FileCode2,
  Target,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Bookmark,
  FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  parseBilingualDescription,
  getLocalizedLabTitle,
  getLocalizedActivity,
  getLocalizedMilestone,
} from '@/lib/bilingual-helper';

interface LabDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  lab: Lab | null;
}

export default function LabDetailModal({
  isOpen,
  onClose,
  lab,
}: LabDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'activities' | 'concepts' | 'presets' | 'raw_text'>('activities');
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [lang, setLang] = useState<'en' | 'fr'>('en'); // Default to EN for jury accessibility

  if (!isOpen || !lab) return null;

  const currentPreset: DemoPreset | undefined = lab.demo_presets?.[selectedPresetIdx];
  const currentFile = currentPreset?.files?.[selectedFileIdx] || currentPreset?.files?.[0];

  const handleCopyCode = () => {
    if (!currentFile?.content) return;
    navigator.clipboard.writeText(currentFile.content);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

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
                <span className="font-mono text-cyan-400 font-bold text-sm">
                  TP {lab.lab_number} • {lab.code}
                </span>
                <h2 className="text-base font-bold text-white">{getLocalizedLabTitle(lab, lang)}</h2>
                {lab.pdf_url && (
                  <a
                    href={lab.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded-md ml-1"
                  >
                    <span>Original PDF</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="inline-flex items-center gap-0.5 bg-slate-950 px-1.5 py-0.5 rounded-lg border border-slate-800 text-[10px] font-mono shrink-0">
                  <button
                    onClick={() => setLang('en')}
                    className={`px-1.5 py-0.5 rounded transition ${
                      lang === 'en' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    EN
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    onClick={() => setLang('fr')}
                    className={`px-1.5 py-0.5 rounded transition ${
                      lang === 'fr' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    FR
                  </button>
                </div>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  {parseBilingualDescription(lab.description)[lang]}
                </p>
              </div>
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

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-2 px-6 pt-2.5 border-b border-slate-800 bg-slate-900">
          <button
            onClick={() => setActiveTab('activities')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'activities'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Activities & Milestones ({lab.activities?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('concepts')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'concepts'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Covered Competencies ({lab.covered_micro_concepts?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('presets')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'presets'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Judge Demo Presets ({lab.demo_presets?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('raw_text')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'raw_text'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Raw PDF Text ({lab.pages_json?.length || 0} p.)</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-200 text-xs">
          {/* TAB 1: ACTIVITIES & MILESTONES */}
          {activeTab === 'activities' && (
            <div className="space-y-5">
              {lab.activities && lab.activities.length > 0 ? (
                lab.activities.map((act: LabActivity) => {
                  const locAct = getLocalizedActivity(act, lang);

                  return (
                    <div
                      key={act.id}
                      className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                        <div>
                          <span className="text-[10px] font-mono uppercase text-cyan-400 tracking-wider">
                            Activity {act.order}
                          </span>
                          <h3 className="text-sm font-bold text-white mt-0.5">{locAct.title}</h3>
                        </div>

                        {act.target_files && act.target_files.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-500 font-mono">Target Files:</span>
                            {act.target_files.map((file, fIdx) => (
                              <Badge
                                key={fIdx}
                                variant="outline"
                                className="font-mono text-[10px] bg-slate-900 border-slate-700 text-emerald-400"
                              >
                                {file}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      {locAct.instructions && (
                        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-850 text-slate-300 leading-relaxed text-xs space-y-2 whitespace-pre-wrap font-sans">
                          {locAct.instructions}
                        </div>
                      )}

                      {/* SEQUENTIAL MILESTONES */}
                      <div className="space-y-2 pt-1">
                        <h4 className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Sequential Validation Milestones ({act.milestones?.length || 0})</span>
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {act.milestones?.map((m) => {
                            const locM = getLocalizedMilestone(m, lang);

                            return (
                              <div
                                key={m.id}
                                className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 flex items-center justify-center font-mono font-bold text-[10px]">
                                    {m.order}
                                  </span>
                                  <span className="font-semibold text-white text-xs">{locM.title}</span>
                                </div>
                                <p className="text-[11px] text-slate-400 pl-7 leading-relaxed">
                                  <strong className="text-slate-300">Validation Criteria:</strong>{' '}
                                  {locM.validationCriteria}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-slate-500">
                  No structured activities found for this lab.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: COVERED MICRO-COMPETENCIES */}
          {activeTab === 'concepts' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <h3 className="font-bold text-white text-sm">
                  Curriculum Competencies Tested in TP {lab.lab_number}
                </h3>
                <p className="text-xs text-slate-400">
                  These micro-competencies were automatically matched against the canonical course taxonomy by Meta AI.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {lab.covered_micro_concepts && lab.covered_micro_concepts.length > 0 ? (
                  lab.covered_micro_concepts.map((conceptCode, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3 hover:border-cyan-500/40 transition"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                        ✓
                      </div>
                      <div className="truncate">
                        <span className="font-mono text-emerald-400 font-bold text-xs block truncate">
                          {conceptCode}
                        </span>
                        <span className="text-[10px] text-slate-400">Practiced in this lab</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-8 text-center text-slate-500">
                    No micro-competencies tagged for this lab.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: DEMO PRESETS */}
          {activeTab === 'presets' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>Meta AI 1-Click Judge Presets</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Pre-generated working code setups allowing judges to test Socratic mentoring on this lab without local files.
                  </p>
                </div>

                {lab.demo_presets && lab.demo_presets.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {lab.demo_presets.map((preset, pIdx) => {
                      const act = lab.activities?.find((a) => a.id === preset.activity_id);
                      const actLabel = act ? `Act ${act.order}` : null;
                      return (
                        <Button
                          key={preset.key}
                          size="sm"
                          variant={selectedPresetIdx === pIdx ? 'default' : 'outline'}
                          onClick={() => {
                            setSelectedPresetIdx(pIdx);
                            setSelectedFileIdx(0);
                          }}
                          className={`text-xs h-8 gap-1.5 ${
                            selectedPresetIdx === pIdx
                              ? 'bg-cyan-600 text-white hover:bg-cyan-500'
                              : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                        >
                          {actLabel && (
                            <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-950/80 text-cyan-300 border border-cyan-500/30">
                              {actLabel}
                            </span>
                          )}
                          <span>{preset.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>

              {currentPreset ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-slate-950 px-4 py-2 rounded-xl border border-slate-850">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-300">
                        {currentPreset.description || currentPreset.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {currentPreset.files?.map((f, fIdx) => (
                        <button
                          key={f.name}
                          onClick={() => setSelectedFileIdx(fIdx)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition ${
                            selectedFileIdx === fIdx
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {f.name}
                        </button>
                      ))}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopyCode}
                        className="text-xs h-7 ml-2 bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                        {copiedCode ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                  </div>

                  <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-850 font-mono text-xs text-slate-300 leading-relaxed max-h-[46vh] overflow-y-auto whitespace-pre">
                    {currentFile?.content || '// Empty file'}
                  </pre>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500">
                  No presets generated for this lab.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RAW EXTRACTED PDF TEXT */}
          {activeTab === 'raw_text' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span>Raw Extracted PDF Document Text</span>
                  </h3>
                  <Badge variant="outline" className="font-mono text-[10px] text-cyan-300 border-cyan-500/30">
                    {lab.pages_json?.length || 0} Pages &bull;{' '}
                    {lab.pages_json?.reduce((sum, p) => sum + (p.text?.length || 0), 0) || 0} Chars
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">
                  Verbatim text extracted page-by-page by pdfjs-dist with preserved layout and newlines. 100% inspected by Meta AI.
                </p>
              </div>

              {lab.pages_json && lab.pages_json.length > 0 ? (
                <div className="space-y-4">
                  {lab.pages_json.map((p) => (
                    <div key={p.page} className="p-4 rounded-2xl bg-slate-950 border border-slate-850 space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                        <span className="font-mono font-bold text-cyan-400 text-xs">
                          Page {p.page} ({p.text?.length || 0} characters &bull; 100% preserved)
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (p.text) navigator.clipboard.writeText(p.text);
                          }}
                          className="text-[10px] h-6 bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                        >
                          Copy Page
                        </Button>
                      </div>
                      <pre className="p-3 rounded-xl bg-slate-900/60 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                        {p.text}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-950/60 border border-slate-800 rounded-2xl text-slate-400 space-y-2">
                  <p className="text-sm">No raw text stored for this lab yet (ingested prior to Phase F.6).</p>
                  <p className="text-xs text-slate-500">
                    Click <strong>&quot;⚡ Re-analyze All Labs with Meta AI&quot;</strong> in Course Studio to extract and persist full text with newlines!
                  </p>
                </div>
              )}
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
            Close Inspector
          </Button>

          <span className="text-[11px] text-slate-500 font-mono">
            Lab ID: {lab.id.slice(0, 8)}... &bull; Decomposed by Meta AI
          </span>
        </div>
      </div>
    </div>
  );
}

