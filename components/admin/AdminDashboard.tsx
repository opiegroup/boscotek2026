import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useCatalog } from '../../contexts/CatalogContext';
import { useAuth } from '../../contexts/AuthContext';
import { login, checkSession, logout, updateBasePrice, updateOption, updateInteriorOption, getInteriors, getQuotes, updateQuoteStatus, updateQuoteSalesOrderNumber, updateQuoteItemOgNumber, seedDatabase } from '../../services/mockBackend';
import { ProductDefinition, DrawerInteriorOption, Quote, QuoteStatus } from '../../types';
import BrandLogo from '../BrandLogo';
import BrandSwitcher from '../BrandSwitcher';
import BrandTabs from './BrandTabs';
import { useBrand } from '../../contexts/BrandContext';
import BIMLeadsManager from './BIMLeadsManager';
import UserManagement from './UserManagement';
import CompanyManagement from './CompanyManagement';
import PricingTierManagement from './PricingTierManagement';
import CurrencyManagement from './CurrencyManagement';
import PricingCSV from './PricingCSV';
import BrandSettings from './BrandSettings';
import DistributorManagement from './DistributorManagement';
import CustomerManagement from './CustomerManagement';

// --- Helper Components for NetSuite Reference Fields ---

// Sales Order Number input with local state (saves on blur)
const SalesOrderInput: React.FC<{
  quoteId: string;
  initialValue: string;
  onSaved: (value: string) => void;
}> = ({ quoteId, initialValue, onSaved }) => {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue, quoteId]);
  
  const handleSave = async () => {
    if (value === initialValue) return;
    setSaving(true);
    setSaved(false);
    try {
      const success = await updateQuoteSalesOrderNumber(quoteId, value);
      if (success) {
        onSaved(value);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error('Failed to save sales order number:', err);
    }
    setSaving(false);
  };
  
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        placeholder="e.g. SO-12345"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur())}
        className="w-full max-w-xs bg-zinc-900 border border-zinc-700 text-white text-sm rounded px-3 py-2 focus:border-amber-500 outline-none font-mono"
      />
      {saving && <span className="text-xs text-amber-500">Saving...</span>}
      {saved && <span className="text-xs text-green-500">✓ Saved</span>}
    </div>
  );
};

// OG Number input with local state (saves on blur)
const OgNumberInput: React.FC<{
  quoteId: string;
  itemId: string;
  initialValue: string;
  onSaved: (value: string) => void;
}> = ({ quoteId, itemId, initialValue, onSaved }) => {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue, quoteId, itemId]);
  
  const handleSave = async () => {
    if (value === initialValue) return;
    setSaving(true);
    setSaved(false);
    try {
      const success = await updateQuoteItemOgNumber(quoteId, itemId, value);
      if (success) {
        onSaved(value);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error('Failed to save OG number:', err);
    }
    setSaving(false);
  };
  
  return (
    <div className="flex items-center gap-2 flex-1">
      <input
        type="text"
        placeholder="e.g. OG-12345"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur())}
        className="flex-1 max-w-[200px] bg-zinc-950 border border-zinc-700 text-white text-sm rounded px-2 py-1 focus:border-amber-500 outline-none font-mono"
      />
      {saving && <span className="text-xs text-amber-500">Saving...</span>}
      {saved && <span className="text-xs text-green-500">✓</span>}
    </div>
  );
};

// --- End Helper Components ---

