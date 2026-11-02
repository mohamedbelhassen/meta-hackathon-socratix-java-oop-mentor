'use client';

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Lab, LabActivity, DemoPreset } from '@/types/socratix';
import { cleanInstructionsMarkdown } from '@/lib/pdf-cleaner';
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
  initialLang?: 'en' | 'fr';
}

export default function LabDetailModal({
  isOpen,
  onClose,
  lab,
  initialLang = 'en',
}: LabDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'activities' | 'concepts' | 'presets' | 'raw_text'>('activities');
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPage, setCopiedPage] = useState<number | null>(null);
  const [lang, setLang] = useState<'en' | 'fr'>(initialLang);

  // Synchronize when initialLang changes or modal opens
  useEffect(() => {
    if (initialLang) {
      setLang(initialLang);
    }
  }, [initialLang, isOpen]);

  if (!isOpen || !lab) return null;

  const currentPreset: DemoPreset | undefined = lab.demo_presets?.[selectedPresetIdx];
  const currentFile = currentPreset?.files?.[selectedFileIdx] || currentPreset?.files?.[0];

  const handleCopyCode = () => {
    if (!currentFile?.content) return;
    navigator.clipboard.writeText(currentFile.content);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyPage = (pageNum: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPage(pageNum);
    setTimeout(() => setCopiedPage(null), 2000);
  };

  const i18n = {
    en: {
      originalPdf: 'Original PDF',
      closeTooltip: 'Close',
      tabActivities: 'Activities & Milestones',
      tabConcepts: 'Covered Competencies',
      tabPresets: 'Judge Demo Presets',
      tabRawText: 'Raw PDF Text',
      activityLabel: 'Activity',
      targetFiles: 'Target Files:',
      milestonesHeader: 'Sequential Validation Milestones',
      validationCriteria: 'Validation Criteria:',
      noActivities: 'No structured activities found for this lab.',
      conceptsTitle: `Curriculum Competencies Tested in TP ${lab.lab_number}`,
      conceptsDesc: 'These micro-competencies were automatically matched against the canonical course taxonomy by Meta AI.',
      practicedInLab: 'Practiced in this lab',
      noConcepts: 'No micro-competencies tagged for this lab.',
      presetsTitle: 'Meta AI 1-Click Judge Presets',
      presetsDesc: 'Pre-generated working code setups allowing judges to test Socratic mentoring on this lab without local files.',
      presetsCount: (count: number) => `${count} Presets Available`,
      presetBuggyBadge: 'Buggy Attempt',
      presetSolutionBadge: 'Validated Solution',
      actShort: 'Act',
      copy: 'Copy',
      copied: 'Copied',
      emptyFile: '// Empty file',
      noPresets: 'No presets generated for this lab.',
      rawTextTitle: 'Raw Extracted PDF Document Text',
      rawTextBadge: (pages: number, chars: number) => `${pages} Pages • ${chars} Chars`,
      rawTextDesc: 'Verbatim text extracted page-by-page by pdfjs-dist with preserved layout and newlines. 100% inspected by Meta AI.',
      pageHeader: (page: number, chars: number) => `Page ${page} (${chars} characters • 100% preserved)`,
      copyPage: 'Copy Page',
      pageCopied: 'Copied',
      noRawText: 'No raw text stored for this lab yet (ingested prior to Phase F.6).',
      reAnalyzeHint: 'Click "⚡ Re-analyze All Labs with Meta AI" in Course Studio to extract and persist full text with newlines!',
      closeInspector: 'Close Inspector',
      labIdFooter: (id: string) => `Lab ID: ${id.slice(0, 8)}... • Decomposed by Meta AI`,
    },
    fr: {
      originalPdf: 'PDF Original',
      closeTooltip: 'Fermer',
      tabActivities: 'Activités & Jalons',
      tabConcepts: 'Compétences Couvertes',
      tabPresets: 'Presets Démo Jury',
      tabRawText: 'Texte Brut PDF',
      activityLabel: 'Activité',
      targetFiles: 'Fichiers Cibles :',
      milestonesHeader: 'Jalons de Validation Séquentiels',
      validationCriteria: 'Critères de Validation :',
      noActivities: 'Aucune activité structurée trouvée pour ce TP.',
      conceptsTitle: `Compétences du Référentiel Testées dans le TP ${lab.lab_number}`,
      conceptsDesc: 'Ces micro-compétences ont été automatiquement associées à la taxonomie canonique du cours par Meta AI.',
      practicedInLab: 'Pratiquée dans ce TP',
      noConcepts: 'Aucune micro-compétence associée à ce TP.',
      presetsTitle: 'Presets Démo 1-Clic Meta AI',
      presetsDesc: 'Configurations de code pré-générées permettant au jury de tester le mentorat socratique sans fichier local.',
      presetsCount: (count: number) => `${count} Presets Disponibles`,
      presetBuggyBadge: 'Erreur Intentionnelle',
      presetSolutionBadge: 'Solution Validée',
      actShort: 'Act.',
      copy: 'Copier',
      copied: 'Copié !',
      emptyFile: '// Fichier vide',
      noPresets: 'Aucun preset généré pour ce TP.',
      rawTextTitle: 'Texte Brut Extrait du Document PDF',
      rawTextBadge: (pages: number, chars: number) => `${pages} Pages • ${chars} Caractères`,
      rawTextDesc: 'Texte intégral extrait page par page par pdfjs-dist avec mise en page et sauts de ligne préservés. 100% inspecté par Meta AI.',
      pageHeader: (page: number, chars: number) => `Page ${page} (${chars} caractères • 100% préservé)`,
      copyPage: 'Copier la Page',
      pageCopied: 'Copié !',
      noRawText: 'Aucun texte brut stocké pour ce TP pour le moment (ingéré avant la phase F.6).',
      reAnalyzeHint: 'Cliquez sur « ⚡ Re-analyze All Labs with Meta AI » dans le Course Studio pour extraire et persister le texte complet !',
      closeInspector: 'Fermer l\'Inspecteur',
      labIdFooter: (id: string) => `ID du TP : ${id.slice(0, 8)}... • Décomposé par Meta AI`,
    },
  }[lang];

  const rawTitle = getLocalizedLabTitle(lab, lang);
  const cleanTitle = rawTitle.replace(/^(?:TP\s*\d+\s*[-—:]*\s*)+/i, '').trim() || rawTitle;

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
              <div className="flex items-center gap-2.5 flex-wrap">
                <Badge
                  variant="outline"
                  className="font-mono text-xs font-bold text-cyan-300 border-cyan-500/40 bg-cyan-950/60 px-2.5 py-0.5 rounded-lg shrink-0"
                >
                  TP {lab.lab_number}
                </Badge>
                <h2 className="text-base font-bold text-white tracking-tight">{cleanTitle}</h2>
                {lab.pdf_url && (
                  <a
                    href={lab.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded-md ml-1"
                  >
                    <span>{i18n.originalPdf}</span>
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
            title={i18n.closeTooltip}
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
            <span>{i18n.tabActivities} ({lab.activities?.length || 0})</span>
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
            <span>{i18n.tabConcepts} ({lab.covered_micro_concepts?.length || 0})</span>
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
            <span>{i18n.tabPresets} ({lab.demo_presets?.length || 0})</span>
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
            <span>{i18n.tabRawText} ({lab.pages_json?.length || 0} p.)</span>
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
                            {i18n.activityLabel} {act.order}
                          </span>
                          <h3 className="text-sm font-bold text-white mt-0.5">{locAct.title}</h3>
                        </div>

                        {act.target_files && act.target_files.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-500 font-mono">{i18n.targetFiles}</span>
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
                        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300 leading-relaxed text-xs space-y-2 font-sans prose prose-invert prose-xs max-w-none [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_code]:bg-slate-950 [&_code]:text-emerald-300 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[11px] [&_strong]:text-white [&_p]:my-1">
                          <ReactMarkdown>
                            {cleanInstructionsMarkdown(locAct.instructions)}
                          </ReactMarkdown>
                        </div>
                      )}

                      {/* SEQUENTIAL MILESTONES */}
                      <div className="space-y-2 pt-1">
                        <h4 className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{i18n.milestonesHeader} ({act.milestones?.length || 0})</span>
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
                                  <strong className="text-slate-300">{i18n.validationCriteria}</strong>{' '}
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
                  {i18n.noActivities}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: COVERED MICRO-COMPETENCIES */}
          {activeTab === 'concepts' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <h3 className="font-bold text-white text-sm">
                  {i18n.conceptsTitle}
                </h3>
                <p className="text-xs text-slate-400">
                  {i18n.conceptsDesc}
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
                        <span className="text-[10px] text-slate-400">{i18n.practicedInLab}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-8 text-center text-slate-500">
                    {i18n.noConcepts}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: DEMO PRESETS */}
          {activeTab === 'presets' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4 shadow-lg">
                {/* Header info */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <span>{i18n.presetsTitle}</span>
                    </h3>
                    <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                      {i18n.presetsDesc}
                    </p>
                  </div>

                  {lab.demo_presets && lab.demo_presets.length > 0 && (
                    <Badge
                      variant="outline"
                      className="shrink-0 font-mono text-[11px] text-cyan-300 border-cyan-500/30 bg-cyan-950/30 px-2.5 py-1"
                    >
                      {i18n.presetsCount(lab.demo_presets.length)}
                    </Badge>
                  )}
                </div>

                {/* Presets Cards Grid */}
                {lab.demo_presets && lab.demo_presets.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-3 border-t border-slate-800/80">
                    {lab.demo_presets.map((preset, pIdx) => {
                      const isSelected = selectedPresetIdx === pIdx;
                      const act = lab.activities?.find((a) => a.id === preset.activity_id);
                      const isBuggy =
                        preset.preset_type === 'buggy' ||
                        preset.label.toLowerCase().includes('buggy') ||
                        preset.label.toLowerCase().includes('error') ||
                        preset.label.toLowerCase().includes('erreur');

                      return (
                        <button
                          key={preset.key || pIdx}
                          type="button"
                          onClick={() => {
                            setSelectedPresetIdx(pIdx);
                            setSelectedFileIdx(0);
                          }}
                          className={`p-3 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between gap-2 ${
                            isSelected
                              ? 'bg-cyan-950/40 border-cyan-500/60 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500/40'
                              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {act && (
                                <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-slate-950 text-cyan-400 border border-cyan-500/30">
                                  {i18n.actShort} {act.order}
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                                  isBuggy
                                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                }`}
                              >
                                {isBuggy ? i18n.presetBuggyBadge : i18n.presetSolutionBadge}
                              </span>
                            </div>

                            <span
                              className={`w-2 h-2 rounded-full transition ${
                                isSelected ? 'bg-cyan-400 shadow-sm shadow-cyan-400' : 'bg-slate-700'
                              }`}
                            />
                          </div>

                          <div
                            className={`text-xs font-semibold ${
                              isSelected ? 'text-white' : 'text-slate-300'
                            }`}
                          >
                            {preset.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Code Viewer Panel */}
              {currentPreset ? (
                <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-xl space-y-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-3 bg-slate-900/70 border-b border-slate-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCode2 className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="text-xs text-slate-300 truncate">
                        {currentPreset.description || currentPreset.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {currentPreset.files?.map((f, fIdx) => (
                        <button
                          key={f.name}
                          onClick={() => setSelectedFileIdx(fIdx)}
                          className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition ${
                            selectedFileIdx === fIdx
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                              : 'text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800'
                          }`}
                        >
                          {f.name}
                        </button>
                      ))}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopyCode}
                        className="text-xs h-7 ml-1 bg-slate-800 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                        {copiedCode ? i18n.copied : i18n.copy}
                      </Button>
                    </div>
                  </div>

                  <pre className="p-4 bg-slate-950 font-mono text-xs text-slate-200 leading-relaxed max-h-[46vh] overflow-y-auto whitespace-pre selection:bg-cyan-500/30">
                    {currentFile?.content || i18n.emptyFile}
                  </pre>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500">
                  {i18n.noPresets}
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
                    <span>{i18n.rawTextTitle}</span>
                  </h3>
                  <Badge variant="outline" className="font-mono text-[10px] text-cyan-300 border-cyan-500/30">
                    {i18n.rawTextBadge(
                      lab.pages_json?.length || 0,
                      lab.pages_json?.reduce((sum, p) => sum + (p.text?.length || 0), 0) || 0
                    )}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">
                  {i18n.rawTextDesc}
                </p>
              </div>

              {lab.pages_json && lab.pages_json.length > 0 ? (
                <div className="space-y-4">
                  {lab.pages_json.map((p) => (
                    <div key={p.page} className="p-4 rounded-2xl bg-slate-950 border border-slate-850 space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                        <span className="font-mono font-bold text-cyan-400 text-xs">
                          {i18n.pageHeader(p.page, p.text?.length || 0)}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (p.text) handleCopyPage(p.page, p.text);
                          }}
                          className="text-[10px] h-6 bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                        >
                          {copiedPage === p.page ? (
                            <>
                              <Check className="w-3 h-3 mr-1 text-emerald-400" />
                              <span>{i18n.pageCopied}</span>
                            </>
                          ) : (
                            i18n.copyPage
                          )}
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
                  <p className="text-sm">{i18n.noRawText}</p>
                  <p className="text-xs text-slate-500">
                    {i18n.reAnalyzeHint}
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
            {i18n.closeInspector}
          </Button>

          <span className="text-[11px] text-slate-500 font-mono">
            {i18n.labIdFooter(lab.id)}
          </span>
        </div>
      </div>
    </div>
  );
}

