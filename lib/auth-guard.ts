import { NextRequest } from 'next/server';
import { getServiceSupabase } from './supabase';

const JURY_DEFAULT_PIN = process.env.JURY_PIN || '2026';

export interface AuthGuardResult {
  authorized: boolean;
  actor: 'jury_pin' | 'authenticated_teacher' | 'service_role' | 'unauthorized';
  teacherId?: string;
  error?: string;
}

/**
 * Validates permission for destructive actions (e.g. deleting or overwriting master courses/labs).
 * Allows execution if:
 * 1. The request provides an 'x-jury-pin' header matching JURY_PIN (default: '2026')
 * 2. OR the request provides an authorization bearer token from an authenticated teacher
 */
export async function verifyDestructiveActionPermission(req: NextRequest): Promise<AuthGuardResult> {
  const pinHeader = req.headers.get('x-jury-pin');
  if (pinHeader && pinHeader.trim() === JURY_DEFAULT_PIN) {
    return { authorized: true, actor: 'jury_pin' };
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    const supabase = getServiceSupabase();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role === 'teacher') {
        return { authorized: true, actor: 'authenticated_teacher', teacherId: user.id };
      }
    }
  }

  return {
    authorized: false,
    actor: 'unauthorized',
    error: 'Destructive mutation requires a valid Jury PIN (e.g. 2026) or Teacher authentication.',
  };
}
