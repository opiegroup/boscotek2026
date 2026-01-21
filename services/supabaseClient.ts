import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Enhanced diagnostics
console.log('🔧 Supabase Client Initialization:');
console.log('  URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
console.log('  Anon Key:', supabaseAnonKey ? `✅ Set (${supabaseAnonKey.substring(0, 20)}...)` : '❌ Missing');
console.log('  Current URL:', window.location.href);
console.log('  Hash:', window.location.hash);

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
    flowType: 'pkce', // Use PKCE flow for better security
  },
  global: {
    headers: {
      'Content-Type': 'application/json'
    }
  }
});

// Check for auth tokens in URL and process them
const processAuthTokens = async () => {
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.substring(1));
  
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const type = params.get('type');
  const error = params.get('error');
  const errorDescription = params.get('error_description');
  
  console.log('🔑 Auth Token Check:', { 
    hasAccessToken: !!accessToken, 
    hasRefreshToken: !!refreshToken, 
    type, 
    error,
    errorDescription 
  });
  
  if (error) {
    console.error('❌ Auth error in URL:', error, errorDescription);
    return;
  }
  
  if (accessToken && refreshToken) {
    console.log('🔐 Found tokens in URL, setting session...');
    
    // Store type for password reset flow
    if (type === 'invite' || type === 'recovery') {
      sessionStorage.setItem('boscotek_password_reset_pending', 'true');
      sessionStorage.setItem('boscotek_auth_type', type);
      console.log('📝 Stored password reset flag for type:', type);
    }
    
    try {
      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      
      if (sessionError) {
        console.error('❌ Failed to set session:', sessionError);
      } else {
        console.log('✅ Session set successfully:', data.user?.email);
        // Clear the hash from URL after processing
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch (err) {
      console.error('❌ Error setting session:', err);
    }
  }
};

// Process tokens immediately
processAuthTokens();

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
