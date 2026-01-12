import React, { useEffect, ReactNode } from 'react';
import { useBrand } from '../contexts/BrandContext';

interface BrandThemeProviderProps {
  children: ReactNode;
}

/**
 * BrandThemeProvider
 * 
 * Injects CSS custom properties based on the current brand theme.
 * This allows dynamic theming without modifying Tailwind config.
 * 
 * Usage in CSS/Tailwind:
 * - Use `var(--brand-primary)` for primary color
 * - Use `var(--brand-accent)` for accent color
 * - Use `bg-[var(--brand-primary)]` in Tailwind classes
 */
const BrandThemeProvider: React.FC<BrandThemeProviderProps> = ({ children }) => {
  const { brand, theme } = useBrand();
  
  useEffect(() => {
    const root = document.documentElement;
    
    // Set CSS variables based on brand theme
    root.style.setProperty('--brand-primary', theme.primaryColor || '#f59e0b');
    root.style.setProperty('--brand-accent', theme.accentColor || '#292926');
    root.style.setProperty('--brand-font', theme.fontFamily || 'Inter, sans-serif');
    
    // Parse primary color to RGB for rgba() usage
    const primaryHex = theme.primaryColor || '#f59e0b';
    const primaryRgb = hexToRgb(primaryHex);
    if (primaryRgb) {
      root.style.setProperty('--brand-primary-rgb', `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`);
    }
    
    // Update page title and meta - ALWAYS update when brand changes
    if (brand?.name) {
      document.title = `${brand.name} Product Configurator`;
    } else {
      document.title = 'Product Configurator';
    }
    
    // Update meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      if (brand?.metaDescription) {
        metaDesc.setAttribute('content', brand.metaDescription);
      } else if (brand?.name) {
        metaDesc.setAttribute('content', `Configure ${brand.name} products and get instant quotes.`);
      }
    }
    
    // Apply brand-specific body classes
    document.body.classList.forEach(cls => {
      if (cls.startsWith('brand-')) {
        document.body.classList.remove(cls);
      }
    });
    if (brand) {
      document.body.classList.add(`brand-${brand.slug}`);
    }
    
  }, [brand, theme]);
  
  return <>{children}</>;
};

/**
 * Convert hex color to RGB object
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export default BrandThemeProvider;
