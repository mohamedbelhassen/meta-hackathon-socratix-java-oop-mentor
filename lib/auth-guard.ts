import { NextRequest } from 'next/server';
import { getServiceSupabase } from './supabase';

const JURY_DEFAULT_PIN = process.env.JURY_PIN || process.env.NEXT_PUBLIC_JURY_PIN || '2026';

export interface AuthGuardResult {
  authorized: boolean;
  actor: 'jury_pin' | 'authenticated_teacher' | 'service_role' | 'unauthorized';
  teacherId?: string;
  error?: string;
}

export interface SessionGuardResult {
  authorized: boolean;
  actor: 'guest_persona' | 'authenticated_student' | 'authenticated_teacher' | 'jury_pin' | 'unauthorized';
  callerId?: string;
  isTeacher?: boolean;
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

/**
 * Validates access to a student's session (context, reset, tutor).
 * Access is granted if:
 * 1. The request provides an 'x-jury-pin' matching JURY_PIN
 * 2. OR the target student is a guest demo persona (is_guest === true) -> allows frictionless evaluation by jury/guests
 * 3. OR the request provides an authorization bearer token from the student themselves (auth.uid === targetStudentId)
 * 4. OR the request provides an authorization bearer token from an authenticated teacher (profiles.role === 'teacher')
 */
export async function verifyStudentSessionAccess(
  req: NextRequest,
  targetStudentId: string
): Promise<SessionGuardResult> {
  const pinHeader = req.headers.get('x-jury-pin');
  if (pinHeader && pinHeader.trim() === JURY_DEFAULT_PIN) {
    return { authorized: true, actor: 'jury_pin', isTeacher: true };
  }

  const supabase = getServiceSupabase();

  // 1. Fetch target profile
  const { data: targetProfile, error: targetError } = await supabase
    .from('profiles')
    .select('id, is_guest')
    .eq('id', targetStudentId)
    .maybeSingle();

  if (targetError || !targetProfile) {
    return { authorized: false, actor: 'unauthorized', error: 'Target student not found.' };
  }

  // 2. Demo guest personas (Bob, Alice, Ines, Explorer) are freely accessible for jury evaluation
  if (targetProfile.is_guest === true) {
    return { authorized: true, actor: 'guest_persona' };
  }

  // 3. For real enrolled students (is_guest === false), require certified JWT authentication
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      authorized: false,
      actor: 'unauthorized',
      error: 'Authentication required to access real student session.',
    };
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      authorized: false,
      actor: 'unauthorized',
      error: 'Invalid or expired session token.',
    };
  }

  // 4. Check if caller is the target student themselves
  if (user.id === targetStudentId) {
    return { authorized: true, actor: 'authenticated_student', callerId: user.id, isTeacher: false };
  }

  // 5. Check if caller is an authenticated teacher
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (callerProfile?.role === 'teacher') {
    return { authorized: true, actor: 'authenticated_teacher', callerId: user.id, isTeacher: true };
  }

  return {
    authorized: false,
    actor: 'unauthorized',
    error: 'Forbidden: You cannot access, modify, or reset another student\'s session.',
  };
}
