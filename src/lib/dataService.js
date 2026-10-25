// ============================================================
// THE ONE FILE THAT DECIDES WHERE DATA COMES FROM.
//
// - mockBackend  : localStorage simulation, zero infrastructure.
// - supabaseBackend : real Supabase (Auth, PostgreSQL + RLS, Realtime).
//
// How the mode is chosen (in order):
//   1. VITE_USE_MOCK env var — explicit override ("true"/"false")
//   2. If VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are present -> Supabase
//   3. Otherwise -> mock
//
// Pages branch on the exported `isMock` only where the UX legitimately
// differs (registration verification, password recovery) — everything else
// calls the same function names in both modes.
// ============================================================

import mockBackend from './mockBackend';
import supabaseBackend from './supabaseBackend';

const envMock = import.meta.env.VITE_USE_MOCK;
const hasSupabaseEnv = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const isMock =
  envMock !== undefined && envMock !== ''
    ? String(envMock).toLowerCase() !== 'false'
    : !hasSupabaseEnv;

export const mode = isMock ? 'mock' : 'supabase';

const backend = isMock ? mockBackend : supabaseBackend;

export default backend;
