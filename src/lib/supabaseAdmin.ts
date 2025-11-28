import { createClient } from "@supabase/supabase-js";

// Note: This client should ONLY be used in server-side contexts (API routes, Server Actions)
// It has admin privileges and bypasses Row Level Security (RLS).
// NEVER expose the service role key to the client.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn(
    "Missing Supabase environment variables for Admin client. Check .env file."
  );
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
