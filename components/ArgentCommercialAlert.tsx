import React from 'react';
import { ConfigurationState, ProductDefinition } from '../types';
import { checkArgentCommercialRules, getArgentSeriesInfo } from '../services/products/argentCatalog';
import { 
  CABLE_ENTRY_ADVISORY, 
  SERIES_50_STANDARD_INCLUSIONS,
  getSeriesByKey,
  ArgentSeriesKey,
} from '../services/products/argentConstants';

/**
 * ArgentCommercialAlert
 * 
 * Displays commercial rule alerts for Argent products.
 * Shows appropriate messaging for:
 * - Quote required configurations
 * - Consult required configurations (SCEC Class B/C)
 * - Security-rated product notices
 * - SCEC cable entry compliance advisory
 * - Defence-grade positioning
 */
interface ArgentCommercialAlertProps {
  product: ProductDefinition;
  config: ConfigurationState;
  onRequestQuote?: () => void;
  onContactSales?: () => void;
}

export const ArgentCommercialAlert: React.FC<ArgentCommercialAlertProps> = ({
  product,
  config,
  onRequestQuote,
  onContactSales,
}) => {
  // Only applicable to Argent products
  if (!product.id.startsWith('argent-')) {
    return null;
  }
  
  const seriesInfo = getArgentSeriesInfo(product.id);
  const commercialResult = checkArgentCommercialRules(product.id, config.selections);
  
  // For standard buy-online configurations, don't show any alert
  if (commercialResult.canPurchaseOnline) {
    return null;
  }
  
  const isSecuritySeries = seriesInfo?.type === 'security_enclosure';
  const isConsultRequired = commercialResult.action === 'consult_required';
  const isQuoteRequired = commercialResult.action === 'quote_required';
  
  // Consult required (highest priority)
  if (isConsultRequired) {
    return (
      <div className="rounded-xl border border-amber-500/50 bg-amber-950/30 p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-amber-400 mb-1">Consultation Required</h4>
            <p className="text-sm text-slate-300 mb-3">
              {commercialResult.message || 'This configuration requires consultation with our team before ordering.'}
            </p>
            {isSecuritySeries && (
              <p className="text-xs text-slate-400 mb-3">
                Security-rated configurations may require verification of compliance requirements, 
                site assessment, or government approval documentation.
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={onContactSales}
                className="px-4 py-2 text-sm font-medium bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors"
              >
                Contact Sales Team
              </button>
              <a
                href="mailto:sales@argent.com.au?subject=Security Configuration Enquiry"
                className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
              >
                Email Directly
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Quote required
  if (isQuoteRequired) {
    return (
      <div className="rounded-xl border border-blue-500/50 bg-blue-950/30 p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-blue-400 mb-1">Quote Required</h4>
            <p className="text-sm text-slate-300 mb-3">
              {commercialResult.message || 'This configuration requires a formal quote.'}
            </p>
            {isSecuritySeries && (
              <div className="text-xs text-slate-400 mb-3 p-2 bg-slate-800/50 rounded">
                <strong>Note:</strong> Pricing shown is indicative only. Final pricing will be confirmed 
                based on security requirements, delivery location, and installation needs.
              </div>
            )}
            <button
              onClick={onRequestQuote}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
            >
              Request Quote
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return null;
};

/**
 * ArgentSecurityBadge
 * 
 * Small badge showing security classification for 50 Series products.
 * Now includes SCEC June 2016 certification and ISO 9001 accreditation.
 */
interface ArgentSecurityBadgeProps {
  product: ProductDefinition;
  config: ConfigurationState;
}

export const ArgentSecurityBadge: React.FC<ArgentSecurityBadgeProps> = ({ product, config }) => {
  if (!product.id.includes('50-series')) {
    return null;
  }
  
  const securityClass = config.selections['security-class'];
  const isClassC = securityClass === 'security-class-c';
  const isClassB = securityClass === 'security-class-b';
  
  if (!isClassB && !isClassC) {
    return null;
  }
  
  return (
    <div className="flex flex-wrap gap-2">
      {/* Security Class Badge */}
      <div className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        ${isClassC 
          ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
        }
      `}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        SCEC {isClassC ? 'Class C' : 'Class B'}
      </div>
      {/* SCEC Approved Badge */}
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        SCEC Approved June 2016
      </div>
      {/* ISO 9001 Badge */}
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        ISO 9001
      </div>
    </div>
  );
};

/**
 * ArgentCableEntryAdvisory
 * 
 * SCEC-critical cable entry compliance advisory for 50 Series.
 */
interface ArgentCableEntryAdvisoryProps {
  product: ProductDefinition;
}

export const ArgentCableEntryAdvisory: React.FC<ArgentCableEntryAdvisoryProps> = ({ product }) => {
  if (!product.id.includes('50-series')) {
    return null;
  }
  
  return (
    <div className="rounded-xl border border-red-500/50 bg-red-950/30 p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-red-400 mb-1 flex items-center gap-2">
            <span>SCEC Approved Cable Entry</span>
            <span className="text-[10px] bg-red-500/30 px-1.5 py-0.5 rounded">CRITICAL</span>
          </h4>
          <p className="text-sm text-slate-300 mb-2">
            {CABLE_ENTRY_ADVISORY.message}
          </p>
          <p className="text-xs text-slate-400">
            {CABLE_ENTRY_ADVISORY.recommendation}
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * ArgentStandardInclusions
 * 
 * Displays what is included as standard with 50 Series racks.
 */
interface ArgentStandardInclusionsProps {
  product: ProductDefinition;
}

export const ArgentStandardInclusions: React.FC<ArgentStandardInclusionsProps> = ({ product }) => {
  if (!product.id.includes('50-series')) {
    return null;
  }
  
  return (
    <div className="bg-slate-800/50 rounded-lg p-4 mb-4 border border-slate-700">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Standard Inclusions
      </h4>
      <div className="grid grid-cols-2 gap-2">
        {SERIES_50_STANDARD_INCLUSIONS.map((inclusion) => (
          <div key={inclusion.id} className="flex items-start gap-2 text-xs text-slate-300">
            <svg className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{inclusion.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * ArgentPositioningBanner
 * 
 * Defence-grade positioning banner for 50 Series.
 */
interface ArgentPositioningBannerProps {
  product: ProductDefinition;
}

export const ArgentPositioningBanner: React.FC<ArgentPositioningBannerProps> = ({ product }) => {
  if (!product.id.includes('50-series')) {
    return null;
  }
  
  const seriesKey = '50' as ArgentSeriesKey;
  const series = getSeriesByKey(seriesKey);
  
  if (!series) return null;
  
  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-lg p-4 mb-4 border border-slate-600">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-white tracking-wide">
            {series.positioning || 'Lock. Guard. Defend Data.'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Australian Design & Manufacturing by {series.manufacturer || 'Opie Manufacturing Group'}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="bg-slate-700/50 px-3 py-1.5 rounded text-[10px] font-medium text-slate-300 uppercase tracking-wider">
            AUST GOV
          </div>
          <div className="bg-slate-700/50 px-3 py-1.5 rounded text-[10px] font-medium text-slate-300 uppercase tracking-wider">
            DEFENCE
          </div>
          <div className="bg-slate-700/50 px-3 py-1.5 rounded text-[10px] font-medium text-slate-300 uppercase tracking-wider">
            SECURE
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * ArgentFeatureSummary
 * 
 * Shows key features for the selected Argent series.
 */
interface ArgentFeatureSummaryProps {
  product: ProductDefinition;
}

export const ArgentFeatureSummary: React.FC<ArgentFeatureSummaryProps> = ({ product }) => {
  const seriesInfo = getArgentSeriesInfo(product.id);
  
  if (!seriesInfo) {
    return null;
  }
  
  // Show first 4 features
  const displayFeatures = seriesInfo.features.slice(0, 4);
  
  return (
    <div className="bg-slate-800/50 rounded-lg p-3 mb-4 border border-slate-700">
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        {seriesInfo.shortName} Features
      </h4>
      <ul className="space-y-1">
        {displayFeatures.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
            <svg className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>
      {seriesInfo.features.length > 4 && (
        <p className="text-[10px] text-slate-500 mt-2">
          +{seriesInfo.features.length - 4} more features
        </p>
      )}
    </div>
  );
};

export default ArgentCommercialAlert;

// Re-export all components for easier imports
export {
  ArgentCableEntryAdvisory,
  ArgentStandardInclusions,
  ArgentPositioningBanner,
};
