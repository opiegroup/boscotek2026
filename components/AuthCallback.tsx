import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

interface AuthCallbackProps {
  onComplete: () => void;
}

const AuthCallback: React.FC<AuthCallbackProps> = ({ onComplete }) => {
  const [status, setStatus] = useState<'loading' | 'set-password' | 'success' | 'error'>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Check if we have auth tokens in the URL (from invite/magic link)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const type = hashParams.get('type');
    const errorCode = hashParams.get('error_code');
    const errorDesc = hashParams.get('error_description');

    // Handle error in URL (expired link, etc)
    if (errorCode) {
      console.error('Auth error:', errorCode, errorDesc);
      setError(decodeURIComponent(errorDesc || errorCode || 'Authentication failed'));
      setStatus('error');
      return;
    }

    if (accessToken && refreshToken) {
      // Set the session from the tokens
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      }).then(({ data, error }) => {
        if (error) {
          console.error('Session error:', error);
          setError(error.message);
          setStatus('error');
        } else if (data.session) {
          // Check if this is an invite or recovery - user needs to set password
          if (type === 'invite' || type === 'recovery' || type === 'signup') {
            setStatus('set-password');
          } else {
            // Regular magic link, just complete
            setStatus('success');
            setTimeout(onComplete, 1500);
          }
        }
      });
    } else {
      // No tokens, just redirect to home
      onComplete();
    }
  }, [onComplete]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      setStatus('success');
      setTimeout(onComplete, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to set password');
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-zinc-400">Setting up your account...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    const isExpired = error?.toLowerCase().includes('expired');
    
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">{isExpired ? '⏰' : '⚠️'}</div>
          <h1 className="text-xl font-bold text-white mb-2">
            {isExpired ? 'Link Expired' : 'Something went wrong'}
          </h1>
          <p className="text-red-400 mb-4">{error}</p>
          {isExpired && (
            <p className="text-zinc-400 text-sm mb-6">
              Please ask your administrator to resend the invite, or try signing in if you already have an account.
            </p>
          )}
          <button
            onClick={onComplete}
            className="bg-amber-500 text-black font-bold px-6 py-3 rounded hover:bg-amber-400"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-white mb-2">You're all set!</h1>
          <p className="text-zinc-400">Redirecting you to the configurator...</p>
        </div>
      </div>
    );
  }

  // Set password form
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-2xl font-bold text-white mb-2">Set Your Password</h1>
          <p className="text-zinc-400">
            Welcome! Please create a password to complete your account setup.
          </p>
        </div>

        <form onSubmit={handleSetPassword} className="space-y-4">
          {error && (
            <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-3 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-zinc-500 mb-2">NEW PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password (min 8 characters)"
              required
              minLength={8}
              className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-500 mb-2">CONFIRM PASSWORD</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-amber-500 text-black font-bold py-3 rounded hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Setting password...' : 'Set Password & Continue'}
          </button>
        </form>

        <p className="text-xs text-zinc-600 text-center mt-6">
          By continuing, you agree to our terms of service.
        </p>
      </div>
    </div>
  );
};

export default AuthCallback;
