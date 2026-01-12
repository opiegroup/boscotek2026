import { useMemo } from 'react';

/**
 * useEmbedMode
 * 
 * Detects if the configurator is running in embed mode via ?embed=1 query param.
 * In embed mode:
 * - Global nav and footer are hidden
 * - Only configurator UI is shown
 * - A small "Open in new tab" link is available
 */
export function useEmbedMode() {
  const isEmbedded = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('embed') === '1';
  }, []);

  const openInNewTab = () => {
    // Remove embed param and open in new tab
    const url = new URL(window.location.href);
    url.searchParams.delete('embed');
    window.open(url.toString(), '_blank');
  };

  return {
    isEmbedded,
    openInNewTab,
  };
}

/**
 * Generate embed snippet URL for a brand
 */
export function generateEmbedSnippet(brandSlug: string, domain: string = 'configurator.opie.com.au'): string {
  const url = `https://${domain}/${brandSlug}/configurator?embed=1`;
  return `<iframe src="${url}" style="width:100%;height:900px;border:0;" loading="lazy" title="${brandSlug} Product Configurator"></iframe>`;
}

/**
 * Generate shareable URL for a brand configurator
 */
export function generateShareUrl(brandSlug: string, domain: string = 'configurator.opie.com.au'): string {
  return `https://${domain}/${brandSlug}/configurator`;
}
