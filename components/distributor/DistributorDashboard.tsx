import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useBrand } from '../../contexts/BrandContext';
import BrandLogo from '../BrandLogo';
import DistributorProfile from './DistributorProfile';
import DistributorQuotes from './DistributorQuotes';

interface DistributorDashboardProps {
  onExit: () => void; // Return to configurator
}

type View = 'quotes' | 'profile' | 'support';

const DistributorDashboard: React.FC<DistributorDashboardProps> = ({ onExit }) => {
  const { user, signOut } = useAuth();
  const { brand, theme } = useBrand();
  const [activeView, setActiveView] = useState<View>('quotes');
  const [distributor, setDistributor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const primaryColor = theme?.primaryColor || '#f59e0b';

  // Load distributor info
  useEffect(() => {
    const loadDistributor = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('distributors')
          .select('*, distributor_brand_access(brand_id, brands(name))')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        setDistributor(data);
      } catch (err) {
        console.error('Failed to load distributor:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDistributor();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
  };

  const navItems = [
    { id: 'quotes' as View, label: 'My Quotes', icon: '📋' },
    { id: 'profile' as View, label: 'My Account', icon: '👤' },
    { id: 'support' as View, label: 'Support', icon: '📞' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <BrandLogo className="h-8 mb-4" showText={true} />
          <div 
            className="text-xs font-mono px-2 py-1 rounded inline-block"
            style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
          >
            DISTRIBUTOR PORTAL
          </div>
          
          {/* Distributor Info */}
          {distributor && (
            <div className="mt-4 pt-4 border-t border-zinc-800">
              {distributor.logo_url && (
                <img 
                  src={distributor.logo_url} 
                  alt={distributor.company_name}
                  className="w-16 h-16 object-contain rounded mb-2"
                />
              )}
              <p className="text-sm font-medium text-white truncate">
                {distributor.company_name}
              </p>
              <p className="text-xs text-zinc-500 truncate">
                {distributor.account_number}
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                activeView === item.id
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
              }`}
              style={activeView === item.id ? { borderLeft: `3px solid ${primaryColor}` } : {}}
            >
              <span>{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 space-y-2">
          <button
            onClick={handleSignOut}
            className="w-full text-xs text-zinc-500 hover:text-white text-left p-2"
          >
            Sign Out
          </button>
          <button
            onClick={onExit}
            className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3 rounded border transition-all"
            style={{ 
              backgroundColor: `${primaryColor}10`,
              borderColor: `${primaryColor}50`,
              color: primaryColor
            }}
          >
            <span>←</span> Configure Products
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top Bar */}
        <div className="bg-zinc-900 border-b border-zinc-800 px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">
            {activeView === 'quotes' && 'My Quotes'}
            {activeView === 'profile' && 'My Account'}
            {activeView === 'support' && 'Support'}
          </h1>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400">
              {user?.email}
            </span>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-8">
          {activeView === 'quotes' && <DistributorQuotes distributorId={distributor?.id} />}
          {activeView === 'profile' && <DistributorProfile />}
          {activeView === 'support' && <SupportView brandName={brand?.name} />}
        </div>
      </main>
    </div>
  );
};

// Simple support view
const SupportView: React.FC<{ brandName?: string }> = ({ brandName }) => {
  return (
    <div className="max-w-2xl">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8">
        <h2 className="text-xl font-bold text-white mb-4">Need Help?</h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="font-medium text-white mb-2">Contact Support</h3>
            <p className="text-zinc-400 text-sm mb-3">
              For technical support or questions about your account, please contact us:
            </p>
            <div className="space-y-2 text-sm">
              <p className="text-zinc-300">
                <span className="text-zinc-500">Email:</span>{' '}
                <a href="mailto:support@opiegroup.com.au" className="text-amber-400 hover:underline">
                  support@opiegroup.com.au
                </a>
              </p>
              <p className="text-zinc-300">
                <span className="text-zinc-500">Phone:</span>{' '}
                <a href="tel:+61293700000" className="text-amber-400 hover:underline">
                  +61 2 9370 0000
                </a>
              </p>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-6">
            <h3 className="font-medium text-white mb-2">Product Information</h3>
            <p className="text-zinc-400 text-sm mb-3">
              For product specifications, pricing, or catalog requests:
            </p>
            <a 
              href={brandName === 'Lectrum' ? 'https://lectrum.com.au' : 'https://boscotek.com.au'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:underline text-sm"
            >
              Visit {brandName || 'our'} website →
            </a>
          </div>

          <div className="border-t border-zinc-800 pt-6">
            <h3 className="font-medium text-white mb-2">Distributor Resources</h3>
            <p className="text-zinc-400 text-sm">
              Access marketing materials, product sheets, and training resources in your distributor portal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DistributorDashboard;
