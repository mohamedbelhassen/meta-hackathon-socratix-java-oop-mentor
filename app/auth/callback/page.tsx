'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase';
import { CheckCircle2, ArrowRight, Loader2, AlertCircle, Home, School, GraduationCap } from 'lucide-react';
import type { EmailOtpType } from '@supabase/supabase-js';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [userName, setUserName] = useState('');
  const [targetRole, setTargetRole] = useState<'teacher' | 'student'>('student');
  const [redirectPath, setRedirectPath] = useState<string>('/');
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const supabase = getBrowserSupabase();

    const syncUserAndFinish = async (
      user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
      accessToken: string,
      customNext?: string | null
    ) => {
      // 1. Auto-sync profile to public.profiles via server API first
      const defaultName = (user.user_metadata?.display_name as string) || user.email?.split('@')[0] || 'User';
      try {
        await fetch('/api/auth/sync-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            display_name: defaultName,
          }),
        });
      } catch (syncErr) {
        console.warn('[Auth Callback] Profile sync warning:', syncErr);
      }

      // 2. Fetch ground-truth profile from DB to accurately reflect teacher vs student role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, display_name')
        .eq('id', user.id)
        .maybeSingle();

      const resolvedRole = (profile?.role || user.user_metadata?.role || 'student') as 'teacher' | 'student';
      const resolvedDisplayName = profile?.display_name || defaultName;

      setUserName(resolvedDisplayName);
      setTargetRole(resolvedRole);

      // 3. User requested home page redirection by default to freely choose their space
      const destination = customNext && customNext !== '/student' && customNext !== '/teacher' ? customNext : '/';
      setRedirectPath(destination);
      setStatus('success');
    };

    const handleCallback = async () => {
      try {
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const tokenHash = urlParams?.get('token_hash');
        const otpType = urlParams?.get('type') as EmailOtpType | null;
        const code = urlParams?.get('code');
        const nextParam = urlParams?.get('next');

        // Mode 1: Token Hash OTP verification (Brevo custom email link with token_hash)
        if (tokenHash && otpType) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          });

          if (error) {
            console.error('[Auth Callback] verifyOtp error:', error);
            throw error;
          }

          if (data?.session && data?.user) {
            await syncUserAndFinish(data.user, data.session.access_token, nextParam);
            return;
          }
        }

        // Mode 2: PKCE Authorization Code Exchange (?code=...)
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('[Auth Callback] exchangeCodeForSession error:', error);
            throw error;
          }

          if (data?.session && data?.user) {
            await syncUserAndFinish(data.user, data.session.access_token, nextParam);
            return;
          }
        }

        // Mode 3: Implicit flow / hash fragment session (#access_token=...&refresh_token=...)
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (session?.user && session?.access_token) {
          await syncUserAndFinish(session.user, session.access_token, nextParam);
          return;
        }

        // Mode 4: Wait for onAuthStateChange if session hydration is slightly delayed
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
          if (currentSession?.user && currentSession?.access_token) {
            await syncUserAndFinish(currentSession.user, currentSession.access_token, nextParam);
            subscription.unsubscribe();
          }
        });

        // Set a timeout of 5 seconds before reporting missing session
        setTimeout(() => {
          setStatus((prev) => {
            if (prev === 'loading') {
              setErrorMessage('Le jeton de session est introuvable ou a déjà été utilisé.');
              return 'error';
            }
            return prev;
          });
        }, 5000);
      } catch (err: unknown) {
        console.error('[Auth Callback] Error:', err);
        setStatus('error');
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Échec de la validation du jeton de sécurité. Le lien a peut-être expiré.'
        );
      }
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
          router.push(redirectPath);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status, redirectPath, router]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
        {status === 'loading' && (
          <div className="py-8 space-y-4">
            <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
            <h1 className="text-lg font-bold text-slate-100">Vérification de votre compte...</h1>
            <p className="text-xs text-slate-400">
              Finalisation de l&apos;authentification et synchronisation de votre profil.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/40">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span
                className={`text-[11px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                  targetRole === 'teacher'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}
              >
                Compte Activé • {targetRole === 'teacher' ? 'Enseignant / Mentor' : 'Étudiant'}
              </span>
              <h1 className="text-2xl font-extrabold text-white">Bienvenue sur Socratix 🦉</h1>
              <p className="text-sm text-slate-300">
                Votre adresse email a été confirmée avec succès,{' '}
                <strong className={targetRole === 'teacher' ? 'text-amber-400' : 'text-emerald-400'}>{userName}</strong>.
              </p>
            </div>

            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-400">
              Redirection automatique vers l&apos;accueil dans{' '}
              <span className="font-bold text-emerald-400">{countdown}s</span>...
            </div>

            <div className="space-y-2 pt-1">
              <Link
                href="/"
                className="inline-flex w-full items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow-lg shadow-emerald-950/50"
              >
                <Home className="w-4 h-4" />
                <span>Accéder à la page d&apos;accueil</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  href="/teacher"
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition ${
                    targetRole === 'teacher'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <School className="w-3.5 h-3.5" />
                  <span>Teacher Hub</span>
                </Link>
                <Link
                  href="/student"
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition ${
                    targetRole === 'student'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Student Workspace</span>
                </Link>
              </div>
            </div>
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
                {errorMessage || 'Le jeton de confirmation est manquant, invalide ou a expiré.'}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
              >
                <span>Retour à la page de connexion</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
