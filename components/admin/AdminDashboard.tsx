
import React, { useState, useEffect } from 'react';
import { useCatalog } from '../../contexts/CatalogContext';
import { login, checkSession, logout, updateBasePrice, updateOption, updateInteriorOption, getInteriors, getQuotes, updateQuoteStatus, seedDatabase } from '../../services/mockBackend';
import { ProductDefinition, DrawerInteriorOption, Quote, QuoteStatus } from '../../types';
import BoscotekLogo from '../BoscotekLogo';
import BIMLeadsManager from './BIMLeadsManager';

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
  
  // Data State
  const [interiors, setInteriors] = useState<DrawerInteriorOption[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);

  // View State: 0: Dashboard, 1: Pricing/Options, 6: Quotes, 7: BIM Leads
  const [activeStep, setActiveStep] = useState<number>(0); 
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  
  // --- LOAD DATA ---
  useEffect(() => {
    checkSession().then(user => {
      if (user) setIsAuthenticated(true);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadInteriors();
      loadQuotes();
    }
  }, [isAuthenticated, activeStep]); 

  const loadInteriors = async () => {
    const data = await getInteriors();
    setInteriors(data);
  }

  const loadQuotes = async () => {
    const data = await getQuotes();
    setQuotes(data);
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

  // --- RENDER: LOGIN ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-8 rounded-xl shadow-2xl">
          <div className="mb-8 flex justify-center">
            <BoscotekLogo className="h-10" />
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

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col z-20">
        <div className="p-6 border-b border-zinc-800 flex flex-col items-start gap-3">
          <BoscotekLogo className="h-6" showText={true} />
          <div className="text-xs font-mono text-zinc-500 bg-zinc-950 px-2 py-1 rounded">ADMIN ACCESS</div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveStep(0)} className={`w-full text-left p-3 rounded text-sm font-medium transition-colors ${activeStep === 0 ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>Dashboard</button>
          <button onClick={() => setActiveStep(6)} className={`w-full text-left p-3 rounded text-sm font-medium transition-colors ${activeStep === 6 ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>Quotes / Orders</button>
          <button onClick={() => setActiveStep(7)} className={`w-full text-left p-3 rounded text-sm font-medium transition-colors ${activeStep === 7 ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'}`}>🔥 BIM Leads</button>
          <button onClick={() => setActiveStep(1)} className={`w-full text-left p-3 rounded text-sm font-medium transition-colors ${activeStep === 1 ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>Pricing & Options</button>
        </nav>
        <div className="p-4 border-t border-zinc-800 space-y-2">
           <button onClick={handleLogout} className="w-full text-xs text-zinc-500 hover:text-white text-left p-2">Sign Out</button>
           <button onClick={onExit} className="w-full flex items-center justify-center gap-2 bg-zinc-800 text-zinc-300 py-3 rounded hover:bg-zinc-700 hover:text-white transition-all text-sm font-bold border border-zinc-700 hover:border-amber-500/50">
              <span>←</span> Exit to Configurator
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        
        {/* DASHBOARD */}
        {activeStep === 0 && (
          <div>
            <div className="flex justify-between items-center mb-6">
               <h1 className="text-3xl font-bold">Overview</h1>
               <div className="flex gap-2">
                  <button onClick={handleSeed} className="bg-blue-900/30 border border-blue-500/50 text-blue-300 px-4 py-2 rounded text-sm hover:bg-blue-900/50">
                     Initialize / Seed Database
                  </button>
               </div>
            </div>
            
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg">
                <div className="text-zinc-500 text-sm font-mono mb-2">QUOTES RECEIVED</div>
                <div className="text-4xl font-bold text-amber-500">{quotes.length}</div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg">
                <div className="text-zinc-500 text-sm font-mono mb-2">LIVE PRODUCTS</div>
                <div className="text-4xl font-bold text-white">{products.length}</div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg">
                 <div className="text-zinc-500 text-sm font-mono mb-2">PARTITION SETS</div>
                 <div className="text-4xl font-bold text-zinc-300">{interiors.length}</div>
              </div>
            </div>
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
      </main>
    </div>
  );
};

export default AdminDashboard;
