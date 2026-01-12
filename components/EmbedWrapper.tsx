import React, { ReactNode } from 'react';
import { useEmbedMode } from '../hooks/useEmbedMode';
import { useBrand } from '../contexts/BrandContext';

interface EmbedWrapperProps {
  children: ReactNode;
  /** Show the "Open in new tab" link in embed mode */
  showOpenLink?: boolean;
}

/**
 * EmbedWrapper
 * 
 * Wraps content to handle embed mode behaviour.
 * In embed mode:
 * - Hides global nav and footer
 * - Shows optional "Open in new tab" link
 * - Ensures responsive layout
 * - Prevents exposure of admin/sales routes
 */
const EmbedWrapper: React.FC<EmbedWrapperProps> = ({ 
  children, 
  showOpenLink = true 
}) => {
  const { isEmbedded, openInNewTab } = useEmbedMode();
  const { theme, brand } = useBrand();
  
  const primaryColor = theme.primaryColor || '#f59e0b';

  if (!isEmbedded) {
    // Normal mode - render children as-is
    return <>{children}</>;
  }

  // Embed mode - wrap with minimal chrome
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Embed Header Bar (minimal) */}
      {showOpenLink && (
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            {/* Brand indicator */}
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: primaryColor }}
            />
            <span className="text-xs text-zinc-400">
              {brand?.name || 'Product'} Configurator
            </span>
          </div>
          
          {/* Open in new tab link */}
          <button
            onClick={openInNewTab}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <span>Open in new tab</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>
      )}
      
      {/* Main Content */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
};

/**
 * useIsEmbedSafe
 * 
 * Hook to check if the current route is safe for embed mode.
 * Admin and sales routes should not be accessible in embed mode.
 */
export function useIsEmbedSafe(): boolean {
  const { isEmbedded } = useEmbedMode();
  
  if (!isEmbedded) return true;
  
  // Check current path
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  
  // Block admin and sales routes in embed mode
  const blockedPatterns = ['/admin', '/sales', '/dashboard', '/settings'];
  return !blockedPatterns.some(pattern => path.includes(pattern));
}

/**
 * EmbedBlocker
 * 
 * Component that blocks content in embed mode if accessing restricted routes.
 */
export const EmbedBlocker: React.FC<{ children: ReactNode }> = ({ children }) => {
  const isSafe = useIsEmbedSafe();
  const { isEmbedded, openInNewTab } = useEmbedMode();
  
  if (isEmbedded && !isSafe) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H9m3-4V8m0 0V6m0 2h2m-2 0H9" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-3">
            Restricted Access
          </h2>
          <p className="text-zinc-400 mb-6">
            This section is not available in embed mode. Please open the configurator in a new tab to access all features.
          </p>
          <button
            onClick={openInNewTab}
            className="px-6 py-3 bg-amber-500 text-black rounded-lg font-medium hover:bg-amber-400 transition-colors"
          >
            Open Full Configurator
          </button>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
};

export default EmbedWrapper;
