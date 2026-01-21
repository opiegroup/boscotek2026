import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ConfigurationState, ProductDefinition, DrawerConfiguration, PricingResult, QuoteLineItem, CustomerDetails, EmbeddedCabinet, LogoTransform } from '../types';
import ConfiguratorControls from '../components/ConfiguratorControls';
import { Viewer3D, Viewer3DRef } from '../components/Viewer3D';
import LectrumViewer3D, { LectrumViewer3DRef } from '../components/LectrumViewer3D';
import SummaryPanel from '../components/SummaryPanel';
import QuoteCart from '../components/QuoteCart';
import { getQuote } from '../services/pricingService';
import { submitQuote } from '../services/mockBackend';
import { generateReferenceCode } from '../services/referenceService';
import { generateLectrumReferenceCode } from '../services/products/lectrumCatalog';
import { useCatalog } from '../contexts/CatalogContext';
import { useAuth } from '../contexts/AuthContext';
import { useBrand } from '../contexts/BrandContext';
import BrandLogo, { BrandName } from '../components/BrandLogo';
import AdminDashboard from '../components/admin/AdminDashboard';
import { DistributorDashboard } from '../components/distributor';
import EmbedWrapper from '../components/EmbedWrapper';
import { useEmbedMode } from '../hooks/useEmbedMode';

/**
 * BrandConfigurator
 * 
 * The main configurator page for a brand at /{brand}/configurator
 * Contains all product configuration, cart, and quote submission logic.
 */
