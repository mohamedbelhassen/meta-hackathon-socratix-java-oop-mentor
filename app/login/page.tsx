'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, GraduationCap, School } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const supabase = getBrowserSupabase();

    try {
      if (isSignUp) {
        const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName || email.split('@')[0],
              role,
            },
            emailRedirectTo: redirectUrl,
          },
        });
        if (error) throw error;

        // Auto-sync profile if user object is returned immediately
        if (data?.user) {
          await fetch('/api/auth/sync-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: data.user.id,
              email: data.user.email,
              display_name: displayName || email.split('@')[0],
              role,
            }),
          }).catch(console.error);
        }

        setMessage({
          type: 'success',
          text: 'Account created! Please check your email to confirm your registration or log in.',
        });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        if (data?.user) {
          const userRole = (data.user.user_metadata?.role as 'teacher' | 'student') || role;
          const userDisplayName = (data.user.user_metadata?.display_name as string) || email.split('@')[0];

          await fetch('/api/auth/sync-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: data.user.id,
              email: data.user.email,
              display_name: userDisplayName,
              role: userRole,
            }),
          }).catch(console.error);

          router.push(userRole === 'teacher' ? '/teacher' : '/student');
        } else {
          router.push(role === 'teacher' ? '/teacher' : '/student');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during authentication.';
      setMessage({ type: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 text-2xl font-black text-white hover:opacity-90">
            Socratix <span className="text-emerald-400">🦉</span>
          </Link>
          <h1 className="text-xl font-bold text-slate-200">
            {isSignUp ? 'Create an Account' : 'Sign in to Socratix'}
          </h1>
          <p className="text-xs text-slate-400">
            Dual-Track Access: use official Supabase Auth or jump directly into the Instant Jury Sandbox.
          </p>
        </div>

        {/* 1-CLICK JURY SANDBOX SHORTCUT */}
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

        {/* SUPABASE AUTH FORM */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-xs">
            <span className="font-semibold text-slate-300">
              {isSignUp ? 'Register with Email' : 'Email Sign In'}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setMessage(null);
              }}
              className="text-emerald-400 hover:underline"
            >
              {isSignUp ? 'Already have an account?' : 'Need an account?'}
            </button>
          </div>

          {message && (
            <div
              className={`text-xs p-3 rounded-lg border ${
                message.type === 'error'
                  ? 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                  : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              }`}
            >
              {message.text}
            </div>
          )}

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
              <label className="text-xs text-slate-400">Password</label>
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
