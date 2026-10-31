import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let browserClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

/**
 * Returns a singleton browser-side Supabase client using anon key.
 * Safe for client components (Realtime subscriptions, Broadcast, and read queries).
 */
export function getBrowserSupabase(): SupabaseClient {
  if (browserClient) return browserClient;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing in environment variables.');
  }
  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return browserClient;
}

/**
 * Returns a server-side Supabase client using the Service Role Key.
 * MUST ONLY be called in Next.js Server Components, Route Handlers, or Server Actions.
 */
export function getServiceSupabase(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const key = supabaseServiceRoleKey || supabaseAnonKey;
  if (!supabaseUrl || !key) {
    throw new Error('Supabase URL or Service Role Key is missing for server operations.');
  }
  serviceClient = createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return serviceClient;
}
