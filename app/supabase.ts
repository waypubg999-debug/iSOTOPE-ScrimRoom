import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bucvycxbdrqrffrqlvmm.supabase.co';
const supabaseAnonKey = 'sb_publishable_1rn2gKuQfT8QJrqtRck_Cg_PSawIRnX';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
