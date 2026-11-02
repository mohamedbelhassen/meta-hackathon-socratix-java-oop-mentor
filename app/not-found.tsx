'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Compass,
  GraduationCap,
  BarChart3,
  Home,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Terminal,
} from 'lucide-react';

export default function NotFound() {
  const router = useRouter();
  const [lang, setLang] = useState<'fr' | 'en'>('fr');

  const i18n = {
    fr: {
      badge: 'Erreur 404 • Route Introuvable',
      title: 'Perdu dans le Graphe de Concepts ?',
      subtitle:
        "La page ou la ressource que vous recherchez n'existe pas ou a été déplacée.",
      socratesHeader: 'Aphorisme Socratique',
      quote:
        "« Tout ce que je sais, c'est que je ne sais rien... mais une chose est certaine : cette URL ne mène à aucun jalon pédagogique de Socratix. »",
      author: '— Socrate, Tuteur IA',
      javaComment: 'Quelle compétence tentiez-vous de valider ?',
      backButton: 'Page précédente',
      actionsTitle: 'Passerelles de Secours Pédagogiques',
      studentCard: {
        title: 'Espace Étudiant',
        badge: 'TP & Mentorat',
        desc: 'Rejoignez votre IDE en split-screen avec suivi par IA socratique, jalons en direct et viewer de slides.',
        cta: 'Lancer le Workspace Étudiant',
      },
      teacherCard: {
        title: 'Hub Enseignant',
        badge: 'Télémétrie & Studio',
        desc: 'Consultez la matrice des compétences temps réel, la télémétrie des postes et le Course Studio.',
        cta: 'Accéder au Dashboard ERP',
      },
      homeCard: {
        title: 'Accueil Socratix',
        badge: 'Portail Principal',
        desc: "Retournez à la page d'accueil de Socratix, explorez l'architecture et accédez à votre compte.",
        cta: "Retourner à l'Accueil",
      },
      footerText: 'Socratix — Mentorat Socratique OOP Java & ERP Temps Réel.',
    },
    en: {
      badge: 'Error 404 • Route Not Found',
      title: 'Lost in the Concept Matrix?',
      subtitle:
        'The page or educational resource you are looking for does not exist or has been relocated.',
      socratesHeader: 'Socratic Aphorism',
      quote:
        '"The only true wisdom is in knowing that you know nothing... and one thing is certain: this URL does not lead to any learning milestone in Socratix."',
      author: '— Socrates, AI Mentor',
      javaComment: 'Which OOP milestone were you seeking to validate?',
      backButton: 'Go Back',
      actionsTitle: 'Pedagogical Recovery Gateways',
      studentCard: {
        title: 'Student Workspace',
        badge: 'Lab & Mentoring',
        desc: 'Join your split-screen IDE with Socratic AI coaching, live milestones and slide viewer.',
        cta: 'Launch Student Workspace',
      },
      teacherCard: {
        title: 'Teacher Hub',
        badge: 'Telemetry & Studio',
        desc: 'Inspect real-time competency matrices, live workstation seat telemetry and Course Studio.',
        cta: 'Access Teacher ERP Hub',
      },
      homeCard: {
        title: 'Socratix Home',
        badge: 'Main Portal',
        desc: 'Return to the main Socratix homepage, explore the system architecture and sign in.',
        cta: 'Return to Home',
      },
      footerText: 'Socratix — Java OOP Socratic Mentor & Real-Time ERP.',
    },
  };

  const t = i18n[lang];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Ambient background glowing accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[340px] bg-gradient-to-b from-emerald-500/15 via-cyan-500/10 to-transparent blur-3xl pointer-events-none rounded-full" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-500/5 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute top-1/3 -left-32 w-80 h-80 bg-cyan-500/5 blur-3xl pointer-events-none rounded-full" />

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 pt-6 flex items-center justify-between">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 text-sm font-bold tracking-tight text-white hover:text-emerald-400 transition"
        >
          <span className="text-xl">🦉</span>
          <span>Socratix</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400">
            OOP Mentor
          </span>
        </Link>

        {/* Header Right: Language Switcher & Quick Back */}
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900/90 p-0.5 shadow-sm">
            <button
              onClick={() => setLang('fr')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                lang === 'fr'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              FR
            </button>
            <button
              onClick={() => setLang('en')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                lang === 'en'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
          </div>

          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 hover:text-white transition shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">{t.backButton}</span>
          </button>
        </div>
      </header>

      {/* Main 404 Hero Section */}
      <div className="relative z-10 max-w-4xl w-full mx-auto px-6 py-10 text-center space-y-8 my-auto">
        {/* Status Badge */}
        <div>
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 shadow-sm animate-pulse">
            <Compass className="w-3.5 h-3.5" /> {t.badge}
          </span>
        </div>

        {/* 404 Large Gradient Display */}
        <div className="space-y-2">
          <h1 className="text-7xl sm:text-9xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 drop-shadow-sm select-none">
            404
          </h1>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {t.title}
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
            {t.subtitle}
          </p>
        </div>

        {/* Socratic Philosophical Card */}
        <div className="max-w-xl mx-auto p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800/90 backdrop-blur-md text-left shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-emerald-400 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t.socratesHeader}</span>
          </div>
          <p className="text-sm italic text-slate-200 leading-relaxed">
            {t.quote}
          </p>
          <div className="mt-2 text-right text-xs font-medium text-slate-400">
            {t.author}
          </div>
        </div>

        {/* IDE Mock Console / Java OOP Exception Card */}
        <div className="max-w-xl mx-auto rounded-xl bg-slate-900/90 border border-slate-800 text-left font-mono text-xs shadow-2xl overflow-hidden">
          <div className="bg-slate-950/80 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-slate-400 text-[11px] font-sans flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-cyan-400" />
                SocraticRouter.java
              </span>
            </div>
            <span className="text-[10px] text-rose-400 bg-rose-950/50 border border-rose-800/40 px-2 py-0.5 rounded font-mono">
              UNRESOLVED_ROUTE
            </span>
          </div>
          <div className="p-4 space-y-1 text-slate-300 leading-relaxed bg-slate-950/40">
            <div className="text-slate-500">{'// Route out of bounds in pedagogical graph'}</div>
            <div>
              <span className="text-rose-400 font-semibold">try</span> &#123;
            </div>
            <div className="pl-4">
              <span className="text-cyan-400">MatrixRouter</span>.resolveRoute(<span className="text-amber-300">&quot;current_path&quot;</span>);
            </div>
            <div>
              &#125; <span className="text-rose-400 font-semibold">catch</span> (<span className="text-amber-300">RouteNotFoundException</span> e) &#123;
            </div>
            <div className="pl-4 text-emerald-400">
              SocratesMentor.guide(<span className="text-emerald-300">&quot;{t.javaComment}&quot;</span>);
            </div>
            <div>&#125;</div>
          </div>
        </div>

        {/* Gateway Action Cards */}
        <div className="space-y-3 pt-2">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400">
            {t.actionsTitle}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            {/* Student Workspace Link */}
            <Link
              href="/student"
              className="group bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 rounded-2xl p-5 transition shadow-lg flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition">
                    <GraduationCap className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                    {t.studentCard.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition">
                  {t.studentCard.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {t.studentCard.desc}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center text-xs font-semibold text-emerald-400 gap-1">
                <span>{t.studentCard.cta}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </Link>

            {/* Teacher ERP Hub Link */}
            <Link
              href="/teacher"
              className="group bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900 rounded-2xl p-5 transition shadow-lg flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition">
                    <BarChart3 className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                    {t.teacherCard.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-cyan-400 transition">
                  {t.teacherCard.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {t.teacherCard.desc}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center text-xs font-semibold text-cyan-400 gap-1">
                <span>{t.teacherCard.cta}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </Link>

            {/* Socratix Home Link */}
            <Link
              href="/"
              className="group bg-slate-900/90 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 rounded-2xl p-5 transition shadow-lg flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 group-hover:scale-105 transition">
                    <Home className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                    {t.homeCard.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition">
                  {t.homeCard.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {t.homeCard.desc}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center text-xs font-semibold text-slate-300 group-hover:text-white gap-1 transition">
                <span>{t.homeCard.cta}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div>
          &copy; {new Date().getFullYear()} <span className="font-semibold text-slate-400">Socratix</span> &mdash; {t.footerText}
        </div>
        <a
          href="https://github.com/mohamedbelhassen/meta-hackaton-socratix-java-oop-mentor"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/70 border border-slate-800 text-slate-300 hover:text-white hover:border-emerald-500/40 hover:bg-slate-900 transition shadow-sm font-medium"
        >
          <svg className="w-4 h-4 fill-current text-slate-400 group-hover:text-white" viewBox="0 0 24 24" aria-hidden="true">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          <span>GitHub Repository</span>
        </a>
      </footer>
    </main>
  );
}

