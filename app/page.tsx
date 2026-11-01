import Link from 'next/link';
import { Sparkles, GraduationCap, BarChart3, ArrowRight, LogIn } from 'lucide-react';
import AuthHashListener from '@/components/AuthHashListener';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans relative">
      {/* Toast / Banner on Email Confirmation Redirect */}
      <AuthHashListener />

      {/* Top Bar with Login / Sign In */}
      <header className="absolute top-6 right-6 flex items-center gap-3">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 hover:text-white transition shadow-sm"
        >
          <LogIn className="w-3.5 h-3.5 text-emerald-400" />
          <span>Sign In / Sign Up</span>
        </Link>
      </header>

      <div className="max-w-4xl w-full space-y-10 text-center">
        <div className="space-y-4">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" /> Powered by Meta API (muse-spark-1.3) & Supabase Realtime
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
            Socratix <span className="text-emerald-400">🦉</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            The Course-Agnostic Socratic AI Mentor & Real-Time Competency ERP for University Coding Labs.
            Guides students without giving away solutions while streaming live telemetry to lecturers.
          </p>

          <div className="flex items-center justify-center gap-2 pt-2">
            <span className="text-xs px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-400 font-mono">
              ☕ Java OOP (FSG)
            </span>
            <span className="text-xs px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-400 font-mono">
              ⚡ Multi-Course Studio
            </span>
            <span className="text-xs px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-400 font-mono">
              📊 Realtime Matrix
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          {/* Student Workspace Card */}
          <Link
            href="/student"
            className="group bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 transition shadow-xl flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white group-hover:text-emerald-400 transition">
                Student Workspace
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                IDE Split-Screen interface with native File System Access API, 1-click Judge Presets,
                1-click Socratic Hint, and Smart Slide Viewer anchored to exact course slides.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold text-emerald-400 gap-1">
              Launch Student Workspace <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </Link>

          {/* Teacher Dashboard Card */}
          <Link
            href="/teacher"
            className="group bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 transition shadow-xl flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white group-hover:text-emerald-400 transition">
                Teacher ERP Hub
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Live consolidated student sessions, workstation seat mapping, micro-competency code occurrence drill-down,
                Curriculum Coverage Matrix, and Course Studio PDF pipeline.
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold text-emerald-400 gap-1">
              Open Teacher ERP Hub <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
