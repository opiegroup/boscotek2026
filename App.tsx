
import React, { useState, useEffect, useRef } from 'react';
import { ConfigurationState, ProductDefinition, DrawerConfiguration, PricingResult, QuoteLineItem, CustomerDetails, EmbeddedCabinet } from './types';
import ConfiguratorControls from './components/ConfiguratorControls';
import { Viewer3D, Viewer3DRef } from './components/Viewer3D';
import SummaryPanel from './components/SummaryPanel';
import QuoteCart from './components/QuoteCart';
import { getQuote } from './services/pricingService';
import { submitQuote } from './services/mockBackend'; // Direct call for simplicity in this demo structure
import { generateReferenceCode } from './services/referenceService';
import { CatalogProvider, useCatalog } from './contexts/CatalogContext';
import AdminDashboard from './components/admin/AdminDashboard';
import BoscotekLogo from './components/BoscotekLogo';

// Internal App Content (Needs Access to Context)
const BoscotekApp: React.FC = () => {
  const { products, isLoading } = useCatalog();
  const [isAdminMode, setIsAdminMode] = useState(false);
  
  // Navigation State
  const [viewMode, setViewMode] = useState<'catalog' | 'config' | 'cart' | 'success'>('catalog');
  const [activeProduct, setActiveProduct] = useState<ProductDefinition | null>(null);
  
  // Config State
  const [config, setConfig] = useState<ConfigurationState>({
    productId: '',
    selections: {},
    customDrawers: [],
    embeddedCabinets: [], // Initialize
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
  const referenceCode = activeProduct ? generateReferenceCode(config, activeProduct) : '';

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
      embeddedCabinets: [], // Reset embedded on new product
      notes: '',
      internalReference: ''
    });
    setQuantity(1);
    setActiveProduct(product);
    setActiveDrawerIndex(null);
    setViewMode('config');
  };

  const handleConfigChange = (groupId: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      selections: { ...prev.selections, [groupId]: value }
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
      // Update the existing item (keep existing thumbnail if no new one captured)
      const existingItem = quoteItems.find(item => item.id === editingItemId);
      const updatedItem: QuoteLineItem = {
        id: editingItemId, // Keep the same ID
        productName: activeProduct.name,
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
      setEditingItemId(null); // Clear editing state
    } else {
      // Add new item
      const newItem: QuoteLineItem = {
        id: `line-${Date.now()}`,
        productName: activeProduct.name,
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

    setViewMode('catalog'); // Return to catalog to add more or view cart
    setActiveProduct(null);
  };

  const handleRemoveItem = (id: string) => {
    setQuoteItems(quoteItems.filter(i => i.id !== id));
  };

  const handleEditItem = (id: string) => {
    // Find the item to edit
    const itemToEdit = quoteItems.find(i => i.id === id);
    if (!itemToEdit) return;

    // Find the product definition
    const product = products.find(p => p.id === itemToEdit.configuration.productId);
    if (!product) return;

    // Load the configuration back into the configurator
    setConfig(itemToEdit.configuration);
    setQuantity(itemToEdit.quantity);
    setActiveProduct(product);
    setEditingItemId(id); // Track which item we're editing
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

  // --- VIEWS ---

  if (isAdminMode) {
    return <AdminDashboard onExit={() => setIsAdminMode(false)} />;
  }

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center bg-zinc-950 text-white">Loading Catalog...</div>;
  }

  // 1. SUCCESS VIEW
  if (viewMode === 'success') {
     return (
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
     )
  }

  // 2. CART VIEW
  if (viewMode === 'cart') {
     return (
       <QuoteCart 
          items={quoteItems}
          onRemoveItem={handleRemoveItem}
          onEditItem={handleEditItem}
          onAddMore={() => setViewMode('catalog')}
          onSubmitQuote={handleSubmitFullQuote}
       />
     );
  }

  // 3. CATALOG VIEW (Product Selection)
  if (viewMode === 'catalog') {
    return (
      <div className="min-h-screen text-white flex flex-col relative" style={{ backgroundColor: '#3e3e3e' }}>
        
        {/* Top Right Admin Access */}
        <div className="absolute top-6 right-6 z-10 flex gap-4">
           {quoteItems.length > 0 && (
              <button 
                onClick={() => setViewMode('cart')}
                className="flex items-center gap-2 bg-amber-500 text-black font-bold px-6 py-2 rounded-full shadow-lg hover:bg-amber-400 transition-all animate-bounce"
              >
                 <span>View Cart</span>
                 <span className="bg-black text-amber-500 text-xs rounded-full w-5 h-5 flex items-center justify-center">{quoteItems.length}</span>
              </button>
           )}
           <button 
             onClick={() => setIsAdminMode(true)} 
             className="text-xs text-zinc-400 hover:text-white font-medium bg-black/20 px-4 py-2 rounded-full backdrop-blur-sm transition-colors"
           >
             Admin Access
           </button>
        </div>

        <main className="flex-1 flex flex-col items-center justify-center p-8">
           <div className="mb-10 transform scale-125">
             <BoscotekLogo className="h-16" showText={true} />
           </div>

           <h1 className="text-3xl font-bold mb-8 text-white">Select a Product to Configure</h1>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full">
              {products.map(prod => (
                <button 
                  key={prod.id} 
                  onClick={() => handleSelectProduct(prod)}
                  className="bg-[#2a2a2a] border border-[#4a4a4a] hover:border-amber-500 p-8 rounded-xl text-left transition-all group shadow-xl hover:shadow-2xl hover:-translate-y-1"
                >
                  <h3 className="text-xl font-bold mb-2 group-hover:text-amber-500">{prod.name}</h3>
                  <p className="text-zinc-400 text-sm">{prod.description}</p>
                  <div className="mt-4 text-xs font-mono text-zinc-500">From ${prod.basePrice}</div>
                </button>
              ))}
           </div>
        </main>
      </div>
    );
  }

  // 4. CONFIGURATOR VIEW
  if (activeProduct) {
    return (
      <div className="h-screen flex flex-col md:flex-row bg-zinc-950 overflow-hidden relative">
        
        {/* LEFT: Controls */}
        <div className="w-full md:w-[400px] h-full flex flex-col border-r border-zinc-800 bg-zinc-900 z-10">
           <ConfiguratorControls 
              product={activeProduct}
              config={config}
              onChange={handleConfigChange}
              onCustomDrawerChange={handleCustomDrawerChange}
              onEmbeddedCabinetChange={handleEmbeddedCabinetChange} // New Handler
              onBack={() => { setActiveProduct(null); setViewMode('catalog'); setEditingItemId(null); }}
              activeDrawerIndex={activeDrawerIndex}
              onSelectDrawer={setActiveDrawerIndex}
              isEditingCartItem={editingItemId !== null}
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

           <Viewer3D 
             ref={viewer3DRef}
             config={config} 
             product={activeProduct} 
             activeDrawerIndex={activeDrawerIndex}
           />
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
    );
  }

  return null; // Should not reach here
};

const App: React.FC = () => {
  return (
    <CatalogProvider>
      <BoscotekApp />
    </CatalogProvider>
  );
};

export default App;
