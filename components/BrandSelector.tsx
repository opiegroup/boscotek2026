import React, { useState } from 'react';
import { useBrand } from '../contexts/BrandContext';

interface BrandSelectorProps {
  className?: string;
  buttonClassName?: string;
  label?: string;
}

/**
 * BrandSelector
 * 
 * A dropdown component for selecting and navigating to different brands.
 * Navigates via URL change (not just context switch) to ensure full page reload.
 */
const BrandSelector: React.FC<BrandSelectorProps> = ({ 
  className = '', 
  buttonClassName = '',
  label = 'Select Brand'
}) => {
  const { brand, availableBrands, theme } = useBrand();
  const [isOpen, setIsOpen] = useState(false);
  
  const handleSelectBrand = (slug: string) => {
    // Navigate to the brand's URL (this ensures proper page load)
    window.location.href = `/${slug}/`;
  };
  
  const primaryColor = theme.primaryColor || '#f59e0b';
  
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-6 py-3 bg-zinc-800 text-white rounded-lg 
          font-medium hover:bg-zinc-700 transition-colors
          ${buttonClassName}
        `}
      >
        <span>{label}</span>
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-2 w-64 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="p-3 border-b border-zinc-700 bg-zinc-900">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Opie Group Brands
              </span>
            </div>
            
            <div className="max-h-80 overflow-y-auto">
              {availableBrands.map((b) => {
                const isActive = b.slug === brand?.slug;
                const brandColor = b.themeJson?.primaryColor || '#f59e0b';
                
                return (
                  <button
                    key={b.id}
                    onClick={() => handleSelectBrand(b.slug)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-700 transition-colors text-left
                      ${isActive ? 'bg-zinc-700/50' : ''}
                    `}
                  >
                    <div 
                      className="w-4 h-4 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: brandColor }}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{b.name}</div>
                    </div>
                    {isActive && (
                      <span className="text-xs px-2 py-0.5 bg-zinc-600 rounded text-zinc-300">
                        Current
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            
            {availableBrands.length === 0 && (
              <div className="p-4 text-center text-zinc-400 text-sm">
                No brands available
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default BrandSelector;
