'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getBrowserSupabase } from '@/lib/supabase';

interface SignOutButtonProps {
  className?: string;
}

export default function SignOutButton({ className = '' }: SignOutButtonProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = getBrowserSupabase();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('[SignOutButton] Failed to sign out:', err);
      setSigningOut(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleSignOut}
      disabled={signingOut}
      title="Sign out"
      className={`h-7 text-xs text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2 gap-1 rounded-lg ${className}`}
    >
      <LogOut className="w-3 h-3" />
      <span>{signingOut ? 'Signing Out...' : 'Sign Out'}</span>
    </Button>
  );
}
