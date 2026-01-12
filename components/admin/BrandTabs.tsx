import React from 'react';
import { useBrand } from '../../contexts/BrandContext';
import { Brand } from '../../types';

interface BrandTabsProps {
  className?: string;
}

/**
 * BrandTabs
 * 
 * Horizontal tabs for quick brand switching in the admin dashboard.
 * Shows all brands the user has access to with visual indicators.
 */
const BrandTabs: React.FC<BrandTabsProps> = ({ className = '' }) => {
  const { brand, brandSlug, availableBrands, switchBrand, isLoading } = useBrand();
  const [switching, setSwitching] = React.useState(false);
  
  const handleSwitch = async (selectedBrand: Brand) => {
    if (selectedBrand.slug === brandSlug || switching) return;
    
    setSwitching(true);
    await switchBrand(selectedBrand.slug);
    setSwitching(false);
  };
  
  if (isLoading) {
    return (
      <div className={`flex gap-1 ${className}`}>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 w-24 bg-zinc-800 rounded-t-lg animate-pulse" />
        ))}
      </div>
    );
  }
  
  // Don't show tabs if only one brand
  if (availableBrands.length <= 1) {
    return null;
  }
  
  return (
    <div className={`flex items-end gap-1 overflow-x-auto scrollbar-hide ${className}`}>
      {availableBrands.map((b) => {
        const isActive = b.slug === brandSlug;
        const primaryColor = b.themeJson?.primaryColor || '#f59e0b';
        
        return (
          <button
            key={b.id}
            onClick={() => handleSwitch(b)}
            disabled={switching}
            className={`
              relative flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium
              transition-all duration-200 whitespace-nowrap
              ${isActive 
                ? 'bg-zinc-900 text-white border-t-2 z-10' 
                : 'bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-800 border-t-2 border-transparent'
              }
              ${switching ? 'opacity-50 cursor-wait' : ''}
            `}
            style={{
              borderTopColor: isActive ? primaryColor : 'transparent',
            }}
          >
            {/* Brand Color Indicator */}
            <div 
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isActive ? '' : 'opacity-50'}`}
              style={{ backgroundColor: primaryColor }}
            />
            
            {/* Brand Name */}
            <span className="truncate max-w-[100px]">{b.name}</span>
            
            {/* Active Indicator */}
            {isActive && (
              <div 
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: primaryColor }}
              />
            )}
          </button>
        );
      })}
      
      {/* Overflow indicator */}
      {availableBrands.length > 6 && (
        <div className="px-2 py-2.5 text-zinc-500 text-xs">
          +{availableBrands.length - 6} more
        </div>
      )}
    </div>
  );
};

/**
 * BrandTabsCompact
 * 
 * More compact version for smaller spaces
 */
export const BrandTabsCompact: React.FC<BrandTabsProps> = ({ className = '' }) => {
  const { brand, brandSlug, availableBrands, switchBrand } = useBrand();
  const [switching, setSwitching] = React.useState(false);
  
  const handleSwitch = async (selectedBrand: Brand) => {
    if (selectedBrand.slug === brandSlug || switching) return;
    setSwitching(true);
    await switchBrand(selectedBrand.slug);
    setSwitching(false);
  };
  
  if (availableBrands.length <= 1) return null;
  
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {availableBrands.map((b) => {
        const isActive = b.slug === brandSlug;
        const primaryColor = b.themeJson?.primaryColor || '#f59e0b';
        
        return (
          <button
            key={b.id}
            onClick={() => handleSwitch(b)}
            disabled={switching}
            title={b.name}
            className={`
              w-8 h-8 rounded-lg flex items-center justify-center
              transition-all duration-200
              ${isActive 
                ? 'bg-zinc-700 ring-2 ring-offset-1 ring-offset-zinc-900' 
                : 'bg-zinc-800 hover:bg-zinc-700 opacity-50 hover:opacity-100'
              }
            `}
            style={{
              ringColor: isActive ? primaryColor : 'transparent',
            }}
          >
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: primaryColor }}
            />
          </button>
        );
      })}
    </div>
  );
};

export default BrandTabs;
