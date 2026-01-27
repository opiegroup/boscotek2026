import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBrand } from '../contexts/BrandContext';
import { useAuth } from '../contexts/AuthContext';
import { useCatalog } from '../contexts/CatalogContext';
import BrandLogo from '../components/BrandLogo';
import { ARGENT_SERIES, ArgentSeries, ArgentSeriesKey } from '../services/products/argentConstants';

/**
 * ArgentLanding
 * 
 * Custom landing page for the Argent brand showing all product series
 * with security-first messaging appropriate for government/defence market.
 */
const ArgentLanding: React.FC = () => {
  const { brand, theme, brandSlug, isLoading: brandLoading } = useBrand();
  const { isAuthenticated, isAdmin, isStaff, signOut, user } = useAuth();
  const { products, isLoading: catalogLoading } = useCatalog();
  const navigate = useNavigate();
  
  const [hoveredSeries, setHoveredSeries] = useState<ArgentSeriesKey | null>(null);
  
  const primaryColor = theme.primaryColor || '#3b82f6';
  const accentColor = theme.accentColor || '#0f172a';
  
  // Get active series
  const activeSeries = ARGENT_SERIES.filter(s => s.isActive);
  
  if (brandLoading || catalogLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p>Loading Argent Configurator...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      className="min-h-screen flex flex-col text-white"
      style={{ backgroundColor: accentColor }}
    >
      {/* Header */}
      <header className="border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Back to OPIE */}
          <Link 
            to="/"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            OPIE Group
          </Link>
          
          {/* User Actions */}
          <div className="flex items-center gap-4">
            {isAuthenticated && user && (
              <div className="flex items-center gap-2 text-xs text-slate-400 bg-black/20 px-4 py-2 rounded-full backdrop-blur-sm">
                <span className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-green-500' : 'bg-slate-500'}`} />
                <span>{user.name}</span>
                <button onClick={signOut} className="ml-2 text-slate-500 hover:text-white">
                  Sign Out
                </button>
              </div>
            )}
            
            {(isAdmin || isStaff) && (
              <button 
                onClick={() => navigate(`/${brandSlug}/admin`)}
                className="text-xs text-slate-400 hover:text-white font-medium bg-black/20 px-4 py-2 rounded-full backdrop-blur-sm transition-colors"
              >
                {isAdmin ? 'Admin' : 'Staff'} Dashboard
              </button>
            )}
          </div>
        </div>
      </header>
      
      {/* Hero Section */}
      <section className="py-12 px-6 border-b border-slate-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            {/* Logo and Text */}
            <div className="flex-1 text-center lg:text-left">
              <div className="mb-6">
                <BrandLogo className="h-12 mx-auto lg:mx-0" showText={true} />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-4 text-white">
                Lock. Guard.<br />Defend Data.
              </h1>
              <p className="text-lg text-slate-400 max-w-xl mb-6">
                Australian-designed and manufactured SCEC-approved security server racks for defence, 
                government bodies, and secure data infrastructure. IEC 60297 compliant.
              </p>
              
              {/* Trust Indicators */}
              <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                <TrustBadge icon="shield" text="SCEC Approved June 2016" />
                <TrustBadge icon="flag" text="Australian Design & Manufacturing" />
                <TrustBadge icon="certificate" text="ISO 9001 Accredited" />
                <TrustBadge icon="clock" text="Opie Manufacturing Group - Est. 1962" />
              </div>
            </div>
            
            {/* Hero Image/Graphic */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                {/* Stylized rack representation */}
                <div className="aspect-[3/4] rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 p-6 shadow-2xl">
                  <div className="h-full rounded-xl bg-slate-950 border border-slate-800 p-4 flex flex-col gap-2">
                    {/* Simulated RU slots */}
                    {[...Array(8)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-6 rounded ${i % 3 === 0 ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-slate-800/50'}`}
                      />
                    ))}
                    <div className="flex-1" />
                    {/* Status lights */}
                    <div className="flex gap-2 justify-center">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <div className="w-2 h-2 rounded-full bg-slate-600" />
                    </div>
                  </div>
                </div>
                {/* Glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-blue-500/10 blur-3xl -z-10" />
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Product Series Grid */}
      <section className="py-16 px-6 flex-1">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-white mb-3">Select a Product Range</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Choose from our comprehensive range of server racks, network cabinets, 
              and secure enclosures. Each series is designed for specific infrastructure needs.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeSeries.map((series) => (
              <SeriesCard 
                key={series.key}
                series={series}
                primaryColor={primaryColor}
                brandSlug={brandSlug}
                isHovered={hoveredSeries === series.key}
                onHover={(hovered) => setHoveredSeries(hovered ? series.key : null)}
              />
            ))}
          </div>
        </div>
      </section>
      
      {/* Security Notice Banner */}
      <section className="py-8 px-6 border-t border-slate-800/50 bg-slate-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 p-6 rounded-xl bg-blue-950/30 border border-blue-900/30">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1">SCEC Class B & Class C Security Configurations</h3>
              <p className="text-sm text-slate-400 mb-2">
                SCEC-approved Class B (KABA X10 combination lock) and Class C (L-Handled Bilock) 
                configurations require consultation for compliance verification.
              </p>
              <p className="text-xs text-slate-500">
                Cable entry configuration is a key component of SCEC compliance. Contact Argent for approved cable entry options.
              </p>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <a 
                href="mailto:sales@argent.com.au?subject=SCEC Security Configuration Enquiry" 
                className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors text-center"
              >
                Contact Security Team
              </a>
              <a 
                href="tel:0247286111" 
                className="px-5 py-2.5 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-600 transition-colors text-center"
              >
                (02) 4728 6111
              </a>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-8" showText={false} />
            <div className="text-sm text-slate-500">
              <p>&copy; {new Date().getFullYear()} Opie Manufacturing Group. Australian Design &amp; Manufacturing.</p>
              <p className="text-xs text-slate-600">109 Russell Street, Emu Heights NSW 2750</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <a href="tel:0247286111" className="hover:text-white transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              (02) 4728 6111
            </a>
            <a href="mailto:sales@argent.com.au" className="hover:text-white transition-colors">
              sales@argent.com.au
            </a>
            <a href="https://argent.com.au" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              argent.com.au
            </a>
            <a href="https://opiegroup.com.au" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              opiegroup.com.au
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

/**
 * Trust Badge component
 */
interface TrustBadgeProps {
  icon: 'shield' | 'flag' | 'certificate' | 'clock';
  text: string;
}

const TrustBadge: React.FC<TrustBadgeProps> = ({ icon, text }) => {
  const icons = {
    shield: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    flag: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
      </svg>
    ),
    certificate: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    clock: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };
  
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 text-slate-300 text-xs font-medium">
      {icons[icon]}
      {text}
    </div>
  );
};

