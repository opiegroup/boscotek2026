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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      // Fetch user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', supabaseUser.id)
        .order('role') // Get highest priority role
        .limit(1);

      if (roleError) {
        console.warn('Failed to fetch user role:', roleError);
      } else if (roleData && roleData.length > 0) {
        baseUser.role = roleData[0].role as UserRole;
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

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      handleSessionChange(initialSession);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        handleSessionChange(newSession);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [handleSessionChange]);

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