interface AdminDashboardProps {
  onExit: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onExit }) => {
  const { products, refreshCatalog } = useCatalog();
  
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  
  // Data State
  const [interiors, setInteriors] = useState<DrawerInteriorOption[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);

  // View State: 0: Dashboard, 1: Pricing/Options, 6: Quotes, 7: BIM Leads, 8: Email Settings
  // New: 9: Users, 10: Distributors, 11: Pricing Tiers
  const [activeStep, setActiveStep] = useState<number>(0);
  
  // Get auth context for role checks
  const { isAdmin, canManagePricing, updatePassword, isStaff, isDistributor, user } = useAuth();
  
  // Get brand context
  const { brand, brandSlug } = useBrand(); 
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  
  // Email Settings State
  const [emailSettings, setEmailSettings] = useState({
    testMode: false,
    testEmail: '',
    sendToCustomer: true,
    sendToMarketing: true,
    sendToOpieGroupSales: true,
    sendToBoscotekSales: true
  });
  
  // Dashboard Stats
  const [dashboardStats, setDashboardStats] = useState({
    bimLeadsCount: 0,
    bimLeadsNew: 0,
    companiesCount: 0,
    companiesApproved: 0,
    usersCount: 0,
    quotesTotal: 0,
    quotesNew: 0,
    quotesValue: 0,
    quotesThisMonth: 0,
    quotesThisMonthValue: 0,
  });

  // Load dashboard stats - FILTERED BY CURRENT BRAND
  const loadDashboardStats = async () => {
    try {
      // For Boscotek: show ALL existing data (legacy data without brand_id)
      // For other brands: show nothing (they don't have data yet)
      const isBoscotek = brandSlug === 'boscotek';
      
      // BIM Leads - only show for Boscotek
      let bimLeadsQuery = supabase.from('bim_leads').select('id, status');
      const { data: bimLeads } = isBoscotek ? await bimLeadsQuery : { data: [] };
      const bimLeadsNew = bimLeads?.filter(l => l.status === 'new').length || 0;

      // Companies - only show for Boscotek
      let companiesQuery = supabase.from('companies').select('id, is_approved');
      const { data: companies } = isBoscotek ? await companiesQuery : { data: [] };
      const companiesApproved = companies?.filter(c => c.is_approved).length || 0;

      // Users - count all (users are not brand-specific)
      const { count: usersCount } = await supabase.from('user_roles').select('*', { count: 'exact', head: true });

      // Quotes (from local state - already filtered by brand in loadQuotes)
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);
      
      const quotesThisMonth = quotes.filter(q => new Date(q.createdAt) >= thisMonth);
      const quotesNew = quotes.filter(q => q.status === 'new');
      const quotesValue = quotes.reduce((sum, q) => sum + (q.totals?.total || 0), 0);
      const quotesThisMonthValue = quotesThisMonth.reduce((sum, q) => sum + (q.totals?.total || 0), 0);

      setDashboardStats({
        bimLeadsCount: bimLeads?.length || 0,
        bimLeadsNew,
        companiesCount: companies?.length || 0,
        companiesApproved,
        usersCount: usersCount || 0,
        quotesTotal: quotes.length,
        quotesNew: quotesNew.length,
        quotesValue,
        quotesThisMonth: quotesThisMonth.length,
        quotesThisMonthValue,
      });
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    }
  };
  
  // Load email settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('boscotek_email_settings');
    if (saved) {
      try {
        setEmailSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load email settings', e);
      }
    }
  }, []);
  
  // Save email settings
  const saveEmailSettings = (newSettings: typeof emailSettings) => {
    setEmailSettings(newSettings);
    localStorage.setItem('boscotek_email_settings', JSON.stringify(newSettings));
  };
  
  // --- LOAD DATA ---
  useEffect(() => {
    checkSession().then(user => {
      if (user) setIsAuthenticated(true);
      setAuthLoading(false);
    });
  }, []);

  // Reload data when brand changes
  useEffect(() => {
    if (isAuthenticated) {
      loadInteriors();
      loadQuotes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, activeStep, brandSlug]); 

  // Load dashboard stats when quotes change, brand changes, or when on dashboard
  useEffect(() => {
    if (isAuthenticated && activeStep === 0) {
      loadDashboardStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, quotes, activeStep, brandSlug]);

  const loadInteriors = async () => {
    // For Boscotek: load all interiors (legacy data)
    // For other brands: empty (no data yet)
    if (brandSlug === 'boscotek') {
      const data = await getInteriors();
      setInteriors(data);
    } else {
      setInteriors([]);
    }
  }

  const loadQuotes = async () => {
    // For Boscotek: load all quotes (legacy data)
    // For other brands: empty (no data yet)
    if (brandSlug === 'boscotek') {
      const data = await getQuotes();
      setQuotes(data);
    } else {
      setQuotes([]);
    }
  }

  // --- AUTH HANDLERS ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      setIsAuthenticated(true);
    } catch (err: any) {
      alert("Login failed: " + err.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    setIsAuthenticated(false);
  };

  // --- DB HANDLERS ---
  const handleSeed = async () => {
    if (window.confirm("Initialize Database? This will upload the standard catalog to Supabase. Existing matching IDs will be updated.")) {
      try {
        await seedDatabase();
        alert("Database seeded successfully. Refreshing catalog...");
        refreshCatalog();
      } catch (e) {
        alert("Seeding failed. Check console.");
      }
    }
  };

  // --- PRICING HANDLERS ---
  const handleBasePriceChange = async (prodId: string, newVal: number) => {
    await updateBasePrice(prodId, newVal);
    refreshCatalog(); // Refresh context
  };

  const handleOptionChange = async (prodId: string, groupId: string, optId: string, changes: any) => {
    await updateOption(prodId, groupId, optId, changes);
    refreshCatalog();
  };

  const handleInteriorChange = async (intId: string, changes: any) => {
    await updateInteriorOption(intId, changes);
    loadInteriors(); 
    refreshCatalog();
  }

  const handleStatusChange = async (quoteId: string, status: QuoteStatus) => {
     await updateQuoteStatus(quoteId, status);
     loadQuotes();
     if (selectedQuote && selectedQuote.id === quoteId) {
        setSelectedQuote({ ...selectedQuote, status });
     }
  };

  if (authLoading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">Checking session...</div>;

  // --- RENDER: ACCESS DENIED FOR DISTRIBUTORS ---
  // Distributors should use the Distributor Portal, not Admin Dashboard
  if (isAuthenticated && isDistributor && !isStaff) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-8 rounded-xl shadow-2xl text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-white mb-2">Access Restricted</h1>
          <p className="text-zinc-400 mb-6">
            As a distributor, please use the Distributor Portal to access your account.
          </p>
          <button
            onClick={onExit}
            className="w-full bg-blue-500 text-white font-bold py-3 rounded hover:bg-blue-400 transition-colors"
          >
            Go to Configurator
          </button>
          <p className="text-xs text-zinc-500 mt-4">
            Look for the "My Portal" button on the main page.
          </p>
        </div>
      </div>
    );
  }

  // --- RENDER: LOGIN ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-8 rounded-xl shadow-2xl">
          <div className="mb-8 flex justify-center">
            <BrandLogo className="h-10" />
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-1">EMAIL</label>
              <input 
                type="text" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                placeholder="email@boscotek.com"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-1">PASSWORD</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                placeholder="password"
              />
            </div>
            <button type="submit" className="w-full bg-amber-500 text-black font-bold p-3 rounded hover:bg-amber-400 transition-colors">
              Login
            </button>
            <button type="button" onClick={onExit} className="w-full text-zinc-500 text-sm p-2 hover:text-white">
              Back to Configurator
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Change Password Modal Component
  const ChangePasswordModal = () => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (newPassword.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      setSaving(true);
      const result = await updatePassword(newPassword);
      setSaving(false);

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setTimeout(() => setShowChangePassword(false), 1500);
      }
    };

    if (success) {
      return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowChangePassword(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-8 max-w-md w-full text-center">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-xl font-bold text-white">Password Changed!</h2>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowChangePassword(false)}>
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-8 max-w-md w-full" onClick={e => e.stopPropagation()}>
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">🔑</div>
            <h2 className="text-xl font-bold text-white">Change Password</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-3 rounded text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">NEW PASSWORD</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                required
                minLength={8}
                autoFocus
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">CONFIRM PASSWORD</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowChangePassword(false)}
                className="flex-1 bg-zinc-700 text-white font-bold py-3 rounded hover:bg-zinc-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-amber-500 text-black font-bold py-3 rounded hover:bg-amber-400 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      {/* Change Password Modal */}
      {showChangePassword && <ChangePasswordModal />}
      
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col z-20">
        <div className="p-6 border-b border-zinc-800 flex flex-col items-start gap-3">
          <BrandLogo className="h-6" showText={true} />
          <div className="flex items-center gap-2 w-full">
            <div className="text-xs font-mono text-zinc-500 bg-zinc-950 px-2 py-1 rounded">ADMIN ACCESS</div>
          </div>
          {/* Brand Switcher */}
          <div className="w-full pt-2 border-t border-zinc-800 mt-2">
            <BrandSwitcher showLabel={true} className="w-full" />
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <button onClick={() => setActiveStep(0)} className={`w-full text-left p-3 rounded text-sm font-medium transition-colors ${activeStep === 0 ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>Dashboard</button>
          
          {/* Sales Section */}
          <div className="pt-4 pb-2">
            <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider px-3">Sales</div>
          </div>
          <button onClick={() => setActiveStep(6)} className={`w-full text-left p-3 rounded text-sm font-medium transition-colors ${activeStep === 6 ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>Quotes / Orders</button>
          <button onClick={() => setActiveStep(7)} className={`w-full text-left p-3 rounded text-sm font-medium transition-colors ${activeStep === 7 ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'}`}>🔥 BIM Leads</button>
          <button onClick={() => setActiveStep(10)} className={`w-full text-left p-3 rounded text-sm font-medium transition-colors ${activeStep === 10 ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>🏢 Companies</button>
          <button onClick={() => setActiveStep(15)} className={`w-full text-left p-3 rounded text-sm font-medium transition-colors ${activeStep === 15 ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>👥 Customers</button>
          
          {/* Catalogue Section */}
          <div className="pt-4 pb-2">
            <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider px-3">Catalogue</div>
          </div>
          <button onClick={() => setActiveStep(1)} className={`w-full text-left p-3 rounded text-sm font-medium transition-colors ${activeStep === 1 ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>Products & Options</button>
          <button onClick={() => setActiveStep(11)} className={`w-full text-left p-3 rounded text-sm font-medium transition-colors ${activeStep === 11 ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>💰 Pricing Tiers</button>
          <button onClick={() => setActiveStep(12)} className={`w-full text-left p-3 rounded text-sm font-medium transition-colors ${activeStep === 12 ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>💱 Currencies</button>
          <button onClick={() => setActiveStep(13)} className={`w-full text-left p-3 rounded text-sm font-medium transition-colors ${activeStep === 13 ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>📊 Pricing CSV</button>
          
          {/* Admin Section - Only show for admins */}
          {isAdmin && (
            <>
              <div className="pt-4 pb-2">
                <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider px-3">Admin</div>
              </div>
              <button onClick={() => setActiveStep(14)} className={`w-full text-left p-3 rounded text-sm font-medium transition-colors ${activeStep === 14 ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>⚙️ Brand Settings</button>
              <button onClick={() => setActiveStep(9)} className={`w-full text-left p-3 rounded text-sm font-medium transition-colors ${activeStep === 9 ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>🔐 Users & Roles</button>
              <button onClick={() => setActiveStep(8)} className={`w-full text-left p-3 rounded text-sm font-medium transition-colors ${activeStep === 8 ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>📧 Email Settings</button>
            </>
          )}
        </nav>
        <div className="p-4 border-t border-zinc-800 space-y-2">
           <div className="flex gap-2">
             <button onClick={handleLogout} className="flex-1 text-xs text-zinc-500 hover:text-white text-left p-2">Sign Out</button>
             <button onClick={() => setShowChangePassword(true)} className="text-xs text-zinc-500 hover:text-amber-400 p-2" title="Change Password">🔑</button>
           </div>
           <button onClick={onExit} className="w-full flex items-center justify-center gap-2 bg-zinc-800 text-zinc-300 py-3 rounded hover:bg-zinc-700 hover:text-white transition-all text-sm font-bold border border-zinc-700 hover:border-amber-500/50">
              <span>←</span> Exit to Configurator
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Brand Tabs - Fixed at top */}
        <div className="bg-zinc-950 border-b border-zinc-800 px-8 pt-4">
          <BrandTabs />
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 p-8 overflow-y-auto">
        
        {/* DASHBOARD */}
        {activeStep === 0 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
               <div>
                 <h1 className="text-3xl font-bold">Dashboard</h1>
                 <p className="text-zinc-500 text-sm">
                   Overview of your {brand?.name || 'Boscotek'} configurator
                 </p>
               </div>
               <div className="flex gap-2">
                  <button 
                    onClick={loadDashboardStats}
                    className="bg-zinc-800 border border-zinc-700 text-zinc-300 px-4 py-2 rounded text-sm hover:bg-zinc-700"
                  >
                    Refresh
                  </button>
                  <button onClick={handleSeed} className="bg-blue-900/30 border border-blue-500/50 text-blue-300 px-4 py-2 rounded text-sm hover:bg-blue-900/50">
                     Initialize DB
                  </button>
               </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-4 gap-4">
              {/* BIM Leads */}
              <button 
                onClick={() => setActiveStep(7)}
                className="bg-gradient-to-br from-amber-900/30 to-amber-950/50 border border-amber-500/30 p-5 rounded-lg text-left hover:border-amber-500/50 transition-colors group"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="text-2xl">🔥</span>
                  {dashboardStats.bimLeadsNew > 0 && (
                    <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                      {dashboardStats.bimLeadsNew} NEW
                    </span>
                  )}
                </div>
                <div className="text-3xl font-bold text-amber-500 mb-1">{dashboardStats.bimLeadsCount}</div>
                <div className="text-zinc-500 text-xs font-mono uppercase">BIM Leads</div>
              </button>

              {/* Companies */}
              <button 
                onClick={() => setActiveStep(10)}
                className="bg-gradient-to-br from-green-900/30 to-green-950/50 border border-green-500/30 p-5 rounded-lg text-left hover:border-green-500/50 transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="text-2xl">🏢</span>
                  <span className="text-xs text-green-400">{dashboardStats.companiesApproved} approved</span>
                </div>
                <div className="text-3xl font-bold text-green-400 mb-1">{dashboardStats.companiesCount}</div>
                <div className="text-zinc-500 text-xs font-mono uppercase">Companies</div>
              </button>

              {/* Users */}
              <button 
                onClick={() => setActiveStep(9)}
                className="bg-gradient-to-br from-blue-900/30 to-blue-950/50 border border-blue-500/30 p-5 rounded-lg text-left hover:border-blue-500/50 transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="text-2xl">👤</span>
                </div>
                <div className="text-3xl font-bold text-blue-400 mb-1">{dashboardStats.usersCount}</div>
                <div className="text-zinc-500 text-xs font-mono uppercase">Users with Roles</div>
              </button>

              {/* Products */}
              <button 
                onClick={() => setActiveStep(1)}
                className="bg-gradient-to-br from-purple-900/30 to-purple-950/50 border border-purple-500/30 p-5 rounded-lg text-left hover:border-purple-500/50 transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="text-2xl">📦</span>
                  <span className="text-xs text-purple-400">{interiors.length} interiors</span>
                </div>
                <div className="text-3xl font-bold text-purple-400 mb-1">{products.length}</div>
                <div className="text-zinc-500 text-xs font-mono uppercase">Products</div>
              </button>
            </div>

            {/* Quote Stats */}
            <div className="grid grid-cols-2 gap-6">
              {/* Quotes Overview */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-white">Quote Activity</h3>
                  <button 
                    onClick={() => setActiveStep(6)}
                    className="text-xs text-amber-500 hover:underline"
                  >
                    View All →
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <div className="text-zinc-500 text-xs font-mono mb-1">TOTAL QUOTES</div>
                    <div className="text-2xl font-bold text-white">{dashboardStats.quotesTotal}</div>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <div className="text-zinc-500 text-xs font-mono mb-1">NEW (UNREAD)</div>
                    <div className="text-2xl font-bold text-green-400">{dashboardStats.quotesNew}</div>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <div className="text-zinc-500 text-xs font-mono mb-1">THIS MONTH</div>
                    <div className="text-2xl font-bold text-white">{dashboardStats.quotesThisMonth}</div>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <div className="text-zinc-500 text-xs font-mono mb-1">THIS MONTH VALUE</div>
                    <div className="text-2xl font-bold text-amber-500">
                      ${dashboardStats.quotesThisMonthValue.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Value */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <h3 className="font-bold text-white mb-4">Quote Values</h3>
                
                <div className="flex flex-col justify-center h-[calc(100%-2rem)]">
                  <div className="text-zinc-500 text-xs font-mono mb-2">TOTAL VALUE (ALL TIME)</div>
                  <div className="text-4xl font-bold text-amber-500 mb-4">
                    ${dashboardStats.quotesValue.toLocaleString()}
                  </div>
                  
                  {dashboardStats.quotesTotal > 0 && (
                    <div className="text-sm text-zinc-400">
                      Average quote: <span className="text-white font-bold">
                        ${Math.round(dashboardStats.quotesValue / dashboardStats.quotesTotal).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Quotes Preview */}
            {quotes.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-700 flex justify-between items-center">
                  <h3 className="font-bold text-white">Recent Quotes</h3>
                  <button 
                    onClick={() => setActiveStep(6)}
                    className="text-xs text-amber-500 hover:underline"
                  >
                    View All →
                  </button>
                </div>
                <table className="w-full">
                  <thead className="bg-zinc-950 text-xs text-zinc-500 uppercase">
                    <tr>
                      <th className="text-left px-6 py-3">Reference</th>
                      <th className="text-left px-6 py-3">Customer</th>
                      <th className="text-left px-6 py-3">Product</th>
                      <th className="text-left px-6 py-3">Value</th>
                      <th className="text-left px-6 py-3">Status</th>
                      <th className="text-left px-6 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {quotes.slice(0, 5).map(q => (
                      <tr 
                        key={q.id} 
                        onClick={() => { setSelectedQuote(q); setActiveStep(6); }}
                        className="hover:bg-zinc-800/50 cursor-pointer"
                      >
                        <td className="px-6 py-3">
                          <span className="font-mono text-amber-500">{q.reference}</span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="font-medium text-white">{q.customer.name}</div>
                          <div className="text-xs text-zinc-500">{q.customer.email}</div>
                        </td>
                        <td className="px-6 py-3 text-zinc-300">
                          {q.configuration?.productName || 'N/A'}
                        </td>
                        <td className="px-6 py-3">
                          <span className="font-bold text-white">
                            ${q.totals?.total?.toLocaleString() || '0'}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`text-xs uppercase font-bold px-2 py-0.5 rounded ${
                            q.status === 'new' ? 'bg-green-900/50 text-green-400' : 
                            q.status === 'quoted' ? 'bg-blue-900/50 text-blue-400' :
                            q.status === 'won' ? 'bg-amber-900/50 text-amber-400' :
                            'bg-zinc-700 text-zinc-400'
                          }`}>
                            {q.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-zinc-400 text-sm">
                          {new Date(q.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* QUOTES MANAGEMENT */}
        {activeStep === 6 && (
           <div className="h-full flex gap-6">
              {/* Quotes List */}
              <div className={`flex-1 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col ${selectedQuote ? 'hidden md:flex md:w-1/3 md:flex-none' : 'w-full'}`}>
                 <div className="p-4 border-b border-zinc-800 bg-zinc-900">
                    <h2 className="text-lg font-bold">Inbox ({quotes.length})</h2>
                 </div>
                 <div className="flex-1 overflow-y-auto">
                    {quotes.map(q => (
                       <button 
                          key={q.id}
                          onClick={() => setSelectedQuote(q)}
                          className={`w-full text-left p-4 border-b border-zinc-800 hover:bg-zinc-800 transition-colors ${selectedQuote?.id === q.id ? 'bg-zinc-800 border-l-4 border-l-amber-500' : ''}`}
                       >
                          <div className="flex justify-between items-start mb-1">
                             <span className="font-bold text-white">{q.customer.name}</span>
                             <span className="text-xs text-zinc-500">{new Date(q.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="text-xs font-mono text-amber-500 mb-1">{q.reference}</div>
                          <div className="flex justify-between items-center mt-2">
                             <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${q.status === 'new' ? 'bg-green-900 text-green-300' : 'bg-zinc-700 text-zinc-400'}`}>
                                {q.status.replace('_', ' ')}
                             </span>
                             <span className="font-bold text-sm">${q.totals.total.toLocaleString()}</span>
                          </div>
                       </button>
                    ))}
                 </div>
              </div>

              {/* Quote Detail */}
              {selectedQuote ? (
                 <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-zinc-800 flex justify-between items-start">
                       <div>
                          <h1 className="text-2xl font-bold mb-1">{selectedQuote.reference}</h1>
                          <div className="text-xs text-zinc-500 mb-2">
                             Submitted: {new Date(selectedQuote.createdAt).toLocaleString()}
                          </div>
                       </div>
                       <div className="text-right">
                          <select 
                             className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded p-2 focus:border-amber-500 outline-none"
                             value={selectedQuote.status}
                             onChange={(e) => handleStatusChange(selectedQuote.id, e.target.value as QuoteStatus)}
                          >
                             <option value="new">New Request</option>
                             <option value="viewed">Viewed</option>
                             <option value="contacted">Contacted</option>
                             <option value="sent_to_customer">Sent to Customer</option>
                             <option value="accepted">Accepted</option>
                             <option value="lost">Lost</option>
                             <option value="archived">Archived</option>
                          </select>
                       </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                       {/* Customer Details Section */}
                       <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
                          <div className="bg-zinc-800 px-4 py-2 border-b border-zinc-700">
                             <h3 className="font-bold uppercase text-zinc-400 text-xs">Customer Details</h3>
                          </div>
                          <div className="p-4 grid grid-cols-2 gap-4">
                             <div>
                                <div className="text-[10px] text-zinc-500 uppercase font-mono mb-1">Full Name</div>
                                <div className="text-white font-bold">{selectedQuote.customer.name}</div>
                             </div>
                             <div>
                                <div className="text-[10px] text-zinc-500 uppercase font-mono mb-1">Email Address</div>
                                <div className="text-white">
                                   <a href={`mailto:${selectedQuote.customer.email}`} className="text-amber-500 hover:underline">
                                      {selectedQuote.customer.email}
                                   </a>
                                </div>
                             </div>
                             <div>
                                <div className="text-[10px] text-zinc-500 uppercase font-mono mb-1">Company</div>
                                <div className="text-white">{selectedQuote.customer.company || <span className="text-zinc-600 italic">Not provided</span>}</div>
                             </div>
                             <div>
                                <div className="text-[10px] text-zinc-500 uppercase font-mono mb-1">Phone</div>
                                <div className="text-white">
                                   {selectedQuote.customer.phone ? (
                                      <a href={`tel:${selectedQuote.customer.phone}`} className="text-amber-500 hover:underline">
                                         {selectedQuote.customer.phone}
                                      </a>
                                   ) : (
                                      <span className="text-zinc-600 italic">Not provided</span>
                                   )}
                                </div>
                             </div>
                          </div>
                          {selectedQuote.customer.notes && (
                             <div className="px-4 pb-4">
                                <div className="text-[10px] text-zinc-500 uppercase font-mono mb-1">Notes / Special Requirements</div>
                                <div className="bg-amber-900/10 border border-amber-900/30 p-3 rounded text-sm text-amber-200">
                                   {selectedQuote.customer.notes}
                                </div>
                          </div>
                       )}
                       </div>

                       {/* NetSuite Reference Section */}
                       <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
                          <div className="bg-zinc-800 px-4 py-2 border-b border-zinc-700">
                             <h3 className="font-bold uppercase text-zinc-400 text-xs">NetSuite Reference</h3>
                          </div>
                          <div className="p-4">
                             <div>
                                <label className="text-[10px] text-zinc-500 uppercase font-mono mb-1 block">Sales Order Number</label>
                                <SalesOrderInput 
                                   quoteId={selectedQuote.id}
                                   initialValue={selectedQuote.salesOrderNumber || ''}
                                   onSaved={(newValue) => {
                                      // Update selectedQuote
                                      setSelectedQuote({ ...selectedQuote, salesOrderNumber: newValue });
                                      // Also update quotes array so it persists when switching quotes
                                      setQuotes(quotes.map(q => 
                                         q.id === selectedQuote.id ? { ...q, salesOrderNumber: newValue } : q
                                      ));
                                   }}
                                />
                                <p className="text-[10px] text-zinc-600 mt-1">Links this quote to NetSuite production system</p>
                             </div>
                          </div>
                       </div>

                       {/* Line Items with Full Detail */}
                       <div>
                          <h3 className="font-bold uppercase text-zinc-500 text-xs mb-3">Products ({selectedQuote.items.length})</h3>
                          <div className="space-y-4">
                             {selectedQuote.items.map((item, idx) => (
                                <div key={idx} className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
                                   {/* Product Header */}
                                   <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between items-start">
                                   <div className="flex-1">
                                         <h4 className="font-bold text-white text-lg">{item.productName}</h4>
                                         <div className="text-xs text-zinc-400 mt-1">Qty: {item.quantity}</div>
                                      </div>
                                      <div className="text-right">
                                         <div className="text-amber-500 font-bold text-xl font-mono">${item.totalPrice.toLocaleString()}</div>
                                         {item.quantity > 1 && (
                                            <div className="text-xs text-zinc-500">${item.unitPrice.toLocaleString()} each</div>
                                         )}
                                      </div>
                                   </div>
                                   
                                   {/* OG Number - NetSuite Reference */}
                                   <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/30">
                                      <div className="flex items-center gap-3">
                                         <label className="text-[10px] text-zinc-500 uppercase font-mono whitespace-nowrap">OG Number</label>
                                         <OgNumberInput
                                            quoteId={selectedQuote.id}
                                            itemId={item.id}
                                            initialValue={item.ogNumber || ''}
                                            onSaved={(newValue) => {
                                               const updatedItems = selectedQuote.items.map(i => 
                                                  i.id === item.id ? { ...i, ogNumber: newValue } : i
                                               );
                                               const updatedQuote = { ...selectedQuote, items: updatedItems };
                                               setSelectedQuote(updatedQuote);
                                               // Also update quotes array so it persists when switching quotes
                                               setQuotes(quotes.map(q => 
                                                  q.id === selectedQuote.id ? updatedQuote : q
                                               ));
                                            }}
                                         />
                                      </div>
                                   </div>
                                   
                                   {/* Configuration Code */}
                                   {item.configurationCode && (
                                      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
                                         <div className="text-[10px] text-zinc-500 uppercase font-mono mb-1">Configuration Code</div>
                                         <div className="font-mono text-amber-500 text-sm break-all leading-relaxed bg-zinc-950 p-2 rounded border border-zinc-800">
                                            {item.configurationCode}
                                         </div>
                                      </div>
                                   )}

                                   {/* Specs Summary */}
                                   {item.specsSummary && item.specsSummary.length > 0 && (
                                      <div className="px-4 py-3 border-b border-zinc-800">
                                         <div className="text-[10px] text-zinc-500 uppercase font-mono mb-2">Specifications</div>
                                         <div className="flex flex-wrap gap-2">
                                            {item.specsSummary.map((s, i) => (
                                               <span key={i} className="bg-zinc-900 px-2 py-1 rounded text-xs border border-zinc-800 text-zinc-300">{s}</span>
                                            ))}
                                         </div>
                                      </div>
                                   )}
                                   
                                   {/* Detailed Breakdown Table */}
                                   {item.breakdown && item.breakdown.length > 0 && (
                                      <div className="px-4 py-3">
                                         <div className="text-[10px] text-zinc-500 uppercase font-mono mb-2">Price Breakdown</div>
                                         <table className="w-full text-sm">
                                            <thead className="text-[10px] text-zinc-500 uppercase border-b border-zinc-800">
                                               <tr>
                                                  <th className="text-left py-2 font-medium">Code</th>
                                                  <th className="text-left py-2 font-medium">Description</th>
                                                  <th className="text-right py-2 font-medium">Price</th>
                                               </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-800/50">
                                               {item.breakdown.map((line, bidx) => (
                                                  <tr key={bidx} className={line.code === 'SUBTOTAL' ? 'bg-zinc-900/50 font-bold' : ''}>
                                                     <td className="py-2 font-mono text-xs text-zinc-500">
                                                        {line.code !== line.label && !line.code.includes('SUBTOTAL') ? line.code : ''}
                                                     </td>
                                                     <td className={`py-2 text-xs ${line.code === 'SUBTOTAL' ? 'text-amber-500' : 'text-zinc-300'}`}>
                                                        {line.label}
                                                     </td>
                                                     <td className={`py-2 text-right font-mono text-xs ${line.code === 'SUBTOTAL' ? 'text-amber-500' : 'text-zinc-400'}`}>
                                                        {line.price > 0 ? `$${line.price}` : '-'}
                                                     </td>
                                                  </tr>
                                               ))}
                                            </tbody>
                                         </table>
                                   </div>
                                   )}
                                </div>
                             ))}
                          </div>
                       </div>

                       {/* Totals */}
                       <div className="flex justify-end">
                          <div className="w-72 bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-2 text-sm">
                             <div className="flex justify-between text-zinc-400">
                                <span>Subtotal (Ex GST)</span>
                                <span className="font-mono">${selectedQuote.totals.subtotal.toLocaleString()}</span>
                             </div>
                             <div className="flex justify-between text-zinc-400">
                                <span>GST (10%)</span>
                                <span className="font-mono">${selectedQuote.totals.gst.toLocaleString()}</span>
                             </div>
                             <div className="flex justify-between text-white font-bold text-xl border-t border-zinc-700 pt-3 mt-3">
                                <span>Total (Inc GST)</span>
                                <span className="text-amber-500 font-mono">${selectedQuote.totals.total.toLocaleString()}</span>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              ) : (
                 <div className="flex-1 flex items-center justify-center text-zinc-500 italic bg-zinc-900/50 border border-zinc-800 rounded-lg hidden md:flex">
                    Select a quote to view details
                 </div>
              )}
           </div>
        )}

        {/* PRICING & OPTIONS MANAGER */}
        {activeStep === 1 && (
           <div className="max-w-5xl mx-auto space-y-12">
             <div>
                <h1 className="text-3xl font-bold mb-2">Product Pricing</h1>
                <p className="text-zinc-400 mb-6">Edit base prices and manage option visibility.</p>
                
                {products.map(prod => (
                  <div key={prod.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden mb-8">
                     <div className="bg-zinc-800 p-4 flex justify-between items-center border-b border-zinc-700">
                        <h3 className="font-bold text-lg">{prod.name}</h3>
                        <div className="flex items-center gap-2">
                           <span className="text-sm text-zinc-400">Base Price: $</span>
                           <input 
                              type="number" 
                              className="bg-zinc-900 border border-zinc-600 rounded px-2 py-1 w-24 text-right text-white focus:border-amber-500 outline-none"
                              defaultValue={prod.basePrice}
                              onBlur={(e) => handleBasePriceChange(prod.id, parseFloat(e.target.value))}
                           />
                        </div>
                     </div>
                     
                     <div className="p-4">
                        <div className="space-y-6">
                           {prod.groups.map(group => (
                              <div key={group.id}>
                                 <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 border-b border-zinc-800 pb-1">{group.label}</h4>
                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {group.options.map(opt => (
                                       <div key={opt.id} className={`flex items-center justify-between p-2 rounded border ${opt.isVisible === false ? 'bg-red-900/10 border-red-900/30' : 'bg-zinc-950 border-zinc-800'}`}>
                                          <div className="flex-1 min-w-0 mr-2">
                                             <div className="text-sm font-medium truncate" title={opt.label}>{opt.label}</div>
                                             <div className="text-xs text-zinc-500 font-mono">{opt.id}</div>
                                          </div>
                                          <div className="flex flex-col items-end gap-1">
                                             <div className="flex items-center gap-1">
                                                <span className="text-xs text-zinc-500">+$</span>
                                                <input 
                                                   type="number" 
                                                   className="bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 w-16 text-right text-xs"
                                                   defaultValue={opt.priceDelta || 0}
                                                   onBlur={(e) => handleOptionChange(prod.id, group.id, opt.id, { priceDelta: parseFloat(e.target.value) })}
                                                />
                                             </div>
                                             <label className="flex items-center gap-1 cursor-pointer">
                                                <input 
                                                   type="checkbox" 
                                                   checked={opt.isVisible !== false}
                                                   onChange={(e) => handleOptionChange(prod.id, group.id, opt.id, { isVisible: e.target.checked })}
                                                />
                                                <span className="text-[10px] uppercase font-bold text-zinc-400">Visible</span>
                                             </label>
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
                ))}
             </div>

             <div>
                <h2 className="text-2xl font-bold mb-4">Partition & Bin Sets</h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                   <div className="max-h-96 overflow-y-auto custom-scrollbar p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {interiors.map(part => (
                         <div key={part.id} className={`p-3 rounded border flex justify-between items-start ${part.isVisible === false ? 'bg-red-900/10 border-red-900/30' : 'bg-zinc-950 border-zinc-800'}`}>
                            <div>
                               <div className="font-bold text-sm">{part.code_base}</div>
                               <div className="text-xs text-zinc-500 mb-2">{part.layout_description}</div>
                               <label className="flex items-center gap-2 cursor-pointer">
                                   <input 
                                      type="checkbox" 
                                      checked={part.isVisible !== false} 
                                      onChange={(e) => handleInteriorChange(part.id, { isVisible: e.target.checked })}
                                   />
                                   <span className="text-xs text-zinc-400">Active in Catalog</span>
                               </label>
                            </div>
                            <div className="flex items-center gap-1">
                               <span className="text-xs text-zinc-500">$</span>
                               <input 
                                  type="number" 
                                  className="bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 w-16 text-right text-xs font-bold text-amber-500"
                                  defaultValue={part.price}
                                  onBlur={(e) => handleInteriorChange(part.id, { price: parseFloat(e.target.value) })}
                               />
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
             </div>
           </div>
        )}

        {/* BIM LEADS */}
        {activeStep === 7 && (
          <BIMLeadsManager />
        )}

        {/* USER MANAGEMENT */}
        {activeStep === 9 && isAdmin && (
          <UserManagement />
        )}

        {/* COMPANIES & CONTACTS */}
        {activeStep === 10 && (
          <CompanyManagement />
        )}

        {/* PRICING TIERS */}
        {activeStep === 11 && (
          <PricingTierManagement />
        )}

        {/* CURRENCIES */}
        {activeStep === 12 && (
          <CurrencyManagement />
        )}

        {/* CUSTOMERS */}
        {activeStep === 15 && (
          <CustomerManagement />
        )}

        {/* PRICING CSV */}
        {activeStep === 13 && (
          <PricingCSV />
        )}

        {/* EMAIL SETTINGS */}
        {activeStep === 8 && (
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold mb-2">Email Settings</h1>
            <p className="text-zinc-400 mb-8">Configure quote notification emails for testing and production.</p>
            
            {/* Test Mode Toggle */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg text-white">🧪 Test Mode</h3>
                  <p className="text-sm text-zinc-400">When enabled, all emails go to a single test address</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={emailSettings.testMode}
                    onChange={(e) => saveEmailSettings({ ...emailSettings, testMode: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
              
              {emailSettings.testMode && (
                <div className="mt-4 pt-4 border-t border-zinc-700">
                  <label className="block text-xs font-mono text-zinc-500 mb-2">TEST EMAIL ADDRESS</label>
                  <input 
                    type="email"
                    value={emailSettings.testEmail}
                    onChange={(e) => saveEmailSettings({ ...emailSettings, testEmail: e.target.value })}
                    placeholder="your-test-email@example.com"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                  <p className="text-xs text-amber-500 mt-2">⚠️ All emails will be sent to this address only</p>
                </div>
              )}
            </div>
            
            {/* Recipient Toggles */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="bg-zinc-800 px-6 py-4 border-b border-zinc-700">
                <h3 className="font-bold text-white">Email Recipients</h3>
                <p className="text-xs text-zinc-400 mt-1">Toggle which recipients receive quote notifications</p>
              </div>
              
              <div className="divide-y divide-zinc-800">
                {/* Customer Email */}
                <div className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">Customer Confirmation</div>
                    <div className="text-sm text-zinc-500">Send confirmation email to the customer</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={emailSettings.sendToCustomer}
                      onChange={(e) => saveEmailSettings({ ...emailSettings, sendToCustomer: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </div>
                
                {/* Marketing */}
                <div className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">marketing@opiegroup.com.au</div>
                    <div className="text-sm text-zinc-500">Opie Group Marketing Team</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={emailSettings.sendToMarketing}
                      onChange={(e) => saveEmailSettings({ ...emailSettings, sendToMarketing: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </div>
                
                {/* Opie Group Sales */}
                <div className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">sales@opiegroup.com.au</div>
                    <div className="text-sm text-zinc-500">Opie Group Sales Team</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={emailSettings.sendToOpieGroupSales}
                      onChange={(e) => saveEmailSettings({ ...emailSettings, sendToOpieGroupSales: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </div>
                
                {/* Boscotek Sales */}
                <div className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">sales@boscotek.com.au</div>
                    <div className="text-sm text-zinc-500">Boscotek Sales Team</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={emailSettings.sendToBoscotekSales}
                      onChange={(e) => saveEmailSettings({ ...emailSettings, sendToBoscotekSales: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </div>
              </div>
            </div>
            
            {/* Status Summary */}
            <div className="mt-6 p-4 bg-zinc-950 border border-zinc-800 rounded-lg">
              <div className="text-xs font-mono text-zinc-500 uppercase mb-2">Current Status</div>
              <div className="flex flex-wrap gap-2">
                {emailSettings.testMode ? (
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium">
                    🧪 Test Mode: {emailSettings.testEmail || 'No test email set'}
                  </span>
                ) : (
                  <>
                    {emailSettings.sendToCustomer && <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">Customer ✓</span>}
                    {emailSettings.sendToMarketing && <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">Marketing ✓</span>}
                    {emailSettings.sendToOpieGroupSales && <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">Opie Sales ✓</span>}
                    {emailSettings.sendToBoscotekSales && <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">Boscotek Sales ✓</span>}
                    {!emailSettings.sendToCustomer && !emailSettings.sendToMarketing && !emailSettings.sendToOpieGroupSales && !emailSettings.sendToBoscotekSales && (
                      <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">⚠️ All emails disabled</span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* BRAND SETTINGS */}
        {activeStep === 14 && (
          <BrandSettings />
        )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
