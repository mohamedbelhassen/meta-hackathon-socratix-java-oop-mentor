'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, GraduationCap, School, Mail, RefreshCw, KeyRound, ArrowLeft, Loader2 } from 'lucide-react';
import { getAppBaseUrl } from '@/lib/url-utils';
import { isJurySandboxEnabled } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [teacherPin, setTeacherPin] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const isSignUp = authMode === 'signup';
  const isForgot = authMode === 'forgot';
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const supabase = getBrowserSupabase();

    try {
      if (isForgot) {
        if (!email || !email.includes('@')) {
          setMessage({
            type: 'error',
            text: 'Please enter a valid email address to receive password reset instructions.',
          });
          setLoading(false);
          return;
        }

        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
          setMessage({
            type: 'success',
            text: 'Password reset link sent! Please check your email inbox (and spam folder) for instructions.',
          });
        } else if (data.fallbackToClient) {
          const baseUrl = getAppBaseUrl();
          const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${baseUrl}/auth/callback?next=/reset-password`,
          });
          if (resetErr) throw resetErr;
          setMessage({
            type: 'success',
            text: 'Password reset email sent! Please check your inbox to choose a new password.',
          });
        } else {
          setMessage({
            type: 'error',
            text: data.error || 'Failed to dispatch password reset request.',
          });
        }
        return;
      }

      if (isSignUp) {
        if (role === 'teacher' && !teacherPin.trim()) {
          setMessage({
            type: 'error',
            text: isJurySandboxEnabled()
              ? 'A Teacher Secret PIN is required to register as teacher. (Demo Jury: 2026)'
              : 'A Teacher Secret PIN is required to register as teacher.',
          });
          setLoading(false);
          return;
        }

        const cleanDisplayName = displayName.trim() || email.split('@')[0];

        // Route registration through server API with Admin Auth + Brevo transactional delivery
        // This completely eliminates Supabase client-side SMTP failures ("Error sending confirmation email")
        const regRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            displayName: cleanDisplayName,
            role,
            teacherPin: role === 'teacher' ? teacherPin.trim() : undefined,
          }),
        });

        const regData = await regRes.json().catch(() => ({}));

        if (!regRes.ok || regData.error) {
          setMessage({
            type: 'error',
            text: regData.error || 'Failed to complete registration. Please try again.',
          });
          setLoading(false);
          return;
        }

        setMessage({
          type: 'success',
          text:
            regData.message ||
            'Account created! A confirmation email has been dispatched via Brevo. Please check your inbox (and spam folder) to activate your account.',
        });
        setLoading(false);
        return;
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        if (data?.user) {
          // Verify actual profile role from DB rather than unverified client state
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, display_name')
            .eq('id', data.user.id)
            .maybeSingle();

          const effectiveRole =
            (profile?.role as 'teacher' | 'student') ||
            (data.user.user_metadata?.role as 'teacher' | 'student') ||
            role;
          const userDisplayName =
            profile?.display_name ||
            (data.user.user_metadata?.display_name as string) ||
            email.split('@')[0];

          if (data.session?.access_token) {
            await fetch('/api/auth/sync-profile', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${data.session.access_token}`,
              },
              body: JSON.stringify({
                display_name: userDisplayName,
              }),
            }).catch(console.error);
          }

          if (effectiveRole === 'teacher') {
            router.push('/teacher');
          } else {
            router.push('/student');
          }
        }
      }
    } catch (err: unknown) {
      console.error('[Auth Error]:', err);
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Authentication failed. Please verify credentials.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email || !email.includes('@')) {
      setMessage({
        type: 'error',
        text: 'Please enter your email address in the field below first.',
      });
      return;
    }

    setResending(true);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          displayName: displayName || email.split('@')[0],
          role,
          isNewRegistration: false,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setMessage({
          type: 'success',
          text: 'A new verification link has been sent to your email via Brevo! Please check your inbox.',
        });
      } else {
        setMessage({
          type: 'error',
          text: json.error || 'Failed to send verification email. Please check your Brevo configuration.',
        });
      }
    } catch (err) {
      console.error('[Resend Error]:', err);
      setMessage({
        type: 'error',
        text: 'Network error occurred while trying to send verification email.',
      });
    } finally {
      setResending(false);
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
            Socratix <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">v2.0</span>
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Autonomous Socratic AI Mentor &amp; Adaptive Teacher ERP for Computer Science Labs
          </p>
        </div>

        {/* 1-CLICK JURY SANDBOX SHORTCUT (Hidden in Production / Classroom Mode) */}
        {isJurySandboxEnabled() && (
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 text-center space-y-3 shadow-lg">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-300">
              <Sparkles className="w-4 h-4 text-emerald-400" /> Hackathon Jury / Demo Access
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              No password or registration required! Explore all features, live telemetry, and AI Socratic mentoring directly.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => router.push('/student')}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs h-9"
              >
                <GraduationCap className="w-3.5 h-3.5 mr-1.5" /> Student Sandbox
              </Button>
              <Button
                type="button"
                onClick={() => router.push('/teacher')}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-medium text-xs h-9"
              >
                <School className="w-3.5 h-3.5 mr-1.5" /> Teacher Hub
              </Button>
            </div>
          </div>
        )}

        {/* SUPABASE AUTH FORM */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-xs">
            <span className="font-semibold text-slate-300">
              {isForgot ? 'Reset Password' : isSignUp ? 'Register with Email' : 'Email Sign In'}
            </span>
            {isForgot ? (
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setMessage(null);
                }}
                className="text-emerald-400 hover:underline flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" /> Back to Sign In
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthMode(isSignUp ? 'signin' : 'signup');
                  setMessage(null);
                }}
                className="text-emerald-400 hover:underline"
              >
                {isSignUp ? 'Already have an account?' : 'Need an account?'}
              </button>
            )}
          </div>

          {message && (
            <div
              className={`text-xs p-3 rounded-lg border leading-relaxed ${
                message.type === 'error'
                  ? 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                  : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              }`}
            >
              {message.text}
            </div>
          )}

          {isForgot ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Enter your account email to receive a secure recovery link. You will be able to choose a new password.
              </p>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Email Address</label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@institution.edu"
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-9 focus-visible:ring-emerald-500"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 transition shadow-lg shadow-emerald-950/40"
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending Link...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" /> Send Reset Link via Brevo
                  </span>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {isSignUp && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Full Name</label>
                    <Input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Alice Dev"
                      className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Role</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setRole('student')}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium border transition ${
                          role === 'student'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        Student
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('teacher')}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium border transition ${
                          role === 'teacher'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        Teacher
                      </button>
                    </div>
                  </div>

                  {role === 'teacher' && (
                    <div className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-950/20 p-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-amber-300">Teacher Secret PIN</label>
                        {isJurySandboxEnabled() && (
                          <button
                            type="button"
                            onClick={() => setTeacherPin('2026')}
                            className="text-[10px] font-mono text-amber-400 hover:text-amber-200 underline cursor-pointer"
                            title="Auto-fill Demo Jury PIN"
                          >
                            Demo Jury: 2026 (Auto-fill)
                          </button>
                        )}
                      </div>
                      <Input
                        type="password"
                        required
                        value={teacherPin}
                        onChange={(e) => setTeacherPin(e.target.value)}
                        placeholder={isJurySandboxEnabled() ? "Enter PIN (Demo: 2026)" : "Enter Teacher Secret PIN"}
                        className="bg-slate-950 border-amber-500/40 text-slate-100 text-xs h-9 focus-visible:ring-amber-500"
                      />
                      <p className="text-[10px] text-slate-400 leading-tight">
                        {isJurySandboxEnabled() ? (
                          <>
                            To prevent unauthorized self-elevation, teacher registration requires a PIN. For hackathon evaluators, use <strong className="text-amber-300">2026</strong>.
                          </>
                        ) : (
                          <>
                            Teacher registration requires an administrator authorization PIN to verify faculty credentials.
                          </>
                        )}
                      </p>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-1">
                <label className="text-xs text-slate-400">Email Address</label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@institution.edu"
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-400">Password</label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('forgot');
                        setMessage(null);
                      }}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs h-9"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-semibold text-xs h-9 mt-2"
              >
                {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
              </Button>
            </form>
          )}

          {/* RESEND VERIFICATION EMAIL ACTION */}
          {!isForgot && (
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1 text-slate-400">
                <Mail className="w-3 h-3 text-slate-400" /> Need verification link?
              </span>
              <button
                type="button"
                disabled={resending}
                onClick={handleResendVerification}
                className="text-emerald-400 hover:text-emerald-300 hover:underline disabled:opacity-50 flex items-center gap-1 font-medium"
              >
                <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                {resending ? 'Sending...' : 'Resend via Brevo'}
              </button>
            </div>
          )}
        </div>

        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition">
            ← Back to Homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
