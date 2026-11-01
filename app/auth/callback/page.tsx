'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase';
import { CheckCircle2, ArrowRight, Loader2, Sparkles, AlertCircle } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [userName, setUserName] = useState('');
  const [targetRole, setTargetRole] = useState<'teacher' | 'student'>('student');
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const supabase = getBrowserSupabase();

    const handleCallback = async () => {
      try {
        // Retrieve session parsed from hash fragment or code exchange
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (!session) {
          // If session is not ready yet, listen for onAuthStateChange
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (currentSession?.user) {
              await syncUserAndFinish(currentSession.user);
              subscription.unsubscribe();
            }
          });
          return;
        }

        await syncUserAndFinish(session.user);
      } catch (err: unknown) {
        console.error('[Auth Callback] Error:', err);
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Failed to verify authentication token.');
      }
    };

    const syncUserAndFinish = async (user: { id: string; email?: string; user_metadata?: Record<string, unknown> }) => {
      const role = (user.user_metadata?.role === 'teacher' ? 'teacher' : 'student') as 'teacher' | 'student';
      const displayName = (user.user_metadata?.display_name as string) || user.email?.split('@')[0] || 'User';

      setUserName(displayName);
      setTargetRole(role);

      // Auto-sync profile to public.profiles via server API
      await fetch('/api/auth/sync-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          display_name: displayName,
          role,
        }),
      }).catch(console.error);

      setStatus('success');
    };

    handleCallback();
  }, []);

  // Automatic countdown redirection on success
  useEffect(() => {
    if (status !== 'success') return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          router.push(targetRole === 'teacher' ? '/teacher' : '/student');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status, targetRole, router]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
        {status === 'loading' && (
          <div className="py-8 space-y-4">
            <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
            <h1 className="text-lg font-bold text-slate-100">Vérification de votre compte...</h1>
            <p className="text-xs text-slate-400">Finalisation de l'authentification et synchronisation de votre profil.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/40">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Compte Activé • {targetRole === 'teacher' ? 'Enseignant' : 'Étudiant'}
              </span>
              <h1 className="text-2xl font-extrabold text-white">Bienvenue sur Socratix 🦉</h1>
              <p className="text-sm text-slate-300">
                Votre adresse email a été confirmée avec succès, <strong className="text-emerald-400">{userName}</strong>.
              </p>
            </div>

            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-400">
              Redirection automatique vers votre espace dans <span className="font-bold text-emerald-400">{countdown}s</span>...
            </div>

            <Link
              href={targetRole === 'teacher' ? '/teacher' : '/student'}
              className="inline-flex w-full items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow-lg shadow-emerald-950/50"
            >
              <span>{targetRole === 'teacher' ? 'Ouvrir le Teacher ERP Hub' : 'Ouvrir le Workspace'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-white">Lien expiré ou invalide</h1>
              <p className="text-xs text-rose-300/90 leading-relaxed">
                {errorMessage || 'Le jeton de confirmation est manquant ou a expiré.'}
              </p>
            </div>

            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
            >
              <span>Retour à la page de connexion</span>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

