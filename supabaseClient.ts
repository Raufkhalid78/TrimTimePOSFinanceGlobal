import { createClient } from '@supabase/supabase-js';

// 1. Try to read from Vite/Netlify Environment Variables
// Note: On Netlify, ensure you add these in Site Settings > Environment Variables
const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

// 2. Fallback Hardcoded Keys (REPLACE THESE IF NOT USING ENV VARS)
// Go to Supabase Dashboard -> Settings -> API -> Project URL / Anon Public Key
const FALLBACK_URL = 'https://fgsbumwbkrqaqngivqbw.supabase.co'; 
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnc2J1bXdia3JxYXFuZ2l2cWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTU2ODgsImV4cCI6MjA4NjY3MTY4OH0.lZlWHFXSLIyQyg7EWlCueLxVB-Lv2xvOpkBvpY9rsao';

const SUPABASE_URL = envUrl || FALLBACK_URL;
const SUPABASE_ANON_KEY = envKey || FALLBACK_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);