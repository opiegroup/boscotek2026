
import React, { useState } from 'react';
import { CustomerDetails, QuoteLineItem } from '../types';
import BoscotekLogo from './BoscotekLogo';

interface QuoteCartProps {
  items: QuoteLineItem[];
  onRemoveItem: (id: string) => void;
  onEditItem: (id: string) => void;
  onAddMore: () => void;
  onSubmitQuote: (customer: CustomerDetails) => void;
}

const QuoteCart: React.FC<QuoteCartProps> = ({ items, onRemoveItem, onEditItem, onAddMore, onSubmitQuote }) => {
  const [customer, setCustomer] = useState<CustomerDetails>({ name: '', company: '', email: '', phone: '', notes: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const gst = subtotal * 0.1;
  const total = subtotal + gst;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer.name || !customer.email) {
      alert("Please fill in at least Name and Email.");
      return;
    }
    setIsSubmitting(true);
    onSubmitQuote(customer);
  };

  return (
    <div className="min-h-screen text-white flex flex-col items-center p-6" style={{ backgroundColor: '#3e3e3e' }}>
      <div className="w-full max-w-5xl">
        <div className="flex justify-between items-center mb-8">
           <BoscotekLogo className="h-10" showText={true} />
           <h1 className="text-2xl font-bold uppercase tracking-wide">Quote Request</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* LEFT: CART ITEMS */}
           <div className="lg:col-span-2 space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-xl">
                 <div className="p-4 bg-zinc-800 border-b border-zinc-700 flex justify-between items-center">
                    <h3 className="font-bold">Your Selection ({items.length} Items)</h3>
                    <button onClick={onAddMore} className="text-xs bg-amber-500 text-black px-3 py-1.5 rounded font-bold hover:bg-amber-400 transition-colors">
                       + Add Another Product
                    </button>
                 </div>
                 
                 {items.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500">
                       Your quote cart is empty.
                    </div>
                 ) : (
                    <div className="divide-y divide-zinc-800">
                       {items.map(item => (
                          <div key={item.id} className="p-4 flex flex-col hover:bg-zinc-900/50 transition-colors group">
                             {/* Item Header */}
                             <div className="flex flex-col sm:flex-row gap-4 mb-3">
                                {/* Thumbnail */}
                                <div className="flex-shrink-0">
                                   {item.thumbnail ? (
                                      <img 
                                         src={item.thumbnail} 
                                         alt={item.productName}
                                         className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg border border-zinc-700 bg-zinc-800"
                                      />
                                   ) : (
                                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg border border-zinc-700 bg-zinc-800 flex items-center justify-center">
                                         <span className="text-3xl text-zinc-600">📦</span>
                                      </div>
                                   )}
                                </div>
                                <div className="flex-1">
                                   <div className="flex justify-between items-start">
                                      <div>
                                         <h4 className="font-bold text-lg text-white">{item.productName}</h4>
                                         <div className="text-sm text-zinc-400 mt-1">
                                            Quantity: <span className="text-white font-bold">{item.quantity}</span>
                                         </div>
                                      </div>
                                      <div className="text-right block sm:hidden flex gap-2">
                                          <button 
                                             onClick={() => onEditItem(item.id)}
                                             className="text-xs bg-zinc-800 hover:bg-amber-500 hover:text-black text-zinc-300 px-3 py-1.5 rounded transition-colors font-medium"
                                             title="Edit Configuration"
                                          >
                                             ✏️ Edit
                                          </button>
                                          <button 
                                             onClick={() => onRemoveItem(item.id)}
                                             className="text-zinc-600 hover:text-red-500 p-1"
                                             title="Remove Item"
                                          >
                                             ✕
                                          </button>
                                      </div>
                                   </div>
                                </div>
                                
                                <div className="text-left sm:text-right flex flex-row sm:flex-col justify-between items-center sm:items-end gap-3">
                                    <div className="text-right">
                                        <div className="font-mono font-bold text-amber-500 text-lg">${item.totalPrice.toLocaleString()}</div>
                                        {item.quantity > 1 && (
                                            <div className="text-xs text-zinc-500">${item.unitPrice.toLocaleString()} ea</div>
                                        )}
                                    </div>
                                    <div className="hidden sm:flex gap-2 items-center">
                                        <button 
                                           onClick={() => onEditItem(item.id)}
                                           className="text-xs bg-zinc-800 hover:bg-amber-500 hover:text-black text-zinc-300 px-3 py-1.5 rounded transition-colors font-medium"
                                           title="Edit Configuration"
                                        >
                                           ✏️ Edit
                                        </button>
                                        <button 
                                           onClick={() => onRemoveItem(item.id)}
                                           className="text-zinc-600 hover:text-red-500 p-1"
                                           title="Remove Item"
                                        >
                                           ✕
                                        </button>
                                    </div>
                                </div>
                             </div>

                             {/* Detailed Breakdown Table */}
                             {item.breakdown && item.breakdown.length > 0 ? (
                                <div className="bg-zinc-950 border border-zinc-800/60 rounded text-sm overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-zinc-900 text-zinc-500 text-[10px] uppercase font-mono tracking-wider">
                                            <tr>
                                                <th className="p-2 pl-3 font-medium w-24">Code</th>
                                                <th className="p-2 font-medium">Description</th>
                                                <th className="p-2 pr-3 font-medium text-right w-20">Price</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-800/30">
                                            {item.breakdown.map((line, idx) => (
                                                <tr key={idx} className={`transition-colors ${line.code === 'SUBTOTAL' ? 'bg-zinc-900/30 font-bold border-t border-zinc-800' : 'hover:bg-zinc-900/20'}`}>
                                                    <td className="p-2 pl-3 text-[11px] font-mono text-zinc-500">
                                                        {line.code !== line.label && !line.code.includes('SUBTOTAL') && !line.code.includes('EMBED') ? line.code : ''}
                                                    </td>
                                                    <td className={`p-2 text-xs ${line.code === 'SUBTOTAL' ? 'text-amber-500' : 'text-zinc-300'}`}>
                                                        <span className={line.code.includes('EMBED') ? 'font-bold text-zinc-200 uppercase tracking-wide text-[10px]' : ''}>
                                                            {line.label}
                                                        </span>
                                                    </td>
                                                    <td className={`p-2 pr-3 text-xs font-mono text-right ${line.code === 'SUBTOTAL' ? 'text-amber-500' : 'text-zinc-400'}`}>
                                                        {line.price > 0 ? `$${line.price}` : (line.code === 'SUBTOTAL' ? '$0' : '-')}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                             ) : (
                                <div className="text-xs text-zinc-500 flex flex-wrap gap-2">
                                    {item.specsSummary.map((spec, idx) => (
                                        <span key={idx} className="bg-zinc-950 border border-zinc-800 px-2 py-1 rounded">
                                            {spec}
                                        </span>
                                    ))}
                                </div>
                             )}
                          </div>
                       ))}
                    </div>
                 )}
                 
                 {items.length > 0 && (
                    <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex justify-end gap-8 text-sm">
                       <div className="text-zinc-400">Subtotal: <span className="text-white ml-2">${subtotal.toLocaleString()}</span></div>
                       <div className="text-zinc-400">GST: <span className="text-white ml-2">${gst.toLocaleString()}</span></div>
                       <div className="text-amber-500 font-bold text-lg">Total: <span className="ml-2">${total.toLocaleString()}</span></div>
                    </div>
                 )}
              </div>
           </div>

           {/* RIGHT: CUSTOMER FORM */}
           <div className="lg:col-span-1">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 sticky top-6 shadow-xl">
                 <h3 className="font-bold text-lg mb-4">Contact Details</h3>
                 <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                       <label className="block text-xs text-zinc-500 mb-1 uppercase">Full Name *</label>
                       <input 
                          type="text" 
                          required
                          className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-white focus:border-amber-500 outline-none"
                          value={customer.name}
                          onChange={e => setCustomer({...customer, name: e.target.value})}
                       />
                    </div>
                    <div>
                       <label className="block text-xs text-zinc-500 mb-1 uppercase">Company Name</label>
                       <input 
                          type="text" 
                          className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-white focus:border-amber-500 outline-none"
                          value={customer.company}
                          onChange={e => setCustomer({...customer, company: e.target.value})}
                       />
                    </div>
                    <div>
                       <label className="block text-xs text-zinc-500 mb-1 uppercase">Email Address *</label>
                       <input 
                          type="email" 
                          required
                          className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-white focus:border-amber-500 outline-none"
                          value={customer.email}
                          onChange={e => setCustomer({...customer, email: e.target.value})}
                       />
                    </div>
                    <div>
                       <label className="block text-xs text-zinc-500 mb-1 uppercase">Phone Number</label>
                       <input 
                          type="tel" 
                          className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-white focus:border-amber-500 outline-none"
                          value={customer.phone}
                          onChange={e => setCustomer({...customer, phone: e.target.value})}
                       />
                    </div>
                    <div>
                       <label className="block text-xs text-zinc-500 mb-1 uppercase">Notes / Special Requirements</label>
                       <textarea 
                          rows={3}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-white focus:border-amber-500 outline-none"
                          value={customer.notes}
                          onChange={e => setCustomer({...customer, notes: e.target.value})}
                       />
                    </div>

                    <button 
                       type="submit" 
                       disabled={isSubmitting || items.length === 0}
                       className={`w-full py-4 rounded font-bold text-black uppercase tracking-wide transition-all
                          ${isSubmitting || items.length === 0 
                             ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed' 
                             : 'bg-amber-500 hover:bg-amber-400 hover:shadow-[0_0_15px_rgba(245,158,11,0.4)]'}
                       `}
                    >
                       {isSubmitting ? 'Submitting...' : 'Submit Quote Request'}
                    </button>
                    <p className="text-xs text-zinc-500 text-center mt-2">
                       We will review your configuration and send a formal quote to your email.
                    </p>
                 </form>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteCart;
