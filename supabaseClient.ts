import { createClient } from '@supabase/supabase-js';

// 1. Try to read from Vite/Netlify Environment Variables
// Note: On Netlify, ensure you add these in Site Settings > Environment Variables
const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

// 2. Fallback Hardcoded Keys (REPLACE THESE IF NOT USING ENV VARS)
// Go to Supabase Dashboard -> Settings -> API -> Project URL / Anon Public Key
const FALLBACK_URL = 'https://YOUR_PROJECT_ID.supabase.co'; 
const FALLBACK_KEY = 'YOUR_SUPABASE_ANON_KEY_STARTS_WITH_ey...';

const SUPABASE_URL = envUrl || FALLBACK_URL;
const SUPABASE_ANON_KEY = envKey || FALLBACK_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);