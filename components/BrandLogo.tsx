import React from 'react';
import { useBrand } from '../contexts/BrandContext';
import BoscotekLogo from './BoscotekLogo';

interface BrandLogoProps {
  className?: string;
  showText?: boolean;
}

/**
 * BrandLogo
 * 
 * Displays the appropriate logo based on the current brand context.
 * Falls back to BoscotekLogo for unrecognized brands or when logo is not available.
 */
const BrandLogo: React.FC<BrandLogoProps> = ({ className = "h-8", showText = true }) => {
  const { brand, brandSlug, theme, isLoading } = useBrand();
  
  // Show loading placeholder
  if (isLoading) {
    return (
      <div className={`animate-pulse bg-zinc-700 rounded ${className}`} style={{ width: showText ? '120px' : '32px' }} />
    );
  }
  
  // Use Boscotek SVG logo for Boscotek brand (built-in, no external image needed)
  if (brandSlug === 'boscotek' || brandSlug === 'bosco-office') {
    return <BoscotekLogo className={className} showText={showText} />;
  }
  
  // If brand has a custom logo URL or data URL, use an image
  const logoSrc = theme.logo || (brand as any)?.logoUrl;
  if (logoSrc && (logoSrc.startsWith('http') || logoSrc.startsWith('/') || logoSrc.startsWith('data:'))) {
    return (
      <div className={`select-none flex items-center ${className}`}>
        <img 
          src={logoSrc} 
          alt={`${brand?.name || 'Brand'} Logo`}
          className="h-full w-auto object-contain"
          onError={(e) => {
            // Hide broken image
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
    );
  }
  
  // For other brands without custom logos, show text-based logo
  const primaryColor = theme.primaryColor || '#f59e0b';
  return (
    <div className={`select-none flex items-center gap-3 ${className}`}>
      {/* Stylized icon placeholder */}
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xl"
        style={{ backgroundColor: primaryColor }}
      >
        {brand?.name?.charAt(0) || '?'}
      </div>
      {showText && (
        <span 
          className="text-2xl font-bold"
          style={{ color: primaryColor }}
        >
          {brand?.name || 'Brand'}
        </span>
      )}
    </div>
  );
};

/**
 * BrandName
 * 
 * Simple component that displays the current brand name
 */
export const BrandName: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { brand, isLoading } = useBrand();
  
  if (isLoading) {
    return <span className={`animate-pulse bg-zinc-700 rounded inline-block w-20 h-4 ${className}`} />;
  }
  
  return <span className={className}>{brand?.name || 'Boscotek'}</span>;
};

/**
 * BrandBadge
 * 
 * Displays brand name with colored indicator dot
 */
export const BrandBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { brand, theme, isLoading } = useBrand();
  
  if (isLoading) {
    return (
      <div className={`animate-pulse flex items-center gap-2 ${className}`}>
        <div className="w-3 h-3 rounded-full bg-zinc-700" />
        <div className="w-20 h-4 bg-zinc-700 rounded" />
      </div>
    );
  }
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div 
        className="w-3 h-3 rounded-full flex-shrink-0" 
        style={{ backgroundColor: theme.primaryColor || '#f59e0b' }}
      />
      <span className="text-sm font-medium">{brand?.name || 'Boscotek'}</span>
    </div>
  );
};

export default BrandLogo;
