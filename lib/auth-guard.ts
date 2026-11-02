import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { getServiceSupabase } from './supabase-admin';

const JURY_DEFAULT_PIN = process.env.JURY_PIN || process.env.NEXT_PUBLIC_JURY_PIN || '2026';

function verifyPinConstantTime(submitted: string, expected: string): boolean {
  if (!submitted || !expected) return false;
  const a = Buffer.from(submitted.trim());
  const b = Buffer.from(expected.trim());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

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
 * Validates permission for destructive actions (e.g. deleting master courses/labs).
 * Allows execution if:
 * 1. ALLOW_COURSE_DELETION is not explicitly set to 'false'
 * 2. An authenticated teacher is executing the request (role === 'teacher')
 * 3. OR the request provides an 'x-jury-pin' matching JURY_PIN via constant-time comparison
 */
export async function verifyDestructiveActionPermission(req: NextRequest): Promise<AuthGuardResult> {
  const isDeletionDisabled = process.env.ALLOW_COURSE_DELETION === 'false';
  if (isDeletionDisabled) {
    return {
      authorized: false,
      actor: 'unauthorized',
      error: 'Course deletion is currently disabled by administrator (ALLOW_COURSE_DELETION=false).',
    };
  }

  // 1. Authenticated Teacher check (first-class permission)
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

  // 2. Hackathon Jury PIN check (constant-time comparison)
  const pinHeader = req.headers.get('x-jury-pin');
  if (pinHeader && verifyPinConstantTime(pinHeader, JURY_DEFAULT_PIN)) {
    return { authorized: true, actor: 'jury_pin' };
  }

  return {
    authorized: false,
    actor: 'unauthorized',
    error: 'Destructive action requires an authenticated Teacher account or a valid Jury PIN.',
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
