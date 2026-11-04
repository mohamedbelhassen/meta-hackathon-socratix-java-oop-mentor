import Link from 'next/link';
import { Sparkles, GraduationCap, BarChart3, ArrowRight, LogIn } from 'lucide-react';
import AuthHashListener from '@/components/AuthHashListener';
import ThemeToggle from '@/components/ThemeToggle';
import { getGithubRepoUrl } from '@/lib/utils';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-6 font-sans relative">
      {/* Toast / Banner on Email Confirmation Redirect */}
      <AuthHashListener />

      {/* Top Bar with Login / Sign In & Theme Switcher */}
      <header className="absolute top-6 right-6 flex items-center gap-2.5 z-20">
        <ThemeToggle size="md" />
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 hover:border-emerald-500/60 dark:hover:border-emerald-500/40 hover:text-slate-950 dark:hover:text-white transition shadow-sm"
        >
          <LogIn className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400" />
          <span>Sign In / Sign Up</span>
        </Link>
      </header>

      <div className="max-w-4xl w-full space-y-10 text-center">
        <div className="space-y-4">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" /> Powered by Meta API (muse-spark-1.3) &amp; Supabase Realtime
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Socratix <span className="text-[#059669] dark:text-emerald-400">🦉</span>
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            The Course-Agnostic Socratic AI Mentor &amp; Real-Time Competency ERP for University Coding Labs.
            Guides students without giving away solutions while streaming live telemetry to lecturers.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <span className="text-xs px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 font-mono shadow-xs">
              🧠 Course-Agnostic Socratic AI
            </span>
            <span className="text-xs px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 font-mono shadow-xs">
              ⚡ Multi-Course Studio
            </span>
            <span className="text-xs px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 font-mono shadow-xs">
              📊 Realtime Matrix
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          {/* Student Workspace Card */}
          <Link
            href="/student"
            className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500/50 rounded-2xl p-6 transition shadow-md hover:shadow-lg dark:shadow-xl flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 flex items-center justify-center text-[#059669] dark:text-emerald-400">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-[#059669] dark:group-hover:text-emerald-400 transition">
                Student Workspace
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                IDE Split-Screen interface with native File System Access API, 1-click Judge Presets,
                1-click Socratic Hint, and Smart Slide Viewer anchored to exact course slides.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold text-[#059669] dark:text-emerald-400 gap-1">
              Launch Student Workspace <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </Link>

          {/* Teacher Dashboard Card */}
          <Link
            href="/teacher"
            className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500/50 rounded-2xl p-6 transition shadow-md hover:shadow-lg dark:shadow-xl flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 flex items-center justify-center text-[#059669] dark:text-emerald-400">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-[#059669] dark:group-hover:text-emerald-400 transition">
                Teacher ERP Hub
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Live consolidated student sessions, workstation seat mapping, micro-competency code occurrence drill-down,
                Curriculum Coverage Matrix, and Course Studio PDF pipeline.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold text-[#059669] dark:text-emerald-400 gap-1">
              Open Teacher ERP Hub <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </Link>
        </div>

        {/* Footer with Copyright and GitHub Repository Link */}
        <footer className="pt-8 border-t border-slate-200 dark:border-slate-900/80 w-full flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            &copy; {new Date().getFullYear()} <span className="font-semibold text-slate-700 dark:text-slate-400">Socratix</span> &mdash; Built for the Meta AI Hackathon by{' '}
            <span className="text-slate-800 dark:text-slate-300 font-medium">Mohamed Belhassen</span>
            {' · '}
            <span className="text-slate-600 dark:text-slate-400">Licensed under AGPL-3.0-or-later</span>.
          </div>
          <a
            href={getGithubRepoUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:border-emerald-500/50 dark:hover:border-emerald-500/40 dark:hover:bg-slate-900 transition shadow-sm font-medium"
          >
            <svg className="w-4 h-4 fill-current text-slate-600 dark:text-slate-400 group-hover:text-slate-950 dark:group-hover:text-white" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span>GitHub Repository</span>
          </a>
        </footer>
      </div>
    </main>
  );
}
