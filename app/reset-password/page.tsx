'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, CheckCircle2, AlertCircle, ArrowRight, Loader2, KeyRound } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    const supabase = getBrowserSupabase();

    const verifySession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session?.user) {
          setHasSession(true);
          setUserEmail(session.user.email || null);
          setSessionChecking(false);
          return;
        }

        // Allow 2.5 seconds for hash token hydration if arriving directly via fragment
        const timeout = setTimeout(() => {
          setSessionChecking(false);
        }, 2500);

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
          if (currentSession?.user) {
            clearTimeout(timeout);
            setHasSession(true);
            setUserEmail(currentSession.user.email || null);
            setSessionChecking(false);
          }
        });

        return () => {
          clearTimeout(timeout);
          subscription.unsubscribe();
        };
      } catch (err: unknown) {
        console.error('[Reset Password] Session check error:', err);
        setSessionChecking(false);
      }
    };

    verifySession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('idle');
    setStatusMessage('');

    if (password.length < 6) {
      setStatus('error');
      setStatusMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setStatus('error');
      setStatusMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    const supabase = getBrowserSupabase();

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      setStatus('success');
      setStatusMessage('Your password has been successfully updated! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 2500);
    } catch (err: unknown) {
      console.error('[Reset Password Error]:', err);
      setStatus('error');
      setStatusMessage(err instanceof Error ? err.message : 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full space-y-6">
        {/* LOGO & HERO */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2">
            <span className="text-2xl">🦉</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            Socratix <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">Security</span>
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Choose a new secure password for your Socratix account
          </p>
        </div>

        {/* CARD CONTAINER */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          {sessionChecking ? (
            <div className="py-10 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Verifying secure recovery token...</p>
            </div>
          ) : !hasSession ? (
            <div className="space-y-4 text-center py-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-white">Reset Link Expired or Invalid</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  No active recovery session was detected. Password reset tokens are single-use and expire after 1 hour.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
                >
                  <span>Request a New Reset Link</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : status === 'success' ? (
            <div className="space-y-4 text-center py-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-emerald-300">Password Updated Successfully</h2>
                <p className="text-xs text-slate-300 leading-relaxed">{statusMessage}</p>
              </div>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow-lg shadow-emerald-950/40"
                >
                  <span>Sign In Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-400" /> Set New Password
                </span>
                {userEmail && (
                  <span className="text-[11px] font-mono text-slate-400 truncate max-w-[180px]">
                    {userEmail}
                  </span>
                )}
              </div>

              {status === 'error' && (
                <div className="text-xs p-3 rounded-lg border leading-relaxed bg-rose-950/40 border-rose-500/30 text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{statusMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">New Password</label>
                  <Input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-9 focus-visible:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Confirm New Password</label>
                  <Input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-9 focus-visible:ring-emerald-500"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 mt-2 transition shadow-lg shadow-emerald-950/40"
                >
                  {loading ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating Password...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Save New Password
                    </span>
                  )}
                </Button>
              </form>
            </>
          )}
        </div>

        <div className="text-center">
          <Link href="/login" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition">
            ← Return to Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}

