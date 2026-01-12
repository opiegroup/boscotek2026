import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Brand, BrandAccessLevel, BrandTheme, BrandFeatures } from '../types';
import { 
  resolveBrandSlugFromUrl, 
  getBrandBySlug, 
  getUserBrands,
  getUserBrandAccessLevel,
  clearBrandCache 
} from '../services/brandService';
import { useAuth } from './AuthContext';

interface BrandContextType {
  // Current brand state
  brand: Brand | null;
  brandSlug: string;
  isLoading: boolean;
  error: string | null;
  
  // Brand theme (convenience accessors)
  theme: BrandTheme;
  features: BrandFeatures;
  
  // User's access to current brand
  accessLevel: BrandAccessLevel;
  canEdit: boolean;        // sales, pricing, or admin
  canManage: boolean;      // pricing or admin
  isAdmin: boolean;        // admin only
  
  // Available brands for user
  availableBrands: Brand[];
  
  // Actions
  switchBrand: (slug: string) => Promise<boolean>;
  refreshBrand: () => Promise<void>;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

// Default theme for fallback
const DEFAULT_THEME: BrandTheme = {
  logo: '/brands/boscotek/logo.svg',
  primaryColor: '#f59e0b',
  accentColor: '#292926',
  fontFamily: 'Inter',
};

// Default features for fallback
const DEFAULT_FEATURES: BrandFeatures = {
  enableBimExport: true,
  enableQuoteCart: true,
  enableDistributorPricing: true,
  enableDrawerConfigurator: true,
};

interface BrandProviderProps {
  children: ReactNode;
}

export const BrandProvider: React.FC<BrandProviderProps> = ({ children }) => {
  const { isAuthenticated, isAdmin: isGlobalAdmin } = useAuth();
  
  // State
  const [brand, setBrand] = useState<Brand | null>(null);
  const [brandSlug, setBrandSlug] = useState<string>('boscotek');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessLevel, setAccessLevel] = useState<BrandAccessLevel>('viewer');
  const [availableBrands, setAvailableBrands] = useState<Brand[]>([]);
  
  // Load brand data
  const loadBrand = useCallback(async (slug: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const brandData = await getBrandBySlug(slug);
      
      if (!brandData) {
        // Try default brand as fallback
        const defaultBrand = await getBrandBySlug('boscotek');
        if (defaultBrand) {
          setBrand(defaultBrand);
          setBrandSlug('boscotek');
          console.warn(`Brand "${slug}" not found, falling back to boscotek`);
        } else {
          setError(`Brand "${slug}" not found`);
        }
      } else {
        setBrand(brandData);
        setBrandSlug(slug);
      }
      
      // Update access level if authenticated
      if (isAuthenticated && brandData) {
        const level = await getUserBrandAccessLevel(brandData.id);
        setAccessLevel(level);
      } else {
        setAccessLevel('viewer'); // Public access
      }
      
    } catch (err) {
      console.error('Error loading brand:', err);
      setError('Failed to load brand');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);
  
  // Load available brands for authenticated users
  const loadAvailableBrands = useCallback(async () => {
    if (isAuthenticated) {
      const brands = await getUserBrands();
      setAvailableBrands(brands);
    } else {
      // Public users see active brands
      const { getAllBrands } = await import('../services/brandService');
      const brands = await getAllBrands();
      setAvailableBrands(brands);
    }
  }, [isAuthenticated]);
  
  // Initial brand resolution
  useEffect(() => {
    const resolvedSlug = resolveBrandSlugFromUrl();
    setBrandSlug(resolvedSlug);
    loadBrand(resolvedSlug);
    loadAvailableBrands();
  }, [loadBrand, loadAvailableBrands]);
  
  // Reload access level when auth state changes
  useEffect(() => {
    if (brand) {
      if (isAuthenticated) {
        getUserBrandAccessLevel(brand.id).then(setAccessLevel);
      } else {
        setAccessLevel('viewer');
      }
      loadAvailableBrands();
    }
  }, [isAuthenticated, brand, loadAvailableBrands]);
  
  // Switch to a different brand
  const switchBrand = useCallback(async (slug: string): Promise<boolean> => {
    if (slug === brandSlug) return true;
    
    try {
      await loadBrand(slug);
      
      // Update URL if using path-based routing
      const currentPath = window.location.pathname;
      const pathParts = currentPath.split('/').filter(Boolean);
      
      // Check if current path starts with a brand slug
      const knownSlugs = availableBrands.map(b => b.slug);
      if (pathParts.length > 0 && knownSlugs.includes(pathParts[0])) {
        // Replace brand slug in path
        pathParts[0] = slug;
        const newPath = '/' + pathParts.join('/');
        window.history.pushState({}, '', newPath);
      }
      
      return true;
    } catch (err) {
      console.error('Error switching brand:', err);
      return false;
    }
  }, [brandSlug, loadBrand, availableBrands]);
  
  // Refresh current brand data
  const refreshBrand = useCallback(async () => {
    clearBrandCache();
    await loadBrand(brandSlug);
    await loadAvailableBrands();
  }, [brandSlug, loadBrand, loadAvailableBrands]);
  
  // Computed values
  const theme = brand?.themeJson || DEFAULT_THEME;
  const features = brand?.featuresJson || DEFAULT_FEATURES;
  
  // Global admins have full access regardless of brand-specific permissions
  const effectiveAccessLevel = isGlobalAdmin ? 'admin' : accessLevel;
  const canEdit = ['sales', 'pricing', 'admin'].includes(effectiveAccessLevel);
  const canManage = ['pricing', 'admin'].includes(effectiveAccessLevel);
  const isAdmin = effectiveAccessLevel === 'admin';
  
  const value: BrandContextType = {
    brand,
    brandSlug,
    isLoading,
    error,
    theme,
    features,
    accessLevel: effectiveAccessLevel as BrandAccessLevel,
    canEdit,
    canManage,
    isAdmin,
    availableBrands,
    switchBrand,
    refreshBrand,
  };
  
  return (
    <BrandContext.Provider value={value}>
      {children}
    </BrandContext.Provider>
  );
};

// Hook for using brand context
export const useBrand = (): BrandContextType => {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
};

// Hook for checking feature flags
export const useBrandFeature = (feature: keyof BrandFeatures): boolean => {
  const { features } = useBrand();
  return features[feature] ?? false;
};

// HOC for brand-protected components
interface WithBrandAccessOptions {
  minLevel?: BrandAccessLevel;
  fallback?: ReactNode;
}

export function withBrandAccess<P extends object>(
  Component: React.ComponentType<P>,
  options: WithBrandAccessOptions = {}
): React.FC<P> {
  const { minLevel = 'viewer', fallback } = options;
  
  return function BrandProtectedComponent(props: P) {
    const { accessLevel, isLoading } = useBrand();
    
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
        </div>
      );
    }
    
    const levelOrder: Record<BrandAccessLevel, number> = {
      none: 0,
      viewer: 1,
      sales: 2,
      pricing: 3,
      admin: 4,
    };
    
    if (levelOrder[accessLevel] < levelOrder[minLevel]) {
      return fallback || (
        <div className="text-center p-8 text-zinc-400">
          You don't have permission to access this brand feature.
        </div>
      );
    }
    
    return <Component {...props} />;
  };
}

export default BrandContext;
