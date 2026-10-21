// ============================================================
// SUPABASE CLIENT (Phase 2 connection point)
//
// Safe by design:
//  - Only the Project URL and the ANON key are used in the browser.
//    Both are PUBLIC values — this is safe because all authorization
//    is enforced by Row Level Security inside PostgreSQL.
//  - The service_role key must NEVER appear in a VITE_ variable or in
//    any frontend code (see .env.example security note).
//
// This file is intentionally inert in Phase 1: isSupabaseConfigured
// stays false until you fill in .env, so nothing breaks in mock mode.
// ============================================================

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;
