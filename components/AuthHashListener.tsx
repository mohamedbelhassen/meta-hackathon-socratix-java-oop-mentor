'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase';
import { CheckCircle2, ArrowRight, ShieldCheck, X } from 'lucide-react';

interface VerifiedUser {
  id: string;
  email: string;
  displayName: string;
  role: 'teacher' | 'student';
}

export default function AuthHashListener() {
  const router = useRouter();
  const [verifiedUser, setVerifiedUser] = useState<VerifiedUser | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token=')) return;

    const supabase = getBrowserSupabase();

    const processAuthHash = async () => {
      try {
        // Supabase JS auto-parses the hash fragment when getSession() is called
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return;

        const user = session.user;
        const role = (user.user_metadata?.role === 'teacher' ? 'teacher' : 'student') as 'teacher' | 'student';
        const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User';

        // Securely ensure the profile row is present in public.profiles
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

        setVerifiedUser({
          id: user.id,
          email: user.email || '',
          displayName,
          role,
        });
        setIsVisible(true);

        // Clean the hash from the URL without triggering a reload
        window.history.replaceState(null, '', window.location.pathname);
      } catch (err) {
        console.warn('[AuthHashListener] Error processing hash:', err);
      }
    };

    processAuthHash();
  }, [router]);

  if (!isVisible || !verifiedUser) return null;

  return (
    <div className="fixed top-5 inset-x-4 max-w-2xl mx-auto z-50 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="bg-slate-900/95 border border-emerald-500/50 rounded-2xl p-4 shadow-2xl backdrop-blur-md flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">
                Compte confirmé avec succès !
              </span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {verifiedUser.role === 'teacher' ? 'Enseignant' : 'Étudiant'}
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Bienvenue <strong className="text-emerald-400">{verifiedUser.displayName}</strong>. Votre profil a été synchronisé.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={verifiedUser.role === 'teacher' ? '/teacher' : '/student'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow-md shadow-emerald-950/40"
          >
            <span>{verifiedUser.role === 'teacher' ? 'Accéder au Hub Enseignant' : 'Accéder au Workspace'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