/**
 * Series Card component
 */
interface SeriesCardProps {
  series: ArgentSeries;
  primaryColor: string;
  brandSlug: string;
  isHovered: boolean;
  onHover: (hovered: boolean) => void;
}

const SeriesCard: React.FC<SeriesCardProps> = ({ 
  series, 
  primaryColor, 
  brandSlug,
  isHovered,
  onHover 
}) => {
  // Determine card styling based on series type
  const isSecuritySeries = series.type === 'security_enclosure';
  const isInRackSecurity = series.type === 'in_rack_security';
  
  const getSeriesIcon = () => {
    switch (series.type) {
      case 'security_enclosure':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        );
      case 'in_rack_security':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        );
      case 'open_frame':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
        );
    }
  };
  
  return (
    <div 
      className={`
        relative rounded-2xl border p-6 transition-all duration-300
        ${isHovered ? 'shadow-xl -translate-y-1 border-slate-600' : 'border-slate-700'}
        ${isSecuritySeries ? 'bg-gradient-to-br from-slate-900 to-blue-950/30' : 'bg-slate-900'}
      `}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {/* Security Badges */}
      {isSecuritySeries && (
        <div className="absolute top-4 right-4 flex flex-col gap-1">
          <span className="text-xs font-medium px-2 py-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
            SCEC Approved June 2016
          </span>
          <span className="text-xs font-medium px-2 py-1 rounded bg-green-500/20 text-green-400 border border-green-500/30">
            IEC 60297 | ISO 9001
          </span>
        </div>
      )}
      
      {/* Icon and Name */}
      <div className="flex items-start gap-4 mb-4">
        <div 
          className={`
            w-12 h-12 rounded-xl flex items-center justify-center
            ${isSecuritySeries ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-300'}
          `}
        >
          {getSeriesIcon()}
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">{series.name}</h3>
          <p className="text-sm text-slate-400">{series.useCase?.split(',')[0]}</p>
        </div>
      </div>
      
      {/* Description */}
      <p className="text-sm text-slate-400 mb-4 line-clamp-2">
        {series.description}
      </p>
      
      {/* Features */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-1.5">
          {series.features.slice(0, 4).map((feature, i) => (
            <span 
              key={i}
              className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400"
            >
              {feature}
            </span>
          ))}
          {series.features.length > 4 && (
            <span className="text-xs px-2 py-1 text-slate-500">
              +{series.features.length - 4} more
            </span>
          )}
        </div>
      </div>
      
      {/* CTA */}
      <Link
        to={`/${brandSlug}/configurator?product=argent-${series.key}-series`}
        className={`
          flex items-center justify-center gap-2 w-full py-3 rounded-lg font-medium transition-all
          ${isSecuritySeries 
            ? 'bg-blue-600 text-white hover:bg-blue-500' 
            : 'bg-slate-700 text-white hover:bg-slate-600'
          }
        `}
      >
        Configure {series.shortName}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
      
      {/* Quote notice for security */}
      {series.requiresConsultDefault && (
        <p className="mt-3 text-xs text-slate-500 text-center">
          Quote or consultation may be required
        </p>
      )}
    </div>
  );
};

export default ArgentLanding;
