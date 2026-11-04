'use client';

import React, { useState, useEffect } from 'react';
import { Course, CourseChapter } from '@/types/socratix';
import {
  Sparkles,
  X,
  CheckCircle2,
  FileText,
  Code2,
  ArrowRight,
  Layers,
  Copy,
  Check,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface CourseCompilationSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course & { course_chapters?: CourseChapter[] };
  initialLang?: 'en' | 'fr';
  onProceedToLabs?: () => void;
}

export default function CourseCompilationSummaryModal({
  isOpen,
  onClose,
  course,
  initialLang = 'en',
  onProceedToLabs,
}: CourseCompilationSummaryModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'prompt' | 'kb'>('overview');
  const [copied, setCopied] = useState(false);
  const [lang, setLang] = useState<'en' | 'fr'>(initialLang);

  // Synchronize with initialLang when modal opens or parent toggles
  useEffect(() => {
    if (initialLang) {
      setLang(initialLang);
    }
  }, [initialLang, isOpen]);

  if (!isOpen || !course) return null;

  const totalMicroCompetencies = Array.isArray(course.competency_matrix)
    ? course.competency_matrix.reduce(
        (acc, cat) => acc + (cat.micro_competencies?.length || 0),
        0
      )
    : 0;

  const validChapters = (course.course_chapters || []).filter((ch) => !ch.course_id || ch.course_id === course.id);
  const chaptersCount = validChapters.length > 0 ? validChapters.length : (Array.isArray(course.competency_matrix) ? course.competency_matrix.length : 0);
  const promptTokensEstimate = Math.round((course.compiled_tutor_prompt?.length || 0) / 4);
  const kbTokensEstimate = Math.round((course.compiled_knowledge_base?.length || 0) / 4);

  const handleCopyPrompt = () => {
    if (!course.compiled_tutor_prompt) return;
    navigator.clipboard.writeText(course.compiled_tutor_prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const i18n = {
    en: {
      title: 'Curriculum Synthesized & AI Mentor Ready',
      subtitle: (
        <>
          Meta AI <span className="font-mono text-emerald-400">muse-spark-1.3</span> distilled your lecture slides into a canonical taxonomy and custom Socratic mentor prompt.
        </>
      ),
      closeTooltip: 'Close',
      kpiChapters: 'Lecture Chapters',
      kpiChaptersSub: 'PDFs processed',
      kpiTaxonomy: 'Canonical Taxonomy',
      kpiTaxonomySub: 'Deduplicated concepts',
      kpiPrompt: 'Tutor System Prompt',
      kpiPromptSub: (chars: number) => `${chars} characters`,
      kpiKb: 'Curriculum KB',
      kpiKbSub: 'Unified slide summaries',
      tabOverview: 'AI Curriculum Overview',
      tabPrompt: 'Generated Mentor System Prompt',
      tabKb: 'Compiled Knowledge Base',
      pillar1Title: 'Deduplicated Taxonomy',
      pillar1Desc: (
        <>
          Scanned across all lecture chapters to eliminate overlapping definitions. Every concept has a unique canonical <code className="text-emerald-400 font-mono">SCREAMING_SNAKE_CASE</code> key linked to its primary slide.
        </>
      ),
      pillar2Title: 'Pedagogical Slide Anchors',
      pillar2Desc: (
        <>
          Extracted the professor&apos;s signature analogies (e.g. <em>Four Slide 42</em>, <em>Félin Slide 8</em>). The Socratic AI redirects students to these exact slide numbers instead of hallucinating foreign examples.
        </>
      ),
      pillar3Title: 'Course-Specific Few-Shots',
      pillar3Desc: (
        <>
          Generated 2 few-shot reasoning exemplars tailored to {course.title}, priming Meta AI to maintain an inquisitive Socratic posture without giving away code answers.
        </>
      ),
      matrixTitle: 'Canonical Competency Matrix by Chapter',
      matrixCategories: (count: number) => `${count} Categories`,
      promptHint: (
        <>
          This custom prompt is injected by <code className="text-emerald-400">/api/tutor</code> and cached via Meta AI Ephemeral Prompt Caching.
        </>
      ),
      copyPrompt: 'Copy Prompt',
      promptCopied: 'Copied',
      noPrompt: '// No tutor prompt compiled yet.',
      kbHint: (count: number, tokens: number) =>
        `Unified curriculum reference synthesized from all ${count} chapters (~${tokens} tokens).`,
      noKb: '// No compiled knowledge base yet.',
      closeOverview: 'Close Overview',
      nextStep: 'Next Step: Ingest & Decompose Labs (TP)',
    },
    fr: {
      title: 'Curriculum Synthétisé & Mentor IA Prêt',
      subtitle: (
        <>
          Meta AI <span className="font-mono text-emerald-400">muse-spark-1.3</span> a distillé vos diapositives de cours en une taxonomie canonique et un prompt mentor socratique sur-mesure.
        </>
      ),
      closeTooltip: 'Fermer',
      kpiChapters: 'Chapitres de Cours',
      kpiChaptersSub: 'PDFs traités',
      kpiTaxonomy: 'Taxonomie Canonique',
      kpiTaxonomySub: 'Concepts dédupliqués',
      kpiPrompt: 'Prompt Système Tuteur',
      kpiPromptSub: (chars: number) => `${chars} caractères`,
      kpiKb: 'Base de Connaissances',
      kpiKbSub: 'Résumés de slides unifiés',
      tabOverview: 'Vue d\'Ensemble du Curriculum IA',
      tabPrompt: 'Prompt Système Tuteur Généré',
      tabKb: 'Base de Connaissances Compilée',
      pillar1Title: 'Taxonomie Dédupliquée',
      pillar1Desc: (
        <>
          Analyse de l&apos;ensemble des chapitres de cours pour éliminer les définitions redondantes. Chaque concept possède une clé canonique unique <code className="text-emerald-400 font-mono">SCREAMING_SNAKE_CASE</code> reliée à sa diapositive de référence.
        </>
      ),
      pillar2Title: 'Ancrages Pédagogiques aux Slides',
      pillar2Desc: (
        <>
          Extraction des analogies signatures de l&apos;enseignant (ex. <em>Four Slide 42</em>, <em>Félin Slide 8</em>). L&apos;IA socratique redirige précisément les étudiants vers ces numéros de diapositive au lieu d&apos;inventer des exemples extérieurs.
        </>
      ),
      pillar3Title: 'Few-Shots Spécifiques au Cours',
      pillar3Desc: (
        <>
          Génération de 2 exemples de raisonnement socratique calibrés sur {course.title}, entraînant Meta AI à conserver une posture maïeutique sans jamais donner la solution de code directement.
        </>
      ),
      matrixTitle: 'Matrice Canonique des Compétences par Chapitre',
      matrixCategories: (count: number) => `${count} Catégories`,
      promptHint: (
        <>
          Ce prompt sur-mesure est injecté par <code className="text-emerald-400">/api/tutor</code> et mis en cache via le Prompt Caching éphémère de Meta AI.
        </>
      ),
      copyPrompt: 'Copier le Prompt',
      promptCopied: 'Copié !',
      noPrompt: '// Aucun prompt tuteur compilé pour le moment.',
      kbHint: (count: number, tokens: number) =>
        `Référentiel pédagogique unifié synthétisé à partir des ${count} chapitres (~${tokens} tokens).`,
      noKb: '// Aucune base de connaissances compilée pour le moment.',
      closeOverview: 'Fermer la Synthèse',
      nextStep: 'Étape Suivante : Ingérer & Décomposer les TP (Labs)',
    },
  }[lang];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#059669] dark:text-emerald-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {i18n.title}
                </h2>
                <Badge className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30 text-[11px] font-mono font-bold">
                  {course.code}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="inline-flex items-center gap-0.5 bg-slate-100 dark:bg-slate-950 px-1.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-mono shrink-0">
                  <button
                    onClick={() => setLang('en')}
                    className={`px-1.5 py-0.5 rounded transition ${
                      lang === 'en' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-500/30' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'
                    }`}
                  >
                    EN
                  </button>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <button
                    onClick={() => setLang('fr')}
                    className={`px-1.5 py-0.5 rounded transition ${
                      lang === 'fr' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-500/30' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'
                    }`}
                  >
                    FR
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {i18n.subtitle}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={i18n.closeTooltip}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4-KPI SUMMARY BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 text-xs">
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] uppercase font-mono text-slate-600 dark:text-slate-400 font-semibold">{i18n.kpiChapters}</span>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{chaptersCount}</div>
            <span className="text-[10px] text-slate-500">{i18n.kpiChaptersSub}</span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] uppercase font-mono text-emerald-700 dark:text-emerald-400 font-semibold">{i18n.kpiTaxonomy}</span>
            <div className="text-xl font-extrabold text-[#059669] dark:text-emerald-400 mt-0.5">{totalMicroCompetencies}</div>
            <span className="text-[10px] text-slate-500">{i18n.kpiTaxonomySub}</span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] uppercase font-mono text-cyan-700 dark:text-cyan-400 font-semibold">{i18n.kpiPrompt}</span>
            <div className="text-xl font-extrabold text-cyan-800 dark:text-cyan-300 mt-0.5">~{promptTokensEstimate} tok</div>
            <span className="text-[10px] text-slate-500">{i18n.kpiPromptSub(course.compiled_tutor_prompt?.length || 0)}</span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] uppercase font-mono text-amber-700 dark:text-amber-400 font-semibold">{i18n.kpiKb}</span>
            <div className="text-xl font-extrabold text-amber-800 dark:text-amber-300 mt-0.5">~{kbTokensEstimate} tok</div>
            <span className="text-[10px] text-slate-500">{i18n.kpiKbSub}</span>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-emerald-600 dark:border-emerald-400 text-emerald-800 dark:text-emerald-300'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{i18n.tabOverview}</span>
          </button>

          <button
            onClick={() => setActiveTab('prompt')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'prompt'
                ? 'border-emerald-600 dark:border-emerald-400 text-emerald-800 dark:text-emerald-300'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{i18n.tabPrompt}</span>
          </button>

          <button
            onClick={() => setActiveTab('kb')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'kb'
                ? 'border-emerald-600 dark:border-emerald-400 text-emerald-800 dark:text-emerald-300'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{i18n.tabKb}</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-800 dark:text-slate-200 text-xs">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 3 PILLARS CARDS FOR JURY */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[#059669] dark:text-emerald-400 flex items-center justify-center font-bold">
                    1
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">{i18n.pillar1Title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                    {i18n.pillar1Desc}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
                    2
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">{i18n.pillar2Title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                    {i18n.pillar2Desc}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                    3
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">{i18n.pillar3Title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                    {i18n.pillar3Desc}
                  </p>
                </div>
              </div>

              {/* CANONICAL TAXONOMY LIST */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#059669] dark:text-emerald-400" />
                    <span>{i18n.matrixTitle}</span>
                  </h3>
                  <Badge variant="outline" className="font-mono text-[10px] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800">
                    {i18n.matrixCategories(course.competency_matrix?.length || 0)}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {course.competency_matrix?.map((tax, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[#059669] dark:text-emerald-400 font-bold text-[11px]">
                          {tax.chapter_code}
                        </span>
                        <span className="text-slate-900 dark:text-white font-medium text-xs">{tax.competency_title}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {tax.micro_competencies?.map((mc, mIdx) => (
                          <span
                            key={mIdx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] text-slate-700 dark:text-slate-300 font-mono shadow-xs"
                            title={mc.title}
                          >
                            <span className="text-[#059669] dark:text-emerald-400 font-bold">{mc.code}</span>
                            {mc.slide_ref && (
                              <span className="text-slate-400 dark:text-slate-500">({mc.slide_ref})</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'prompt' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">
                  {i18n.promptHint}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyPrompt}
                  className="text-xs h-7 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
                >
                  {copied ? <Check className="w-3.5 h-3.5 mr-1 text-[#059669] dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copied ? i18n.promptCopied : i18n.copyPrompt}
                </Button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 font-mono text-[11px] text-slate-800 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto">
                {course.compiled_tutor_prompt || i18n.noPrompt}
              </pre>
            </div>
          )}

          {activeTab === 'kb' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>
                  {i18n.kbHint(chaptersCount, kbTokensEstimate)}
                </span>
              </div>

              <pre className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 font-mono text-[11px] text-slate-800 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto">
                {course.compiled_knowledge_base || i18n.noKb}
              </pre>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
          >
            {i18n.closeOverview}
          </Button>

          {onProceedToLabs && (
            <Button
              onClick={() => {
                onClose();
                onProceedToLabs();
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/50"
            >
              <span>{i18n.nextStep}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

