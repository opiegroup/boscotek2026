import React, { useState } from 'react';
import { useBrand } from '../contexts/BrandContext';
import { Brand } from '../types';

interface BrandSwitcherProps {
  className?: string;
  showLabel?: boolean;
}

const BrandSwitcher: React.FC<BrandSwitcherProps> = ({ 
  className = '', 
  showLabel = true 
}) => {
  const { brand, brandSlug, availableBrands, switchBrand, isLoading } = useBrand();
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  
  // Don't show switcher if only one brand available
  if (availableBrands.length <= 1) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {brand && (
          <>
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: brand.themeJson.primaryColor || '#f59e0b' }}
            />
            <span className="text-sm font-medium text-white">{brand.name}</span>
          </>
        )}
      </div>
    );
  }
  
  const handleSwitch = async (selectedBrand: Brand) => {
    if (selectedBrand.slug === brandSlug) {
      setIsOpen(false);
      return;
    }
    
    setSwitching(true);
    const success = await switchBrand(selectedBrand.slug);
    setSwitching(false);
    
    if (success) {
      setIsOpen(false);
    }
  };
  
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading || switching}
        className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
      >
        {brand && (
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: brand.themeJson.primaryColor || '#f59e0b' }}
          />
        )}
        {showLabel && (
          <span className="text-sm font-medium text-white">
            {brand?.name || 'Select Brand'}
          </span>
        )}
        <svg 
          className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
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
            <div className="p-2 border-b border-zinc-700">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Switch Brand
              </span>
            </div>
            
            <div className="max-h-64 overflow-y-auto">
              {availableBrands.map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleSwitch(b)}
                  disabled={switching}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-700 transition-colors ${
                    b.slug === brandSlug ? 'bg-zinc-700/50' : ''
                  }`}
                >
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: b.themeJson.primaryColor || '#f59e0b' }}
                  />
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-white">{b.name}</div>
                    <div className="text-xs text-zinc-400">{b.slug}</div>
                  </div>
                  {b.slug === brandSlug && (
                    <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
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

export default BrandSwitcher;