const BrandConfigurator: React.FC = () => {
  const { products, isLoading } = useCatalog();
  const { user, isAuthenticated, isAdmin, isStaff, isDistributor, signOut } = useAuth();
  const { brand, theme, brandSlug, isLoading: brandLoading } = useBrand();
  const { isEmbedded } = useEmbedMode();
  const navigate = useNavigate();
  const logoDefaultsAppliedRef = useRef<Record<string, boolean>>({});
  const [logoTransformsByModel, setLogoTransformsByModel] = useState<Record<string, Record<string, LogoTransform>>>({});
  
  const logoPanelClassicDefaults: LogoTransform = {
    scale: 0.06,
    offsetX: 0.02,
    offsetY: 0.28,
    offsetZ: -0.44,
    tilt: 0,
  };
  const fullDressPanelClassicDefaults: LogoTransform = {
    scale: 0.16,
    offsetX: 0.02,
    offsetY: 1.36,
    offsetZ: -0.16,
    tilt: 0,
  };
  const logoDefaultsByModel: Record<string, Record<string, { transform: LogoTransform; panelColour?: string }>> = {
    L20: {
      'crystalite-logo-classic': { transform: logoPanelClassicDefaults },
      'logo-panel-classic-400': { transform: logoPanelClassicDefaults },
      'logo-panel-classic-full': { transform: fullDressPanelClassicDefaults, panelColour: 'savoye' },
    },
    L20S: {
      'crystalite-logo-classic': { transform: logoPanelClassicDefaults },
      'logo-panel-classic-400': { transform: logoPanelClassicDefaults },
      'logo-panel-classic-full': { transform: fullDressPanelClassicDefaults, panelColour: 'savoye' },
    },
    'L20S-NCTL': {
      'crystalite-logo-classic': { transform: logoPanelClassicDefaults },
      'logo-panel-classic-400': { transform: logoPanelClassicDefaults },
      'logo-panel-classic-full': { transform: fullDressPanelClassicDefaults, panelColour: 'savoye' },
    },
    L900: {
      'crystalite-logo-classic': { transform: logoPanelClassicDefaults },
      'logo-panel-classic-400': { transform: logoPanelClassicDefaults },
      'logo-panel-classic-full': { transform: fullDressPanelClassicDefaults, panelColour: 'savoye' },
    },
    L101: {
      'crystalite-logo-classic': { transform: logoPanelClassicDefaults },
      'logo-panel-classic-400': { transform: logoPanelClassicDefaults },
      'logo-panel-classic-full': { transform: fullDressPanelClassicDefaults, panelColour: 'savoye' },
    },
  };
  
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isDistributorMode, setIsDistributorMode] = useState(false);
  
  // Navigation State
  const [viewMode, setViewMode] = useState<'catalog' | 'config' | 'cart' | 'success'>('catalog');
  const [activeProduct, setActiveProduct] = useState<ProductDefinition | null>(null);
  
  // Config State
  const [config, setConfig] = useState<ConfigurationState>({
    productId: '',
    selections: {},
    customDrawers: [],
    embeddedCabinets: [],
    logoTransform: { scale: 1, offsetX: 0, offsetY: 0 },
    notes: '',
    internalReference: ''
  });
  
  const [quantity, setQuantity] = useState(1);
  const [activeDrawerIndex, setActiveDrawerIndex] = useState<number | null>(null);

  // Pricing State
  const [pricing, setPricing] = useState<PricingResult>({ 
    totalPrice: 0, 
    basePrice: 0, 
    gst: 0, 
    currency: 'AUD', 
    breakdown: [] 
  });

  // Cart State
  const [quoteItems, setQuoteItems] = useState<QuoteLineItem[]>([]);
  const [submittedRef, setSubmittedRef] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  
  // Ref for capturing thumbnails from the 3D viewer
  const viewer3DRef = useRef<Viewer3DRef>(null);

  // Effect to fetch price when config changes
  useEffect(() => {
    if (activeProduct && viewMode === 'config') {
       getQuote(config).then(setPricing).catch(console.error);
    }
  }, [config, activeProduct, viewMode]);

  // Derived state
  const referenceCode = activeProduct 
    ? (brandSlug === 'lectrum' 
        ? generateLectrumReferenceCode(activeProduct.id, config.selections)
        : generateReferenceCode(config, activeProduct))
    : '';
  const primaryColor = theme.primaryColor || '#f59e0b';
  const accentColor = theme.accentColor || '#292926';
  const isLectrum = brandSlug === 'lectrum';

  const getActiveLogoAccessoryId = (accessories: Record<string, number> | undefined): string | null => {
    if (!accessories) return null;
    const logoIds = [
      'crystalite-logo-classic',
      'logo-panel-classic-400',
      'logo-panel-classic-full',
      'logo-panel-aero-400',
      'logo-panel-aero-full',
      'logo-insert-aero-top',
    ];
    return logoIds.find(id => (accessories[id] || 0) > 0) || null;
  };

  const getActiveModelId = (product: ProductDefinition | null): string | null => {
    if (!product?.id) return null;
    return product.id.replace('lectrum-', '').toUpperCase();
  };

  // Handlers
  const handleSelectProduct = (product: ProductDefinition) => {
    const initialSelections: Record<string, any> = {};
    product.groups.forEach(g => {
      if (g.defaultValue) initialSelections[g.id] = g.defaultValue;
      else if ((g.type === 'radio' || g.type === 'select') && g.options.length > 0) {
         initialSelections[g.id] = g.options[0].id;
      }
    });

    setConfig({
      productId: product.id,
      selections: initialSelections,
      customDrawers: [],
      embeddedCabinets: [],
      logoTransform: { scale: 1, offsetX: 0, offsetY: 0 },
      notes: '',
      internalReference: ''
    });
    setQuantity(1);
    setActiveProduct(product);
    setActiveDrawerIndex(null);
    setViewMode('config');
  };

  const handleConfigChange = (groupId: string, value: any) => {
    setConfig(prev => {
      const nextSelections = { ...prev.selections, [groupId]: value };
      if (groupId === 'accessories') {
        const modelId = getActiveModelId(activeProduct);
        const nextAccessories = value as Record<string, number> | undefined;
        const activeLogoAccessoryId = getActiveLogoAccessoryId(nextAccessories);
        if (modelId && activeLogoAccessoryId) {
          const defaultConfig = logoDefaultsByModel[modelId]?.[activeLogoAccessoryId];
          const savedTransform = logoTransformsByModel[modelId]?.[activeLogoAccessoryId];
          const applyKey = `${modelId}:${activeLogoAccessoryId}`;
          if (!logoDefaultsAppliedRef.current[applyKey] && defaultConfig) {
            logoDefaultsAppliedRef.current[applyKey] = true;
            return {
              ...prev,
              selections: defaultConfig.panelColour
                ? { ...nextSelections, 'panel-colour': defaultConfig.panelColour }
                : nextSelections,
              logoTransform: { ...defaultConfig.transform },
            };
          }
          if (savedTransform) {
            return {
              ...prev,
              selections: nextSelections,
              logoTransform: { ...savedTransform },
            };
          }
        }
      }
      return {
        ...prev,
        selections: nextSelections,
      };
    });
  };

  const handleLogoChange = (logoUrl: string | undefined) => {
    setConfig(prev => ({
      ...prev,
      logoImageUrl: logoUrl
    }));
  };

  const handleLogoTransformChange = (transform: LogoTransform) => {
    const modelId = getActiveModelId(activeProduct);
    const accessories = config.selections['accessories'] as Record<string, number> | undefined;
    const activeLogoAccessoryId = getActiveLogoAccessoryId(accessories);
    if (modelId && activeLogoAccessoryId) {
      setLogoTransformsByModel(prev => ({
        ...prev,
        [modelId]: {
          ...(prev[modelId] || {}),
          [activeLogoAccessoryId]: transform,
        },
      }));
    }
    setConfig(prev => ({
      ...prev,
      logoTransform: transform
    }));
  };

  const handleCustomDrawerChange = (newStack: DrawerConfiguration[]) => {
    setConfig(prev => ({
      ...prev,
      customDrawers: newStack
    }));
  };

  const handleEmbeddedCabinetChange = (newCabinets: EmbeddedCabinet[]) => {
     setConfig(prev => ({
        ...prev,
        embeddedCabinets: newCabinets
     }));
  };

  const handleReset = () => {
    if (activeProduct) handleSelectProduct(activeProduct);
  };

  const handleAddToQuote = () => {
    if (!activeProduct) return;
    
    // Capture thumbnail from the 3D viewer
    const thumbnail = viewer3DRef.current?.captureThumbnail() || undefined;
    
    // Generate human readable specs for the cart
    const specsSummary = activeProduct.groups.map(g => {
       if (g.type === 'drawer_stack') return null;
       const val = config.selections[g.id];
       if (g.type === 'qty_list') {
          // Count total items
          const qtyMap = val as Record<string,number>;
          const total = Object.values(qtyMap || {}).reduce((a,b) => a+b, 0);
          return total > 0 ? `${total}x Individual Accessories` : null;
       }
       if (val === true) return g.label; 
       if (!val || val === 'none' || val === 'T0' || val === 'B0') return null;
       const opt = g.options.find(o => o.id === val);
       return opt ? opt.label : null;
    }).filter(Boolean) as string[];

    if (config.customDrawers.length > 0) {
       specsSummary.push(`${config.customDrawers.length} Custom Drawers`);
    }
    
    if (config.embeddedCabinets && config.embeddedCabinets.length > 0) {
       specsSummary.push(`${config.embeddedCabinets.length}x Custom Embedded Cabinets`);
    }

    // Check if we're editing an existing item
    if (editingItemId) {
      // Update the existing item
      const existingItem = quoteItems.find(item => item.id === editingItemId);
      const updatedItem: QuoteLineItem = {
        id: editingItemId,
        productName: activeProduct.name,
        configurationCode: referenceCode,
        configuration: { ...config },
        quantity: quantity,
        unitPrice: pricing.totalPrice,
        totalPrice: pricing.totalPrice * quantity,
        specsSummary: specsSummary,
        breakdown: pricing.breakdown,
        thumbnail: thumbnail || existingItem?.thumbnail
      };
      
      setQuoteItems(quoteItems.map(item => 
        item.id === editingItemId ? updatedItem : item
      ));
      setEditingItemId(null);
    } else {
      // Add new item
      const newItem: QuoteLineItem = {
        id: `line-${Date.now()}`,
        productName: activeProduct.name,
        configurationCode: referenceCode,
        configuration: { ...config },
        quantity: quantity,
        unitPrice: pricing.totalPrice,
        totalPrice: pricing.totalPrice * quantity,
        specsSummary: specsSummary,
        breakdown: pricing.breakdown,
        thumbnail: thumbnail
      };
      
      setQuoteItems([...quoteItems, newItem]);
    }

    setViewMode('catalog');
    setActiveProduct(null);
  };

  const handleRemoveItem = (id: string) => {
    setQuoteItems(quoteItems.filter(i => i.id !== id));
  };

  const handleEditItem = (id: string) => {
    const itemToEdit = quoteItems.find(i => i.id === id);
    if (!itemToEdit) return;

    const product = products.find(p => p.id === itemToEdit.configuration.productId);
    if (!product) return;

    setConfig(itemToEdit.configuration);
    setQuantity(itemToEdit.quantity);
    setActiveProduct(product);
    setEditingItemId(id);
    setViewMode('config');
  };

  const handleSubmitFullQuote = async (customer: CustomerDetails) => {
    try {
      const quote = await submitQuote(customer, quoteItems);
      setSubmittedRef(quote.reference);
      setQuoteItems([]);
      setViewMode('success');
    } catch (e) {
      alert("Failed to submit quote. Please try again.");
    }
  };

  const handleBackToBrandPage = () => {
    navigate(`/${brandSlug}/`);
  };

  // --- VIEWS ---

  if (isAdminMode) {
    return <AdminDashboard onExit={() => setIsAdminMode(false)} />;
  }

  if (isDistributorMode) {
    return <DistributorDashboard onExit={() => setIsDistributorMode(false)} />;
  }

  if (isLoading || brandLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p>Loading {brand?.name || 'Configurator'}...</p>
        </div>
      </div>
    );
  }

  // 1. SUCCESS VIEW
  if (viewMode === 'success') {
     return (
       <EmbedWrapper>
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8 text-center text-white">
           <div className="bg-zinc-900 border border-zinc-800 p-12 rounded-2xl shadow-2xl max-w-lg">
              <div className="text-6xl mb-6">✅</div>
              <h1 className="text-3xl font-bold mb-4 text-white">Quote Request Received</h1>
              <p className="text-zinc-400 mb-8">
                 Thank you. We have received your configuration request. A confirmation email has been sent to you.
              </p>
              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded mb-8">
                 <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Quote Reference</div>
                 <div className="text-2xl font-mono font-bold text-amber-500">{submittedRef}</div>
              </div>
              <button 
                 onClick={() => setViewMode('catalog')}
                 className="bg-amber-500 text-black font-bold px-8 py-3 rounded hover:bg-amber-400 transition-colors"
              >
                 Start New Quote
              </button>
           </div>
        </div>
       </EmbedWrapper>
     )
  }

  // 2. CART VIEW
  if (viewMode === 'cart') {
     return (
       <EmbedWrapper>
         <QuoteCart 
            items={quoteItems}
            onRemoveItem={handleRemoveItem}
            onEditItem={handleEditItem}
            onAddMore={() => setViewMode('catalog')}
            onSubmitQuote={handleSubmitFullQuote}
         />
       </EmbedWrapper>
     );
  }

  // 3. CATALOG VIEW (Product Selection)
  if (viewMode === 'catalog') {
    return (
      <EmbedWrapper>
        <div 
          className="min-h-screen text-white flex flex-col relative" 
          style={{ backgroundColor: accentColor }}
        >
          
          {/* Top Navigation Bar */}
          {!isEmbedded && (
            <div className="absolute top-0 left-0 right-0 z-10 px-6 py-4 flex items-center justify-between">
              {/* Back to Brand Page */}
              <Link 
                to={`/${brandSlug}/`}
                className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Link>
              
              {/* Right Side Actions */}
              <div className="flex items-center gap-4">
                {/* User indicator */}
                {isAuthenticated && user && (
                  <div className="flex items-center gap-3 text-xs text-zinc-400 bg-black/20 px-4 py-2 rounded-full backdrop-blur-sm">
                    <span className={`w-2 h-2 rounded-full ${isDistributor ? 'bg-blue-500' : isStaff ? 'bg-green-500' : 'bg-zinc-500'}`} />
                    <span>{user.name}</span>
                    {user.role && <span className="text-zinc-500">({user.role})</span>}
                    <span className="text-zinc-600">|</span>
                    {/* My Portal for distributors */}
                    {(isDistributor || user?.role === 'distributor') && (
                      <button 
                        onClick={() => setIsDistributorMode(true)}
                        className="text-blue-400 hover:text-blue-300 font-medium"
                      >
                        My Portal
                      </button>
                    )}
                    {(isDistributor || user?.role === 'distributor') && (
                      <span className="text-zinc-600">|</span>
                    )}
                    <button 
                      onClick={signOut}
                      className="text-zinc-500 hover:text-white"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
                
                {/* Cart button */}
                {quoteItems.length > 0 && (
                  <button 
                    onClick={() => setViewMode('cart')}
                    className="flex items-center gap-2 text-black font-bold px-6 py-2 rounded-full shadow-lg transition-all animate-bounce"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <span>View Cart</span>
                    <span 
                      className="text-xs rounded-full w-5 h-5 flex items-center justify-center"
                      style={{ backgroundColor: 'black', color: primaryColor }}
                    >
                      {quoteItems.length}
                    </span>
                  </button>
                )}
                
                {/* Admin/Staff access */}
                {(isAdmin || isStaff) && (
                  <button 
                    onClick={() => setIsAdminMode(true)} 
                    className="text-xs text-zinc-400 hover:text-white font-medium bg-black/20 px-4 py-2 rounded-full backdrop-blur-sm transition-colors"
                  >
                    {isAdmin ? 'Admin' : 'Staff'} Dashboard
                  </button>
                )}
                
                {/* Login for non-authenticated users */}
                {!isAuthenticated && (
                  <button 
                    onClick={() => setIsAdminMode(true)} 
                    className="text-xs text-zinc-400 hover:text-white font-medium bg-black/20 px-4 py-2 rounded-full backdrop-blur-sm transition-colors"
                  >
                    Sign In
                  </button>
                )}
              </div>
            </div>
          )}

          <main className="flex-1 flex flex-col items-center justify-center p-8 pt-20">
            {/* Brand Logo */}
            <div className="mb-10 transform scale-125">
              <BrandLogo className="h-16" showText={true} />
            </div>

            {/* Brand Name & Tagline */}
            <h1 className="text-3xl font-bold mb-2 text-white">
              <BrandName /> Product Configurator
            </h1>
            <p className="text-zinc-400 mb-8">
              Select a product to configure and get an instant quote
            </p>
            
            {/* Product Grid */}
            {products.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full">
                {products.map(prod => (
                  <button 
                    key={prod.id} 
                    onClick={() => handleSelectProduct(prod)}
                    className="bg-[#2a2a2a] border border-[#4a4a4a] p-8 rounded-xl text-left transition-all group shadow-xl hover:shadow-2xl hover:-translate-y-1"
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = primaryColor}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = '#4a4a4a'}
                  >
                    <h3 
                      className="text-xl font-bold mb-2 transition-colors text-white group-hover:text-amber-400"
                      style={{ '--hover-color': primaryColor } as React.CSSProperties}
                    >
                      {prod.name}
                    </h3>
                    <p className="text-zinc-400 text-sm">{prod.description}</p>
                    <div className="mt-4 text-xs font-mono text-zinc-500">From ${prod.basePrice}</div>
                  </button>
                ))}
              </div>
            ) : (
              /* Empty State */
              <div className="max-w-lg text-center">
                <div 
                  className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
                  style={{ backgroundColor: `${primaryColor}20` }}
                >
                  <svg 
                    className="w-10 h-10" 
                    fill="none" 
                    stroke={primaryColor}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-3">
                  Coming Soon
                </h2>
                <p className="text-zinc-400 mb-6">
                  The <span style={{ color: primaryColor }}>{brand?.name}</span> product configurator is currently being set up. 
                  Check back soon for configurable products!
                </p>
              </div>
            )}
            
            {/* Brand Footer */}
            <div className="mt-12 text-center text-zinc-500 text-sm">
              <p>Part of the <span className="text-zinc-400">Opie Manufacturing Group</span></p>
            </div>
          </main>
        </div>
      </EmbedWrapper>
    );
  }

  // 4. CONFIGURATOR VIEW
  if (activeProduct) {
    return (
      <EmbedWrapper showOpenLink={true}>
        <div className="h-screen flex flex-col md:flex-row bg-zinc-950 overflow-hidden relative">
          
          {/* LEFT: Controls */}
          <div className="w-full md:w-[400px] h-full flex flex-col border-r border-zinc-800 bg-zinc-900 z-10">
            <ConfiguratorControls 
              product={activeProduct}
              config={config}
              onChange={handleConfigChange}
              onCustomDrawerChange={handleCustomDrawerChange}
              onEmbeddedCabinetChange={handleEmbeddedCabinetChange}
              onBack={() => { setActiveProduct(null); setViewMode('catalog'); setEditingItemId(null); }}
              activeDrawerIndex={activeDrawerIndex}
              onSelectDrawer={setActiveDrawerIndex}
              isEditingCartItem={editingItemId !== null}
              onLogoChange={handleLogoChange}
              onLogoTransformChange={handleLogoTransformChange}
            />
          </div>

          {/* MIDDLE: 3D Visualizer */}
          <div className="flex-1 relative h-[50vh] md:h-auto bg-zinc-950">
            {/* Cart Overlay Indicator */}
            {quoteItems.length > 0 && (
              <button 
                onClick={() => setViewMode('cart')}
                className="absolute top-4 right-4 z-20 bg-amber-500/90 backdrop-blur text-black font-bold px-4 py-2 rounded-lg shadow-lg hover:bg-amber-400 transition-all flex items-center gap-2"
              >
                <span>🛒 Cart</span>
                <span className="bg-black text-amber-500 text-xs w-5 h-5 flex items-center justify-center rounded-full">{quoteItems.length}</span>
              </button>
            )}

            {isLectrum ? (
              <LectrumViewer3D 
                ref={viewer3DRef}
                config={config} 
                product={activeProduct} 
              />
            ) : (
              <Viewer3D 
                ref={viewer3DRef}
                config={config} 
                product={activeProduct} 
                activeDrawerIndex={activeDrawerIndex}
              />
            )}
          </div>

          {/* RIGHT: Summary */}
          <div className="hidden lg:block w-[350px] h-full border-l border-zinc-800 bg-zinc-900 z-10">
            <SummaryPanel 
              product={activeProduct}
              config={config}
              pricing={pricing}
              referenceCode={referenceCode}
              quantity={quantity}
              onQuantityChange={setQuantity}
              onAddToQuote={handleAddToQuote}
              isEditingCartItem={editingItemId !== null}
            />
          </div>
        </div>
      </EmbedWrapper>
    );
  }

  return null;
};

export default BrandConfigurator;
