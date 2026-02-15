import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fgsbumwbkrqaqngivqbw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_izHuBuqX2KdhtwOAqtQ8gQ_arvsPO-o';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);