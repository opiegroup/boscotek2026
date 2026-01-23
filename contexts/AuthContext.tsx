import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../services/supabaseClient';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

// Role types matching database enum
export type UserRole = 'super_admin' | 'admin' | 'pricing_manager' | 'sales' | 'distributor' | 'viewer';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole | null;
  isDistributor: boolean;
  distributorInfo?: {
    companyName: string;
    accountNumber: string;
    tierName: string | null;
  };
}

interface AuthContextType {
  // State
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  showPasswordReset: boolean; // True when user needs to set/reset password
  linkExpiredError: string | null; // Error message for expired invite links
  
  // Role checks
  isAuthenticated: boolean;
  isSuperAdmin: boolean;  // God Mode - full access to all brands
  isAdmin: boolean;       // Admin or Super Admin
  isPricingManager: boolean;
  isSales: boolean;
  isDistributor: boolean;
  isStaff: boolean; // super_admin, admin, sales, or pricing_manager
  canManagePricing: boolean; // super_admin, admin, or pricing_manager
  isGodMode: boolean; // Alias for isSuperAdmin
  
  // Actions
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearPasswordReset: () => void;
  updatePassword: (newPassword: string) => Promise<{ error?: string }>;
  clearLinkExpiredError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Storage keys
const PASSWORD_RESET_FLAG = 'boscotek_password_reset_pending';
const AUTH_TYPE_KEY = 'boscotek_auth_type';

// Check URL hash for recovery/invite tokens on initial load
// This runs BEFORE Supabase processes the tokens
const checkUrlForPasswordReset = (): boolean => {
  const hash = window.location.hash;
  const search = window.location.search;
  
  console.log('🔍 Checking URL for password reset:', { hash: hash.substring(0, 100), search });
  
  let needsReset = false;
  
  // Check hash for tokens (Supabase default)
  if (hash.includes('type=recovery') || hash.includes('type=invite')) {
    console.log('✅ Found recovery/invite in hash');
    needsReset = true;
  }
  
  // Check query params (some configurations)
  if (search.includes('type=recovery') || search.includes('type=invite')) {
    console.log('✅ Found recovery/invite in search params');
    needsReset = true;
  }
  
  // Also check for access_token with invite/recovery type
  if (hash.includes('access_token')) {
    console.log('✅ Found access_token in hash');
    if (hash.includes('recovery') || hash.includes('invite')) {
      needsReset = true;
    }
  }
  
  // If we found recovery tokens, store a flag (persists even after Supabase clears URL)
  if (needsReset) {
    sessionStorage.setItem(PASSWORD_RESET_FLAG, 'true');
    console.log('📝 Set password reset flag');
    return true;
  }
  
  // Check if we have a pending reset from session storage (set by supabaseClient.ts)
  const storedFlag = sessionStorage.getItem(PASSWORD_RESET_FLAG);
  const storedType = sessionStorage.getItem(AUTH_TYPE_KEY);
  
  if (storedFlag === 'true') {
    console.log('✅ Found pending password reset flag, type:', storedType);
    return true;
  }
  
  return false;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Check URL on initial load for recovery tokens (lazy init to run only once)
  const [showPasswordReset, setShowPasswordReset] = useState(() => checkUrlForPasswordReset());

  // Fetch user role and distributor info from database
  const fetchUserDetails = useCallback(async (supabaseUser: SupabaseUser): Promise<AuthUser> => {
    const baseUser: AuthUser = {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      name: supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0] || 'User',
      role: null,
      isDistributor: false,
    };

    try {
      // Fetch user role using RPC for proper priority ordering
      // (super_admin > admin > pricing_manager > sales > distributor > viewer)
      const { data: roleData, error: roleError } = await supabase
        .rpc('get_user_role');

      if (roleError) {
        console.warn('Failed to fetch user role via RPC, trying direct query:', roleError);
        // Fallback to direct query with proper ordering
        const { data: fallbackData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', supabaseUser.id);
        
        if (fallbackData && fallbackData.length > 0) {
          // Manually prioritize roles
          const roles = fallbackData.map(r => r.role);
          if (roles.includes('super_admin')) baseUser.role = 'super_admin';
          else if (roles.includes('admin')) baseUser.role = 'admin';
          else if (roles.includes('pricing_manager')) baseUser.role = 'pricing_manager';
          else if (roles.includes('sales')) baseUser.role = 'sales';
          else if (roles.includes('distributor')) baseUser.role = 'distributor';
          else if (roles.includes('viewer')) baseUser.role = 'viewer';
        }
      } else if (roleData) {
        baseUser.role = roleData as UserRole;
      }

      // If distributor, fetch distributor details
      if (baseUser.role === 'distributor') {
        const { data: distData, error: distError } = await supabase
          .from('distributors')
          .select(`
            company_name,
            account_number,
            pricing_tiers (
              name
            )
          `)
          .eq('user_id', supabaseUser.id)
          .eq('is_active', true)
          .eq('is_approved', true)
          .single();

        if (distError) {
          console.warn('Failed to fetch distributor info:', distError);
        } else if (distData) {
          baseUser.isDistributor = true;
          baseUser.distributorInfo = {
            companyName: distData.company_name,
            accountNumber: distData.account_number,
            tierName: (distData.pricing_tiers as { name: string } | null)?.name || null,
          };
        }
      }
    } catch (err) {
      console.error('Error fetching user details:', err);
    }

    return baseUser;
  }, []);

  // Handle session changes
  const handleSessionChange = useCallback(async (newSession: Session | null) => {
    setSession(newSession);
    
    if (newSession?.user) {
      const userDetails = await fetchUserDetails(newSession.user);
      setUser(userDetails);
    } else {
      setUser(null);
    }
    
    setIsLoading(false);
  }, [fetchUserDetails]);

  // State for showing expired link error
  const [linkExpiredError, setLinkExpiredError] = useState<string | null>(null);

  // Initialize auth state
  useEffect(() => {
    // Check URL hash BEFORE Supabase processes it
    const hash = window.location.hash;
    console.log('Initial URL hash:', hash);
    
    // Check for error in URL (expired link, etc)
    if (hash.includes('error=') || hash.includes('error_code=')) {
      const params = new URLSearchParams(hash.substring(1));
      const errorCode = params.get('error_code');
      const errorDesc = params.get('error_description');
      
      if (errorCode === 'otp_expired' || errorDesc?.includes('expired')) {
        setLinkExpiredError('This invite link has expired. Please ask your administrator to send a new invite.');
      } else {
        setLinkExpiredError(decodeURIComponent(errorDesc || errorCode || 'Authentication failed'));
      }
      
      // Clear the error from URL
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }
    
    if (hash.includes('type=recovery') || hash.includes('type=invite')) {
      console.log('Recovery/invite detected in URL - will show password form');
      setShowPasswordReset(true);
      // Store flag for security - user MUST set password
      sessionStorage.setItem(PASSWORD_RESET_FLAG, 'true');
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      handleSessionChange(initialSession);
      
      // Check if this user needs to change their password (temp password)
      if (initialSession?.user) {
        const metadata = initialSession.user.user_metadata;
        
        // Check if user must change password (set by invite system)
        const mustChangePassword = metadata?.must_change_password === true;
        
        console.log('User check:', { mustChangePassword, metadata });
        
        // Force password change for users with temp passwords
        if (mustChangePassword) {
          console.log('User must change password - showing modal');
          setShowPasswordReset(true);
        }
        
        // If there's a pending reset flag, force the modal
        if (sessionStorage.getItem(PASSWORD_RESET_FLAG) === 'true') {
          console.log('Pending password reset flag - showing modal');
          setShowPasswordReset(true);
        }
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth event:', event);
        
        // Handle password recovery event - show password reset form
        if (event === 'PASSWORD_RECOVERY') {
          console.log('PASSWORD_RECOVERY event - showing reset form');
          setShowPasswordReset(true);
          sessionStorage.setItem(PASSWORD_RESET_FLAG, 'true');
        }
        
        // Handle sign in - check if user needs to change password
        if (event === 'SIGNED_IN' && newSession?.user) {
          const mustChangePassword = newSession.user.user_metadata?.must_change_password === true;
          
          if (mustChangePassword) {
            console.log('User signed in with temp password - forcing password change');
            setShowPasswordReset(true);
          }
          
          // Also check session storage flag
          if (sessionStorage.getItem(PASSWORD_RESET_FLAG) === 'true') {
            setShowPasswordReset(true);
          }
        }
        
        handleSessionChange(newSession);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [handleSessionChange]);
  
  // Function to clear the expired link error
  const clearLinkExpiredError = () => setLinkExpiredError(null);

  // Sign in
  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    setError(null);
    setIsLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setIsLoading(false);
        return { error: signInError.message };
      }

      if (data.session) {
        await handleSessionChange(data.session);
      }

      return {};
    } catch (err: any) {
      const errorMessage = err?.message || 'Sign in failed';
      setError(errorMessage);
      setIsLoading(false);
      return { error: errorMessage };
    }
  };

  // Sign up
  const signUp = async (
    email: string,
    password: string,
    metadata?: Record<string, unknown>
  ): Promise<{ error?: string }> => {
    setError(null);
    setIsLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setIsLoading(false);
        return { error: signUpError.message };
      }

      // Note: User may need to verify email before session is created
      if (data.session) {
        await handleSessionChange(data.session);
      } else {
        setIsLoading(false);
      }

      return {};
    } catch (err: any) {
      const errorMessage = err?.message || 'Sign up failed';
      setError(errorMessage);
      setIsLoading(false);
      return { error: errorMessage };
    }
  };

  // Sign out
  const signOut = async (): Promise<void> => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsLoading(false);
  };

  // Refresh user details (e.g., after role change)
  const refreshUser = async (): Promise<void> => {
    if (session?.user) {
      const userDetails = await fetchUserDetails(session.user);
      setUser(userDetails);
    }
  };

  // Clear password reset state
  const clearPasswordReset = () => {
    setShowPasswordReset(false);
    // Clear the session storage flag
    sessionStorage.removeItem(PASSWORD_RESET_FLAG);
    // Clear any tokens from URL
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  // Update password (for recovery/invite flows)
  const updatePassword = async (newPassword: string): Promise<{ error?: string }> => {
    try {
      // Update password AND clear the must_change_password flag
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: {
          must_change_password: false, // Clear the temp password flag
          password_set: true,
          password_changed_at: new Date().toISOString(),
        }
      });

      if (updateError) {
        return { error: updateError.message };
      }

      setShowPasswordReset(false);
      // Clear the session storage flag
      sessionStorage.removeItem(PASSWORD_RESET_FLAG);
      sessionStorage.removeItem(AUTH_TYPE_KEY);
      // Clear tokens from URL
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      return {};
    } catch (err: any) {
      return { error: err?.message || 'Failed to update password' };
    }
  };

  // Computed role checks
  const role = user?.role;
  const isAuthenticated = !!user;
  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isPricingManager = role === 'pricing_manager';
  const isSales = role === 'sales';
  const isDistributor = user?.isDistributor || role === 'distributor';
  const isStaff = isAdmin || isPricingManager || isSales;
  const canManagePricing = isAdmin || isPricingManager;
  const isGodMode = isSuperAdmin; // Alias for clarity

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    error,
    showPasswordReset,
    linkExpiredError,
    isAuthenticated,
    isSuperAdmin,
    isAdmin,
    isPricingManager,
    isSales,
    isDistributor,
    isStaff,
    canManagePricing,
    isGodMode,
    signIn,
    signUp,
    signOut,
    refreshUser,
    clearPasswordReset,
    updatePassword,
    clearLinkExpiredError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook for using auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// HOC for protecting routes/components
interface WithAuthOptions {
  requiredRoles?: UserRole[];
  requireStaff?: boolean;
  requireAdmin?: boolean;
  fallback?: ReactNode;
}

export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: WithAuthOptions = {}
): React.FC<P> {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading, user, isStaff, isAdmin } = useAuth();

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
        </div>
      );
    }

    if (!isAuthenticated) {
      return options.fallback || (
        <div className="text-center p-8 text-zinc-400">
          Please sign in to access this content.
        </div>
      );
    }

    if (options.requireAdmin && !isAdmin) {
      return options.fallback || (
        <div className="text-center p-8 text-zinc-400">
          Admin access required.
        </div>
      );
    }

    if (options.requireStaff && !isStaff) {
      return options.fallback || (
        <div className="text-center p-8 text-zinc-400">
          Staff access required.
        </div>
      );
    }

    if (options.requiredRoles && options.requiredRoles.length > 0) {
      if (!user?.role || !options.requiredRoles.includes(user.role)) {
        return options.fallback || (
          <div className="text-center p-8 text-zinc-400">
            You don't have permission to access this content.
          </div>
        );
      }
    }

    return <Component {...props} />;
  };
}

export default AuthContext;
