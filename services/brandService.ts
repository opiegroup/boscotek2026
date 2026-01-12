import { supabase } from './supabaseClient';
import { Brand, BrandAccessLevel, UserBrandAccess } from '../types';

/**
 * Brand Service
 * 
 * Handles brand resolution, access checks, and brand data fetching.
 * Brand context is resolved from:
 * 1. Hostname (production): configurator.boscotek.com.au → boscotek
 * 2. Path prefix (development): localhost:3001/boscotek/... → boscotek
 * 3. Default fallback: boscotek (for backward compatibility)
 */

// Cache for brand data to avoid repeated DB calls
const brandCache = new Map<string, { brand: Brand; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fallback brand data - used when database is unavailable
 * This ensures the app works even before migrations are applied
 */
const FALLBACK_BRANDS: Brand[] = [
  {
    id: 'fallback-boscotek',
    name: 'Boscotek',
    slug: 'boscotek',
    code: 'BT',
    primaryDomain: 'configurator.boscotek.com.au',
    allowedDomains: [],
    status: 'active',
    themeJson: { primaryColor: '#f59e0b', accentColor: '#292926' },
    featuresJson: { enableBimExport: true, enableQuoteCart: true },
    contactEmail: null,
    supportEmail: null,
    phone: null,
    addressJson: null,
    metaTitle: 'Boscotek Configurator',
    metaDescription: 'Configure Boscotek industrial storage products',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'fallback-lectrum',
    name: 'Lectrum',
    slug: 'lectrum',
    code: 'LT',
    primaryDomain: 'configurator.lectrum.com.au',
    allowedDomains: [],
    status: 'active',
    themeJson: { primaryColor: '#10b981', accentColor: '#1f2937' },
    featuresJson: { enableBimExport: true, enableQuoteCart: true },
    contactEmail: null,
    supportEmail: null,
    phone: null,
    addressJson: null,
    metaTitle: 'Lectrum Configurator',
    metaDescription: 'Configure Lectrum products',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'fallback-gilkon',
    name: 'Gilkon',
    slug: 'gilkon',
    code: 'GK',
    primaryDomain: 'configurator.gilkon.com.au',
    allowedDomains: [],
    status: 'active',
    themeJson: { primaryColor: '#3b82f6', accentColor: '#1e3a5f' },
    featuresJson: { enableBimExport: true, enableQuoteCart: true },
    contactEmail: null,
    supportEmail: null,
    phone: null,
    addressJson: null,
    metaTitle: 'Gilkon Configurator',
    metaDescription: 'Configure Gilkon mounting solutions',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'fallback-argent',
    name: 'Argent',
    slug: 'argent',
    code: 'AR',
    primaryDomain: 'configurator.argent.com.au',
    allowedDomains: [],
    status: 'active',
    themeJson: { primaryColor: '#8b5cf6', accentColor: '#2e1065' },
    featuresJson: { enableBimExport: true, enableQuoteCart: true },
    contactEmail: null,
    supportEmail: null,
    phone: null,
    addressJson: null,
    metaTitle: 'Argent Configurator',
    metaDescription: 'Configure Argent products',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'fallback-bosco-office',
    name: 'Bosco Office',
    slug: 'bosco-office',
    code: 'BO',
    primaryDomain: 'configurator.boscooffice.com.au',
    allowedDomains: [],
    status: 'active',
    themeJson: { primaryColor: '#f59e0b', accentColor: '#292926' },
    featuresJson: { enableBimExport: true, enableQuoteCart: true },
    contactEmail: null,
    supportEmail: null,
    phone: null,
    addressJson: null,
    metaTitle: 'Bosco Office Configurator',
    metaDescription: 'Configure Bosco Office storage products',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Convert database row to Brand type (snake_case → camelCase)
 */
function mapBrandFromDb(row: any): Brand {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    code: row.code,
    primaryDomain: row.primary_domain,
    allowedDomains: row.allowed_domains || [],
    status: row.status,
    themeJson: row.theme_json || {},
    featuresJson: row.features_json || {},
    contactEmail: row.contact_email,
    supportEmail: row.support_email,
    phone: row.phone,
    addressJson: row.address_json,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Resolve brand slug from current URL/hostname
 */
export function resolveBrandSlugFromUrl(): string {
  // In development, check for path-based brand
  const pathname = window.location.pathname;
  const pathParts = pathname.split('/').filter(Boolean);
  
  // Check if first path segment is a brand slug
  const knownBrandSlugs = [
    'boscotek', 'bosco-office', 'lectrum', 'gilkon', 
    'argent', 'smc-stainless', 'bonwick', 'opie-infrastructure'
  ];
  
  if (pathParts.length > 0 && knownBrandSlugs.includes(pathParts[0])) {
    return pathParts[0];
  }
  
  // In production, resolve from hostname
  const hostname = window.location.hostname;
  
  // Check for subdomain pattern: configurator.boscotek.com.au
  const hostnameParts = hostname.split('.');
  if (hostnameParts.length >= 3) {
    // Check if second part is a brand
    const potentialBrand = hostnameParts[1];
    if (knownBrandSlugs.includes(potentialBrand)) {
      return potentialBrand;
    }
  }
  
  // Check for direct brand domain patterns
  for (const slug of knownBrandSlugs) {
    if (hostname.includes(slug)) {
      return slug;
    }
  }
  
  // Default to boscotek for backward compatibility
  return 'boscotek';
}

/**
 * Get fallback brand by slug (used when DB is unavailable)
 */
function getFallbackBrand(slug: string): Brand | null {
  return FALLBACK_BRANDS.find(b => b.slug === slug) || null;
}

/**
 * Fetch brand by slug
 */
export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  // Check cache first
  const cached = brandCache.get(slug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.brand;
  }
  
  try {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'active')
      .single();
    
    if (error || !data) {
      console.warn(`Brand not found in DB: ${slug}, using fallback`, error);
      // Use fallback brand data
      const fallback = getFallbackBrand(slug);
      if (fallback) {
        brandCache.set(slug, { brand: fallback, timestamp: Date.now() });
        return fallback;
      }
      return null;
    }
    
    const brand = mapBrandFromDb(data);
    
    // Update cache
    brandCache.set(slug, { brand, timestamp: Date.now() });
    
    return brand;
  } catch (err) {
    console.error('Error fetching brand:', err);
    // Use fallback on error
    const fallback = getFallbackBrand(slug);
    if (fallback) {
      brandCache.set(slug, { brand: fallback, timestamp: Date.now() });
      return fallback;
    }
    return null;
  }
}

/**
 * Fetch brand by domain
 */
export async function getBrandByDomain(domain: string): Promise<Brand | null> {
  try {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('status', 'active')
      .or(`primary_domain.eq.${domain},allowed_domains.cs.{${domain}}`)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return mapBrandFromDb(data);
  } catch (err) {
    console.error('Error fetching brand by domain:', err);
    return null;
  }
}

/**
 * Fetch all active brands
 */
export async function getAllBrands(): Promise<Brand[]> {
  try {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('status', 'active')
      .order('name');
    
    if (error || !data || data.length === 0) {
      console.warn('No brands in DB, using fallback brands:', error);
      // Return fallback brands
      return [...FALLBACK_BRANDS].sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return data.map(mapBrandFromDb);
  } catch (err) {
    console.error('Error fetching brands:', err);
    // Return fallback brands on error
    return [...FALLBACK_BRANDS].sort((a, b) => a.name.localeCompare(b.name));
  }
}

/**
 * Fetch brands accessible by current user
 */
export async function getUserBrands(): Promise<Brand[]> {
  try {
    const { data, error } = await supabase.rpc('get_user_brands');
    
    if (error || !data) {
      // Fallback: return all active brands for public users
      return getAllBrands();
    }
    
    return data.map(mapBrandFromDb);
  } catch (err) {
    console.error('Error fetching user brands:', err);
    return getAllBrands();
  }
}

/**
 * Check if current user has access to a specific brand
 */
export async function checkBrandAccess(
  brandId: string, 
  minLevel: BrandAccessLevel = 'viewer'
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('user_has_brand_access', {
      p_brand_id: brandId,
      p_min_level: minLevel,
    });
    
    if (error) {
      console.warn('Error checking brand access:', error);
      return false;
    }
    
    return data === true;
  } catch (err) {
    console.error('Error checking brand access:', err);
    return false;
  }
}

/**
 * Get user's access level for a specific brand
 */
export async function getUserBrandAccessLevel(brandId: string): Promise<BrandAccessLevel> {
  try {
    const { data, error } = await supabase.rpc('get_user_brand_access_level', {
      p_brand_id: brandId,
    });
    
    if (error || !data) {
      return 'none';
    }
    
    return data as BrandAccessLevel;
  } catch (err) {
    console.error('Error getting brand access level:', err);
    return 'none';
  }
}

/**
 * Get user's brand access records
 */
export async function getUserBrandAccessRecords(): Promise<UserBrandAccess[]> {
  try {
    const { data, error } = await supabase
      .from('user_brand_access')
      .select('*')
      .eq('is_active', true);
    
    if (error || !data) {
      return [];
    }
    
    return data.map(row => ({
      id: row.id,
      userId: row.user_id,
      brandId: row.brand_id,
      accessLevel: row.access_level,
      scopes: row.scopes || [],
      isActive: row.is_active,
      grantedAt: row.granted_at,
      grantedBy: row.granted_by,
    }));
  } catch (err) {
    console.error('Error fetching brand access records:', err);
    return [];
  }
}

/**
 * Clear brand cache (useful after admin changes)
 */
export function clearBrandCache(): void {
  brandCache.clear();
}

/**
 * Get default brand (Boscotek)
 */
export async function getDefaultBrand(): Promise<Brand | null> {
  return getBrandBySlug('boscotek');
}
