import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let serviceClient: SupabaseClient | null = null;
let typedServiceClient: SupabaseClient<Database> | null = null;

function assertServiceKey(): { url: string; key: string } {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      '[Security Error] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
        'Operations requiring Service Role privileges cannot fall back to anonymous keys.'
    );
  }
  return { url: supabaseUrl, key: supabaseServiceRoleKey };
}

/**
 * Returns a server-side Supabase client using the Service Role Key.
 * Protected by 'server-only' to prevent inclusion in client bundles.
 */
export function getServiceSupabase(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const { url, key } = assertServiceKey();
  serviceClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return serviceClient;
}

/**
 * Helper to obtain a strictly typed Supabase Client with the Database schema.
 */
export function getTypedServiceSupabase(): SupabaseClient<Database> {
  if (typedServiceClient) return typedServiceClient;
  const { url, key } = assertServiceKey();
  typedServiceClient = createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return typedServiceClient;
}
