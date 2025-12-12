
import React from 'react';
import { ConfigurationState, PricingResult, ProductDefinition } from '../types';
import ExportButtons from './ExportButtons';

interface SummaryPanelProps {
  product: ProductDefinition;
  config: ConfigurationState;
  pricing: PricingResult;
  referenceCode: string;
  // New props for Cart actions
  quantity: number;
  onQuantityChange: (qty: number) => void;
  onAddToQuote: () => void;
  isEditingCartItem?: boolean;
}

const SummaryPanel: React.FC<SummaryPanelProps> = ({ 
  product, 
  config, 
  pricing, 
  referenceCode,
  quantity,
  onQuantityChange,
  onAddToQuote,
  isEditingCartItem = false
}) => {
  
  const grandTotal = pricing.totalPrice * quantity;

  // Helper to generate drawer summary for display
  const getDrawerSummary = () => {
     if (product.id !== 'prod-hd-cabinet') return null;
     if (!config.customDrawers.length) return <dd className="text-zinc-500 text-right italic">No drawers</dd>;

     const group = product.groups.find(g => g.type === 'drawer_stack');
     if (!group) return null;

     const counts: Record<number, number> = {};
     let totalHeight = 0;

     config.customDrawers.forEach(d => {
        const opt = group.options.find(o => o.id === d.id);
        const h = opt?.meta?.front || 0;
        counts[h] = (counts[h] || 0) + 1;
        totalHeight += h;
     });

     const parts = Object.entries(counts)
        .sort(([h1], [h2]) => Number(h2) - Number(h1))
        .map(([h, c]) => `${c}×${h}mm`);
     
     return (
        <dd className="text-zinc-200 text-right">
           <div>{parts.join(', ')}</div>
           <div className="text-[10px] text-zinc-500">Total: {totalHeight}mm</div>
        </dd>
     );
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-800 text-zinc-100">
      <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
        <h2 className="text-xl font-bold mb-4 font-mono uppercase text-white">Current Item</h2>
        
        {/* Reference Code Box */}
        <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 mb-6">
          <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Configuration Code</label>
          <div className="text-lg font-mono font-bold text-amber-500 break-all select-all">
            {referenceCode}
          </div>
        </div>

        {/* Configuration Details List */}
        <div className="mb-6 space-y-4">
          <h3 className="text-sm font-bold uppercase text-zinc-400 border-b border-zinc-800 pb-1">Specifications</h3>
          
          <dl className="text-sm space-y-2">
             <div className="flex justify-between">
                <dt className="text-zinc-500">Product</dt>
                <dd className="text-zinc-200 text-right">{product.name}</dd>
             </div>
             
             {/* Render selected options */}
             {product.groups.map(group => {
               if (group.type === 'drawer_stack') {
                  // For HD Cabinet, show summary
                  if (product.id === 'prod-hd-cabinet') {
                     return (
                        <div key={group.id} className="flex justify-between items-start">
                           <dt className="text-zinc-500 mt-0.5">{group.label}</dt>
                           {getDrawerSummary()}
                        </div>
                     );
                  }
                  return null;
               }
               
               const val = config.selections[group.id];
               
               if (group.type === 'qty_list') {
                  const qtyMap = val as Record<string, number>;
                  if (!qtyMap) return null;
                  const hasItems = Object.values(qtyMap).some(v => v > 0);
                  if (!hasItems) return null;
                  
                  const count = Object.values(qtyMap).reduce((a, b) => a + b, 0);
                  return (
                     <div key={group.id} className="flex justify-between">
                        <dt className="text-zinc-500">{group.label}</dt>
                        <dd className="text-zinc-200 text-right">{count} Items</dd>
                     </div>
                  );
               }

               if (val === undefined || val === '' || val === null) return null;
               
               let displayVal = '';
               if (group.type === 'checkbox') {
                 displayVal = val ? 'Yes' : 'No';
               } else {
                 const opt = group.options.find(o => o.id === val);
                 displayVal = opt ? opt.label : String(val);
               }
               
               if (displayVal.includes(': None')) return null;

               return (
                 <div key={group.id} className="flex justify-between">
                    <dt className="text-zinc-500">{group.label}</dt>
                    <dd className="text-zinc-200 text-right">{displayVal}</dd>
                 </div>
               );
             })}
          </dl>
        </div>

        {/* Pricing Estimate */}
        <div className="mb-6">
           <h3 className="text-sm font-bold uppercase text-zinc-400 border-b border-zinc-800 pb-1 mb-2">Item Breakdown</h3>
           <div className="flex items-baseline justify-between mb-2">
              <span className="text-zinc-500 text-sm">Unit Price (Ex GST)</span>
              <span className="text-xl font-bold text-white">${pricing.totalPrice.toLocaleString()}</span>
           </div>
           
           {/* Detailed Line Items from Backend */}
           {pricing.breakdown.length > 0 && (
             <div className="mt-2 space-y-1 bg-zinc-950/50 p-3 rounded border border-zinc-800/50">
               {pricing.breakdown.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs group hover:bg-zinc-900 transition-colors rounded px-1 py-1.5 border-b border-zinc-800/30 last:border-0">
                    <div className="flex flex-col">
                       <span className="text-zinc-300 font-medium">
                         {item.label}
                       </span>
                       {item.code && item.code !== item.label && !item.code.includes('SUBTOTAL') && (
                          <span className="text-[10px] text-zinc-500 font-mono mt-0.5">{item.code}</span>
                       )}
                    </div>
                    <span className="font-mono text-zinc-400 group-hover:text-amber-500">${item.price}</span>
                  </div>
               ))}
               <div className="border-t border-zinc-800 pt-1 mt-1 flex justify-between text-xs">
                 <span className="text-zinc-500">GST (10%)</span>
                 <span className="text-zinc-500">${pricing.gst.toLocaleString()}</span>
               </div>
             </div>
           )}
        </div>

      </div>

      {/* FOOTER: ADD TO QUOTE & TOTALS */}
      <div className="p-4 bg-zinc-800 border-t border-zinc-700 shadow-xl z-20">
         <div className="flex items-center gap-4 mb-4">
            <span className="text-xs text-zinc-400 font-bold uppercase">Qty</span>
            <div className="flex items-center bg-zinc-900 rounded border border-zinc-600">
               <button 
                  onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                  className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-l"
               >-</button>
               <input 
                  type="number" 
                  value={quantity}
                  onChange={(e) => onQuantityChange(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-10 h-8 bg-transparent text-center font-bold text-white focus:outline-none text-sm"
               />
               <button 
                  onClick={() => onQuantityChange(quantity + 1)}
                  className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-r"
               >+</button>
            </div>
            <div className="flex-1 text-right">
               <div className="flex justify-end gap-4 text-xs text-zinc-400 mb-1">
                  <span>Ex GST: ${grandTotal.toLocaleString()}</span>
                  <span>GST: ${(pricing.gst * quantity).toLocaleString()}</span>
               </div>
               <div className="text-[10px] text-zinc-500 uppercase">Grand Total (Inc GST)</div>
               <div className="text-2xl font-bold text-white">${(grandTotal + (pricing.gst * quantity)).toLocaleString()}</div>
            </div>
         </div>
         <button 
            onClick={onAddToQuote}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase tracking-wide rounded transition-colors flex items-center justify-center gap-2"
         >
            <span>{isEditingCartItem ? '💾 Update Configuration' : 'Add to Quote'}</span>
            <span className="bg-black/20 px-2 py-0.5 rounded text-xs">
              {isEditingCartItem ? 'Save Changes' : 'Enter Cart'}
            </span>
         </button>
      </div>

      {/* Export Options */}
      <div className="p-4 bg-zinc-900 border-t border-zinc-800">
        <ExportButtons
          configuration={config}
          product={product}
          pricing={pricing}
          referenceCode={referenceCode}
        />
      </div>
    </div>
  );
};

export default SummaryPanel;
