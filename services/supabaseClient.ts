
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Enhanced diagnostics
console.log('🔧 Supabase Client Initialization:');
console.log('  URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
console.log('  Anon Key:', supabaseAnonKey ? `✅ Set (${supabaseAnonKey.substring(0, 20)}...)` : '❌ Missing');

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL – add it to your .env file');
}

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY – add it to your .env file');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'Content-Type': 'application/json'
    }
  }
});

// Test connection on initialization
supabase.from('bim_leads').select('count').limit(0).then(({ error }) => {
  if (error) {
    console.error('❌ Supabase connection test failed:', error);
    console.error('   Possible issues:');
    console.error('   1. Invalid VITE_SUPABASE_ANON_KEY in .env file');
    console.error('   2. RLS policies not properly configured');
    console.error('   3. Database migrations not applied');
  } else {
    console.log('✅ Supabase connected successfully');
  }
});
