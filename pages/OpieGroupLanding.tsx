import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPublicBrands, PublicBrand } from '../services/brandService';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { BrandProvider } from '../contexts/BrandContext';
import { CatalogProvider } from '../contexts/CatalogContext';
import AdminDashboard from '../components/admin/AdminDashboard';

/**
 * OpieGroupLanding
 * 
 * The main OPIE Group brand selector landing page.
 * Shows all active brands with buttons to enter each brand's configurator.
 * Brands without products are shown as "Coming soon" with disabled buttons.
 */
const OpieGroupLandingContent: React.FC = () => {
  const [brands, setBrands] = useState<PublicBrand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  const { isAuthenticated, isAdmin, isStaff, user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadBrands = async () => {
      try {
        const publicBrands = await getPublicBrands();
        setBrands(publicBrands);
      } catch (err) {
        console.error('Failed to load brands:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadBrands();
  }, []);

  // Separate active and coming soon brands
  const activeBrands = brands.filter(b => b.status === 'active');
  const comingSoonBrands = brands.filter(b => b.status === 'draft');

  // Show admin panel if requested
  if (showAdminPanel) {
    return (
      <BrandProvider>
        <CatalogProvider>
          <AdminDashboard onExit={() => setShowAdminPanel(false)} />
        </CatalogProvider>
      </BrandProvider>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <OpieLogo />
          
          {/* Right Side - Auth Actions */}
          <div className="flex items-center gap-4">
            {isAuthenticated && user ? (
              <>
                {/* User Info */}
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <span className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-green-500' : isStaff ? 'bg-blue-500' : 'bg-zinc-500'}`} />
                  <span>{user.name}</span>
                  {user.role && (
                    <span className="text-xs text-zinc-500">({user.role})</span>
                  )}
                </div>
                
                {/* Admin/Staff Dashboard Button */}
                {(isAdmin || isStaff) && (
                  <button
                    onClick={() => setShowAdminPanel(true)}
                    className="px-4 py-2 text-sm font-medium bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors"
                  >
                    {isAdmin ? 'Admin' : 'Staff'} Dashboard
                  </button>
                )}
                
                {/* Sign Out */}
                <button
                  onClick={signOut}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              /* Sign In Button */
              <button
                onClick={() => setShowAdminPanel(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-white">
            Configure Your Perfect Product
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Select a brand below to start configuring products and receive an instant quote. 
            Our interactive configurators help you build exactly what you need.
          </p>
        </div>
      </section>

      {/* Brands Grid */}
      <section className="pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin h-10 w-10 border-2 border-amber-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {/* Active Brands */}
              {activeBrands.length > 0 && (
                <div className="mb-12">
                  <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-6">
                    Available Now
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeBrands.map((brand) => (
                      <BrandCard key={brand.slug} brand={brand} isActive />
                    ))}
                  </div>
                </div>
              )}

              {/* Coming Soon Brands */}
              {comingSoonBrands.length > 0 && (
                <div>
                  <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-6">
                    Coming Soon
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {comingSoonBrands.map((brand) => (
                      <BrandCard key={brand.slug} brand={brand} isActive={false} />
                    ))}
                  </div>
                </div>
              )}

              {brands.length === 0 && (
                <div className="text-center py-20 text-zinc-400">
                  <p>No brands available at the moment.</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <OpieLogo size="small" />
            <span className="text-sm text-zinc-500">
              © {new Date().getFullYear()} Opie Manufacturing Group
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <a href="https://opie.com.au" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              About OPIE
            </a>
            <a href="mailto:info@opie.com.au" className="hover:text-white transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

/**
 * BrandCard component
 */
interface BrandCardProps {
  brand: PublicBrand;
  isActive: boolean;
}

const BrandCard: React.FC<BrandCardProps> = ({ brand, isActive }) => {
  const primaryColor = brand.primaryColor || '#f59e0b';
  
  return (
    <div 
      className={`
        relative rounded-2xl border p-8 transition-all duration-200
        ${isActive 
          ? 'bg-zinc-900 border-zinc-700 hover:border-zinc-500 hover:shadow-xl hover:-translate-y-1' 
          : 'bg-zinc-900/50 border-zinc-800 opacity-75'
        }
      `}
    >
      {/* Coming Soon Badge */}
      {!isActive && (
        <div className="absolute top-4 right-4">
          <span className="text-xs font-medium px-2 py-1 rounded bg-zinc-700 text-zinc-300">
            Coming Soon
          </span>
        </div>
      )}

      {/* Brand Logo/Icon */}
      <div className="mb-6">
        {brand.logoUrl ? (
          <img 
            src={brand.logoUrl} 
            alt={brand.name} 
            className="h-12 w-auto object-contain"
          />
        ) : (
          <div 
            className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-2xl"
            style={{ backgroundColor: primaryColor }}
          >
            {brand.name.charAt(0)}
          </div>
        )}
      </div>

      {/* Brand Name */}
      <h3 className="text-xl font-bold text-white mb-2">
        {brand.name}
      </h3>

      {/* Description */}
      {brand.description && (
        <p className="text-sm text-zinc-400 mb-6 line-clamp-2">
          {brand.description}
        </p>
      )}

      {/* CTA Button */}
      {isActive ? (
        <Link
          to={`/${brand.slug}/`}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-black transition-all hover:brightness-110"
          style={{ backgroundColor: primaryColor }}
        >
          Open {brand.name} Configurator
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      ) : (
        <button
          disabled
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium bg-zinc-700 text-zinc-400 cursor-not-allowed"
        >
          Coming Soon
        </button>
      )}
    </div>
  );
};

/**
 * OPIE Logo component
 */
const OpieLogo: React.FC<{ size?: 'small' | 'large' }> = ({ size = 'large' }) => {
  const isSmall = size === 'small';
  
  return (
    <div className={`flex items-center gap-3 select-none ${isSmall ? 'gap-2' : ''}`}>
      {/* OPIE Icon */}
      <div 
        className={`
          rounded-lg flex items-center justify-center text-white font-bold
          ${isSmall ? 'w-8 h-8 text-sm' : 'w-12 h-12 text-xl'}
        `}
        style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
      >
        O
      </div>
      {/* OPIE Text */}
      <div className={isSmall ? 'text-lg' : 'text-2xl'}>
        <span className="font-bold text-white">OPIE</span>
        <span className="text-zinc-400 font-light ml-2">Group</span>
      </div>
    </div>
  );
};

/**
 * OpieGroupLanding - Wrapped with AuthProvider
 */
const OpieGroupLanding: React.FC = () => {
  return (
    <AuthProvider>
      <OpieGroupLandingContent />
    </AuthProvider>
  );
};

export default OpieGroupLanding;
