
import React, { useMemo, useState } from 'react';
import { ConfigurationState, ProductDefinition, OptionGroup, DrawerConfiguration, DrawerInteriorType, DrawerInteriorOption, EmbeddedCabinet, DrawerAccessorySelection, LogoTransform } from '../types';
import { resolvePartitionCode, DRAWER_ACCESSORIES, filterAccessoriesForDrawer, resolveAccessoryCode } from '../data/catalog';
import { useCatalog } from '../contexts/CatalogContext';
import { calculateUsedHeight, filterInteriorsForDrawer, normalizeDrawerStack, summarizeDrawers } from '../services/drawerUtils';
import { CheckboxField, ColorField, QtyListField, RadioField, SelectField, LogoUploadField } from './fields/OptionFields';

// Accessory categories for grouping in UI
const ACCESSORY_CATEGORIES = [
  { id: 'partition', label: 'Partitions', icon: '▤' },
  { id: 'divider_steel', label: 'Steel Dividers', icon: '│' },
  { id: 'divider_alu', label: 'Aluminium Dividers', icon: '┃' },
  { id: 'divider_plastic', label: 'Plastic Dividers', icon: '┆' },
  { id: 'tray', label: 'Trays', icon: '▢' },
  { id: 'tray_divider', label: 'Tray Dividers', icon: '┝' },
  { id: 'bin', label: 'Bins', icon: '▣' },
  { id: 'groove_tray', label: 'Groove Trays', icon: '≡' },
  { id: 'groove_divider', label: 'Groove Dividers', icon: '≢' },
  { id: 'foam', label: 'Foam Inserts', icon: '▦' },
  { id: 'tool_support', label: 'Tool Supports', icon: '⚙' },
] as const;

interface ConfiguratorControlsProps {
  product: ProductDefinition;
  config: ConfigurationState;
  onChange: (groupId: string, value: any) => void;
  onCustomDrawerChange?: (stack: DrawerConfiguration[]) => void;
  onBack: () => void;
  activeDrawerIndex: number | null;
  onSelectDrawer: (index: number | null) => void;
  // New props for Embedded Cabinets
  onEmbeddedCabinetChange?: (cabinets: EmbeddedCabinet[]) => void;
  isEditingCartItem?: boolean;
  // Logo upload for Lectrum products
  onLogoChange?: (logoUrl: string | undefined) => void;
  onLogoTransformChange?: (transform: LogoTransform) => void;
  // V50 Data Vault integration for 50 Series
  onConfigureV50?: () => void;
  v50CountInQuote?: number;
}

const ConfiguratorControls: React.FC<ConfiguratorControlsProps> = ({ 
  product, 
  config, 
  onChange, 
  onCustomDrawerChange, 
  onBack,
  activeDrawerIndex,
  onSelectDrawer,
  onEmbeddedCabinetChange,
  isEditingCartItem = false,
  onLogoChange,
  onLogoTransformChange,
  onConfigureV50,
  v50CountInQuote = 0
}) => {
  
  const { interiors, products } = useCatalog();
  
  // State for Embedded Cabinet Config Modal
  const [editingCabinet, setEditingCabinet] = useState<EmbeddedCabinet | null>(null);

  // State for Interior Configurator tabs (lifted to parent to persist across re-renders)
  const [interiorActiveTab, setInteriorActiveTab] = useState<DrawerInteriorType>('partition_set');
  const [interiorConfigMode, setInteriorConfigMode] = useState<'sets' | 'accessories'>('sets');
  const [interiorAccessoryCategory, setInteriorAccessoryCategory] = useState<string>('partition');

  // Helper to extract Cabinet Dimensions
  const getCabinetDimensions = () => {
    const wGroup = product.groups.find(g => g.id === 'width');
    const dGroup = product.groups.find(g => g.id === 'series');
    
    const wId = config.selections['width'];
    const dId = config.selections['series'];

    const wOpt = wGroup?.options.find(o => o.id === wId);
    const dOpt = dGroup?.options.find(o => o.id === dId);

    return {
      width: (wOpt?.value as number) || 710,
      depth: (dOpt?.value as number) || 605,
      widthCode: wOpt?.code,
      depthCode: dOpt?.code
    };
  };

  const SectionTitle = ({ title, step }: { title: string, step: number }) => (
    <h3 className="text-amber-500 text-sm font-bold uppercase tracking-wider mb-3 mt-6 border-b border-zinc-700 pb-1 flex justify-between">
      <span>{step}. {title}</span>
    </h3>
  );

  const getCabinetCapacity = (prod = product, cfg = config, isEmbedded = false) => {
    // Embedded cabinets in workbenches always use BTCD.810.560 with 675mm usable height
    if (isEmbedded) {
      return 675;
    }
    
    const heightGroupId = 'height';
    const heightGroup = prod.groups.find(g => g.id === heightGroupId);
    if (!heightGroup) return 9999;

    const selectedHeightId = cfg.selections[heightGroupId];
    const selectedOption = heightGroup.options.find(o => o.id === selectedHeightId);

    return selectedOption?.meta?.usableHeight || 750;
  };

  // --- SUB-COMPONENT: DRAWER INTERIOR CONFIG ---
  // Note: activeTab, configMode, accessoryCategory state is lifted to parent to persist across re-renders
  const InteriorConfigurator = ({ group, currentConfig, onDrawerStackChange }: { group: OptionGroup, currentConfig: ConfigurationState, onDrawerStackChange?: (stack: DrawerConfiguration[]) => void }) => {
     // Use lifted state from parent (avoids reset on re-render)
     const activeTab = interiorActiveTab;
     const setActiveTab = setInteriorActiveTab;
     const configMode = interiorConfigMode;
     const setConfigMode = setInteriorConfigMode;
     const accessoryCategory = interiorAccessoryCategory;
     const setAccessoryCategory = setInteriorAccessoryCategory;

     if (activeDrawerIndex === null) return null;
     
     const drawerConfig = currentConfig.customDrawers[activeDrawerIndex];
     const drawerOpt = group.options.find(o => o.id === drawerConfig.id);
     
     if (!drawerOpt) return null;

     const drawerHeight = drawerOpt.meta?.front || 100;
     
    let width = 710;
    let depth = 755;
    let depthType: 'S' | 'D' = 'D';
     
     if (editingCabinet) {
        // Hardcode for BTCD.850.560 as per requirement
        width = 560;
        depth = 755; 
     } else {
        const dims = getCabinetDimensions();
        width = dims.width;
        depth = dims.depth;
    }
    
    depthType = depth > 700 ? 'D' : 'S';
    const allOptions = filterInteriorsForDrawer(interiors, width, depthType, drawerHeight);
     const tabOptions = allOptions.filter(o => o.type === activeTab);
     
     // Get compatible accessories for this drawer height
     const compatibleAccessories = filterAccessoriesForDrawer(DRAWER_ACCESSORIES, drawerHeight);
     const categoryAccessories = compatibleAccessories.filter(a => a.category === accessoryCategory);

     const handleSelectInterior = (partId: string) => {
        const newStack = [...currentConfig.customDrawers];
        newStack[activeDrawerIndex] = { ...newStack[activeDrawerIndex], interiorId: partId };
        if (onDrawerStackChange) onDrawerStackChange(newStack);
     };

     const handleClearInterior = () => {
        const newStack = [...currentConfig.customDrawers];
        newStack[activeDrawerIndex] = { ...newStack[activeDrawerIndex], interiorId: undefined };
        if (onDrawerStackChange) onDrawerStackChange(newStack);
     };

     // Accessory quantity handlers
     const getAccessoryQty = (accessoryId: string): number => {
        const selection = drawerConfig.accessories?.find(a => a.accessoryId === accessoryId);
        return selection?.quantity || 0;
     };

     const handleAccessoryQtyChange = (accessoryId: string, qty: number) => {
        const newStack = [...currentConfig.customDrawers];
        const currentDrawer = { ...newStack[activeDrawerIndex] };
        
        let accessories = [...(currentDrawer.accessories || [])];
        const existingIdx = accessories.findIndex(a => a.accessoryId === accessoryId);
        
        if (qty <= 0) {
           // Remove if qty is 0
           if (existingIdx >= 0) {
              accessories.splice(existingIdx, 1);
           }
        } else {
           if (existingIdx >= 0) {
              accessories[existingIdx] = { accessoryId, quantity: qty };
           } else {
              accessories.push({ accessoryId, quantity: qty });
           }
        }
        
        currentDrawer.accessories = accessories.length > 0 ? accessories : undefined;
        newStack[activeDrawerIndex] = currentDrawer;
        if (onDrawerStackChange) onDrawerStackChange(newStack);
     };

     // Calculate total accessories cost for this drawer
     const totalAccessoriesCost = (drawerConfig.accessories || []).reduce((sum, sel) => {
        const acc = DRAWER_ACCESSORIES.find(a => a.id === sel.accessoryId);
        return sum + (acc ? acc.price * sel.quantity : 0);
     }, 0);

     const Tabs = () => (
        <div className="flex border-b border-zinc-700 mb-4">
           {[
              { id: 'partition_set', label: 'Partitions' },
              { id: 'bin_set', label: 'Bin Sets' },
              { id: 'mixed_set', label: 'Mixed Sets' }
           ].map(tab => (
              <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as DrawerInteriorType)}
                 className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors
                    ${activeTab === tab.id ? 'border-amber-500 text-amber-500' : 'border-transparent text-zinc-500 hover:text-zinc-300'}
                 `}
              >
                 {tab.label}
              </button>
           ))}
        </div>
     );

     // Mode toggle between Sets and Individual Accessories
     const ModeToggle = () => (
        <div className="flex mb-4 bg-zinc-900 rounded-lg p-1 border border-zinc-700">
           <button
              onClick={() => setConfigMode('sets')}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded transition-all ${configMode === 'sets' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'}`}
           >
              Pre-Configured Sets
           </button>
           <button
              onClick={() => setConfigMode('accessories')}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded transition-all ${configMode === 'accessories' ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'}`}
           >
              Individual Accessories
           </button>
        </div>
     );

     // Accessory category tabs
     const AccessoryCategoryTabs = () => {
        const availableCategories = ACCESSORY_CATEGORIES.filter(cat => 
           compatibleAccessories.some(a => a.category === cat.id)
        );
        
        return (
           <div className="flex flex-wrap gap-1 mb-4">
              {availableCategories.map(cat => (
                 <button
                    key={cat.id}
                    onClick={() => setAccessoryCategory(cat.id)}
                    className={`px-2 py-1 text-[10px] font-bold rounded border transition-all ${accessoryCategory === cat.id 
                       ? 'bg-amber-500/20 border-amber-500 text-amber-500' 
                       : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'}`}
                 >
                    <span className="mr-1">{cat.icon}</span>
                    {cat.label}
                 </button>
              ))}
           </div>
        );
     };

     return (
        <div className="bg-zinc-800 p-4 rounded-lg border border-amber-500/50 animate-in fade-in zoom-in-95 duration-200">
           <div className="flex justify-between items-center mb-4 border-b border-zinc-700 pb-2">
              <h4 className="font-bold text-white flex items-center gap-2">
                 <span>📂 Drawer {activeDrawerIndex + 1}</span>
                 <span className="text-xs font-normal text-zinc-400">({drawerOpt.label})</span>
              </h4>
              <button onClick={() => onSelectDrawer(null)} className="text-xs text-amber-500 hover:text-white">
                 Done
              </button>
           </div>
           
           <div className="mb-4 space-y-1">
              <p className="text-xs text-zinc-400">
                 Configuring for <strong>{width}mm Wide</strong> x <strong>{depth > 700 ? 'Deep' : 'Standard'}</strong> Depth.
              </p>
              <div className="flex items-center gap-2 bg-zinc-900/50 px-2 py-1.5 rounded border border-zinc-700/50">
                 <span className="text-[10px] text-zinc-500 uppercase font-bold">Load Capacity:</span>
                 <span className="text-xs text-amber-500 font-bold">{drawerOpt?.meta?.loadCapacity || 200}kg</span>
                 <span className="text-[10px] text-zinc-600">• Full Extension Runner</span>
              </div>
           </div>

           <ModeToggle />

           {configMode === 'sets' ? (
              <>
                 <Tabs />
                 <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    <button 
                       onClick={handleClearInterior}
                       className={`w-full text-left p-3 rounded border text-xs mb-2 transition-all ${!drawerConfig.interiorId ? 'bg-amber-900/20 border-amber-500 text-amber-500' : 'bg-zinc-900 border-zinc-700 text-zinc-400'}`}
                    >
                       No Interior (Empty)
                    </button>

                    {tabOptions.length === 0 ? (
                       <div className="text-zinc-500 text-xs text-center py-4 italic bg-zinc-900/50 rounded flex flex-col gap-2">
                          <span>No {activeTab.replace('_', ' ')}s available for this drawer size ({drawerHeight}mm).</span>
                          {allOptions.length === 0 && (
                              <span className="text-red-400">No compatible interiors found for {width}mm width.</span>
                          )}
                       </div>
                    ) : (
                       tabOptions.map(part => {
                          const isSelected = drawerConfig.interiorId === part.id;
                          const finalCode = resolvePartitionCode(part, drawerHeight);
                          
                          return (
                             <button
                                key={part.id}
                                onClick={() => handleSelectInterior(part.id)}
                                className={`
                                   w-full text-left p-3 rounded border transition-all flex justify-between items-start group relative overflow-hidden
                                   ${isSelected 
                                      ? 'bg-zinc-700 border-amber-500 text-white shadow-[0_0_10px_rgba(245,158,11,0.2)]' 
                                      : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500'}
                                `}
                             >
                                <div className="flex-1 pr-2 z-10">
                                   <div className="font-bold text-xs group-hover:text-amber-500 transition-colors mb-0.5">{part.layout_description}</div>
                                   <div className="text-[10px] text-zinc-500 font-mono mb-1">{finalCode}</div>
                                   {part.components_summary && (
                                      <div className="text-[10px] text-zinc-400 leading-tight italic border-t border-zinc-700/50 pt-1 mt-1">{part.components_summary}</div>
                                   )}
                                </div>
                                <div className="text-right z-10">
                                   <div className="text-xs font-bold text-amber-500">${part.price}</div>
                                </div>
                             </button>
                          )
                       })
                    )}
                 </div>
              </>
           ) : (
              <>
                 <AccessoryCategoryTabs />
                 
                 {/* Show current accessories cost */}
                 {totalAccessoriesCost > 0 && (
                    <div className="mb-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded text-xs">
                       <div className="flex justify-between items-center">
                          <span className="text-zinc-400">Accessories for this drawer:</span>
                          <span className="font-bold text-amber-500">${totalAccessoriesCost}</span>
                       </div>
                    </div>
                 )}
                 
                 <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                    {categoryAccessories.length === 0 ? (
                       <div className="text-zinc-500 text-xs text-center py-4 italic bg-zinc-900/50 rounded">
                          No {ACCESSORY_CATEGORIES.find(c => c.id === accessoryCategory)?.label || 'accessories'} available for {drawerHeight}mm drawers.
                       </div>
                    ) : (
                       categoryAccessories.map(acc => {
                          const qty = getAccessoryQty(acc.id);
                          const finalCode = resolveAccessoryCode(acc, drawerHeight);
                          
                          return (
                             <div
                                key={acc.id}
                                className={`p-3 rounded border transition-all ${qty > 0 
                                   ? 'bg-zinc-700 border-amber-500/50' 
                                   : 'bg-zinc-900 border-zinc-700'}`}
                             >
                                <div className="flex justify-between items-start mb-2">
                                   <div className="flex-1">
                                      <div className="font-bold text-xs text-zinc-200">{acc.name}</div>
                                      <div className="text-[10px] text-zinc-500 font-mono">{finalCode}</div>
                                      <div className="text-[10px] text-zinc-400 mt-0.5">{acc.description}</div>
                                   </div>
                                   <div className="text-right">
                                      <div className="text-xs font-bold text-amber-500">${acc.price}</div>
                                      <div className="text-[10px] text-zinc-500">each</div>
                                   </div>
                                </div>
                                <div className="flex items-center gap-2">
                                   <button
                                      onClick={() => handleAccessoryQtyChange(acc.id, Math.max(0, qty - 1))}
                                      className="w-7 h-7 rounded bg-zinc-800 border border-zinc-600 text-zinc-400 hover:text-white hover:border-zinc-400 transition-colors flex items-center justify-center text-sm font-bold"
                                   >
                                      −
                                   </button>
                                   <input
                                      type="number"
                                      min="0"
                                      value={qty}
                                      onChange={(e) => handleAccessoryQtyChange(acc.id, Math.max(0, parseInt(e.target.value) || 0))}
                                      className="w-12 h-7 bg-zinc-800 border border-zinc-600 rounded text-center text-white text-xs font-bold focus:outline-none focus:border-amber-500"
                                   />
                                   <button
                                      onClick={() => handleAccessoryQtyChange(acc.id, qty + 1)}
                                      className="w-7 h-7 rounded bg-zinc-800 border border-zinc-600 text-zinc-400 hover:text-white hover:border-zinc-400 transition-colors flex items-center justify-center text-sm font-bold"
                                   >
                                      +
                                   </button>
                                   {qty > 0 && (
                                      <span className="ml-auto text-xs font-bold text-amber-500">
                                         = ${acc.price * qty}
                                      </span>
                                   )}
                                </div>
                             </div>
                          )
                       })
                    )}
                 </div>
              </>
           )}
        </div>
     );
  };

  // --- SUB-COMPONENT: DRAWER STACK BUILDER ---
  const DrawerStackBuilder = ({ group, currentConfig, currentProduct, onDrawerStackChange, isEmbeddedCabinet = false }: { group: OptionGroup, currentConfig: ConfigurationState, currentProduct: ProductDefinition, onDrawerStackChange?: (stack: DrawerConfiguration[]) => void, isEmbeddedCabinet?: boolean }) => {
    const capacity = getCabinetCapacity(currentProduct, currentConfig, isEmbeddedCabinet);
    
    const currentUsage = useMemo(() => {
       return calculateUsedHeight(currentConfig.customDrawers, group);
    }, [currentConfig.customDrawers, group]);

    const remaining = capacity - currentUsage;
    const usagePercent = Math.min(100, (currentUsage / capacity) * 100);

    const handleAddDrawer = (drawerId: string) => {
      const drawerOpt = group.options.find(o => o.id === drawerId);
      if (!drawerOpt) return;
      if (remaining >= (drawerOpt.meta?.front || 0)) {
         let newStack = [...currentConfig.customDrawers, { id: drawerId }];
         // AUTO SORT: Smallest at TOP (Index 0), Largest at BOTTOM (Index N)
         newStack = normalizeDrawerStack(newStack, group);
         
         if (onDrawerStackChange) onDrawerStackChange(newStack);
      }
    };

    const handleRemoveDrawer = (index: number) => {
      const newStack = [...currentConfig.customDrawers];
      newStack.splice(index, 1);
      if (activeDrawerIndex === index) onSelectDrawer(null);
      if (onDrawerStackChange) onDrawerStackChange(newStack);
    };

    if (activeDrawerIndex !== null) {
       return <InteriorConfigurator group={group} currentConfig={currentConfig} onDrawerStackChange={onDrawerStackChange} />;
    }

    const visibleDrawerOptions = (group.options || []).filter(o => o.isVisible !== false);

    return (
      <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
         <div className="mb-4">
            <div className="flex justify-between text-xs font-mono mb-1">
               <span className="text-zinc-400">Used: {currentUsage}mm</span>
               <span className={remaining < 50 ? 'text-red-500' : 'text-green-500'}>
                 Rem: {remaining}mm / {capacity}mm
               </span>
            </div>
            <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
               <div 
                  className={`h-full transition-all duration-300 ${remaining < 0 ? 'bg-red-500' : 'bg-amber-500'}`} 
                  style={{ width: `${usagePercent}%` }}
               />
            </div>
         </div>
         <div className="mb-4">
            <h4 className="text-xs font-bold text-zinc-500 mb-2 uppercase">Add Drawer Module</h4>
            <div className="grid grid-cols-3 gap-2">
               {visibleDrawerOptions.map(opt => {
                  const h = opt.meta?.front || 0;
                  const disabled = remaining < h;
                  return (
                     <button key={opt.id} onClick={() => handleAddDrawer(opt.id)} disabled={disabled}
                        className={`px-2 py-2 text-xs font-bold rounded border transition-all flex flex-col items-center justify-center ${disabled ? 'opacity-30 border-zinc-700 cursor-not-allowed text-zinc-600' : 'bg-zinc-800 border-zinc-600 hover:border-amber-500 text-zinc-200 hover:text-white'}`}>
                        <span>{opt.label.replace(' Drawer', '')}</span>
                        <span className="font-mono text-[10px] text-zinc-500">{h}mm</span>
                     </button>
                  )
               })}
            </div>
         </div>
         <div>
            <h4 className="text-xs font-bold text-zinc-500 mb-2 uppercase flex justify-between items-center">
               <span>Current Stack (Top to Bottom)</span>
               {currentConfig.customDrawers.length > 0 && (
                  <button onClick={() => onDrawerStackChange && onDrawerStackChange([])} className="text-[10px] text-red-400 hover:text-red-300 underline">Clear All</button>
               )}
            </h4>
            {currentConfig.customDrawers.length === 0 ? (
               <div className="text-xs text-zinc-600 text-center py-4 border border-dashed border-zinc-700 rounded">No drawers added.</div>
            ) : (
               <div className="space-y-1"> 
                  {currentConfig.customDrawers.map((drawer, idx) => {
                     const opt = group.options.find(o => o.id === drawer.id);
                     const interior = drawer.interiorId ? interiors.find(i => i.id === drawer.interiorId) : null;
                     const accessoryCount = drawer.accessories?.reduce((sum, a) => sum + a.quantity, 0) || 0;
                     const hasConfig = interior || accessoryCount > 0;
                     return (
                        <div key={`${drawer.id}-${idx}`} className="flex items-center justify-between bg-zinc-900 border border-zinc-700 p-2 rounded text-xs hover:border-zinc-500 group transition-all">
                           <div className="flex-1 cursor-pointer" onClick={() => onSelectDrawer(idx)}>
                              <div className="flex items-center gap-2">
                                 <div className="w-6 text-center text-zinc-600 font-mono text-[10px]">{idx + 1}</div>
                                 <div className={`w-1 h-6 rounded-full transition-colors ${hasConfig ? 'bg-amber-500' : 'bg-zinc-700 group-hover:bg-amber-500'}`}></div>
                                 <div className="flex flex-col">
                                    <span className="font-mono font-bold text-zinc-300 group-hover:text-white">{opt?.meta?.front}mm Front</span>
                                    {interior ? (
                                       <span className="text-[10px] text-amber-500 font-medium">{interior.layout_description}</span>
                                    ) : accessoryCount > 0 ? (
                                       <span className="text-[10px] text-blue-400 font-medium">{accessoryCount} accessory item{accessoryCount > 1 ? 's' : ''}</span>
                                    ) : (
                                       <span className="text-[10px] text-zinc-600">Empty • Click to configure</span>
                                    )}
                                    {interior && accessoryCount > 0 && (
                                       <span className="text-[10px] text-blue-400">+ {accessoryCount} accessory item{accessoryCount > 1 ? 's' : ''}</span>
                                    )}
                                 </div>
                              </div>
                           </div>
                           <button onClick={() => handleRemoveDrawer(idx)} className="text-zinc-500 hover:text-red-500 px-2 py-1" title="Remove">×</button>
                        </div>
                     );
                  })} 
               </div>
            )}
         </div>
      </div>
    );
  };

  // --- EMBEDDED CABINET LOGIC ---
  
  const openCabinetConfig = (placement: 'left' | 'right') => {
     // Check if existing embedded config exists
     const existing = config.embeddedCabinets?.find(c => c.placement === placement);
     
     if (existing) {
        setEditingCabinet(existing);
     } else {
        // Initialize new embedded cabinet state
        // BTCD.850.560 integrated specs: 810mm high, 675mm usable, 560mm wide, 755mm deep
        setEditingCabinet({
           id: `emb-${Date.now()}`,
           placement,
           configuration: {
              productId: 'prod-hd-cabinet',
              selections: {
                 'series': 'series-d', // D Series (755mm deep)
                 'width': 'w-560', // 560mm wide
                 'height': 'h-810', // 810mm high with 675mm usable (embedded cabinet)
                 'housing_color': config.selections['color'] || 'col-mg', // Inherit from bench
                 'facia_color': config.selections['drawer_facia'] || 'col-sg', // Inherit from bench
              },
              customDrawers: [], // Start empty
              notes: '',
              internalReference: ''
           }
        });
     }
  };

  const handleEmbeddedSave = () => {
     if (!editingCabinet) return;
     
     // Enforce Sort on Save just in case
     const hdProduct = products.find(p => p.id === 'prod-hd-cabinet');
     const group = hdProduct?.groups.find(g => g.type === 'drawer_stack');
     
     let finalDrawers = editingCabinet.configuration.customDrawers;
     if (group) {
        finalDrawers = normalizeDrawerStack(finalDrawers, group);
     }

     const finalCabinet = {
        ...editingCabinet,
        configuration: {
           ...editingCabinet.configuration,
           customDrawers: finalDrawers
        }
     };
     
     const currentEmbedded = config.embeddedCabinets || [];
     const filtered = currentEmbedded.filter(c => c.placement !== editingCabinet.placement);
     const newEmbeddedList = [...filtered, finalCabinet];
     
     if (onEmbeddedCabinetChange) onEmbeddedCabinetChange(newEmbeddedList);
     setEditingCabinet(null);
     onSelectDrawer(null); 
  };

  const handleEmbeddedCancel = () => {
     setEditingCabinet(null);
     onSelectDrawer(null);
  };

  // --- RENDER ---

  // If in Embedded Modal Mode
  if (editingCabinet) {
     const hdProduct = products.find(p => p.id === 'prod-hd-cabinet');
     if (!hdProduct) return <div>Error: HD Cabinet definition not found.</div>;

     return (
        <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-zinc-900 w-full max-w-lg h-full max-h-[800px] border border-zinc-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-800">
                 <h2 className="text-lg font-bold text-white">Configure {editingCabinet.placement === 'left' ? 'Left' : 'Right'} Cabinet</h2>
                 <button onClick={handleEmbeddedCancel} className="text-zinc-400 hover:text-white">✕</button>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                 <p className="text-sm text-zinc-400 mb-4 bg-blue-900/20 p-3 rounded border border-blue-800/50">
                    <strong>High Density Cabinet (BTCD.810.560)</strong><br/>
                    810mm High, 560mm Wide, 755mm Deep. <br/>
                    <span className="text-amber-500">Usable drawer height: 675mm</span><br/>
                    Configure your drawer stack below.
                 </p>

                 {hdProduct.groups.filter(g => g.type === 'drawer_stack').map(group => (
                    <div key={group.id}>
                       <SectionTitle step={1} title="Drawer Configuration" />
                       <DrawerStackBuilder
                          group={group}
                          currentConfig={editingCabinet.configuration}
                          currentProduct={hdProduct}
                          isEmbeddedCabinet={true}
                          onDrawerStackChange={(newStack) => {
                             setEditingCabinet({
                                ...editingCabinet,
                                configuration: {
                                   ...editingCabinet.configuration,
                                   customDrawers: newStack
                                }
                             });
                          }}
                       />
                    </div>
                 ))}
              </div>

              <div className="p-4 border-t border-zinc-800 bg-zinc-800 flex justify-end gap-3">
                 <button onClick={handleEmbeddedCancel} className="px-4 py-2 text-sm text-zinc-300 hover:text-white">Cancel</button>
                 <button onClick={handleEmbeddedSave} className="px-6 py-2 text-sm font-bold bg-amber-500 text-black rounded hover:bg-amber-400">Save Configuration</button>
              </div>
           </div>
        </div>
     );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-2 pb-8">
        
        <button 
          onClick={onBack}
          className="px-4 py-2 text-sm font-bold text-black bg-amber-500 hover:bg-amber-400 rounded-lg flex items-center gap-2 mb-4 transition-all"
        >
          <span>←</span>
          Back to Product List
        </button>

        {isEditingCartItem && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-amber-500 text-lg">✏️</span>
              <div>
                <div className="text-amber-500 font-bold text-sm">Editing Cart Item</div>
                <div className="text-amber-400/80 text-xs">Make your changes and click "Update Configuration"</div>
              </div>
            </div>
          </div>
        )}

        <h2 className="text-xl font-bold text-white mb-1">{product.name}</h2>
        <p className="text-xs text-zinc-400 mb-4">{product.description}</p>

        {product.groups.sort((a,b) => (a.step||0) - (b.step||0)).map((group) => {
          // --- VISIBILITY CHECKS ---
          if (group.id === 'under_bench_pos') {
             const underBenchVal = config.selections['under_bench'];
             if (!underBenchVal || underBenchVal === 'B0') return null;
          }
          if (group.id === 'shelf_incline') {
             const aboveBenchVal = config.selections['above_bench'];
             if (!aboveBenchVal || aboveBenchVal === 'T0') return null;
          }
          if (group.id === 'hanging_kits' || group.id === 'individual_accessories') {
             const aboveBenchVal = config.selections['above_bench'];
             const panelOptions = ['T3', 'T4', 'T5', 'T6', 'T7', 'T8'];
             if (!panelOptions.includes(aboveBenchVal)) return null;
          }
          
          const visibleOptions = group.options?.filter(o => o.isVisible !== false) || [];
          // Always show drawer_stack group even if options seem weird, logic inside builder handles it.
          // qty type groups don't have options, so skip this check for them
          if (visibleOptions.length === 0 && group.type !== 'drawer_stack' && group.type !== 'qty') return null;

          return (
            <div key={group.id}>
              <SectionTitle step={group.step || 1} title={group.label} />
              
              {group.type === 'drawer_stack' && (
                 <DrawerStackBuilder 
                    group={group} 
                    currentConfig={config} 
                    currentProduct={product}
                    onDrawerStackChange={onCustomDrawerChange}
                 />
              )}
              
              {group.type === 'qty_list' && (
                <>
                  <QtyListField 
                    group={group} 
                    values={(config.selections[group.id] as Record<string, number>) || {}} 
                    onChange={(vals) => onChange(group.id, vals)}
                    onConfigureV50={product.series === '50' ? onConfigureV50 : undefined}
                    v50Count={product.series === '50' ? v50CountInQuote : undefined}
                  />
                  {/* Logo upload for Lectrum products with logo accessories */}
                  {product.id.startsWith('lectrum-') && group.id === 'accessories' && onLogoChange && (
                    <>
                      <LogoUploadField
                        logoImageUrl={config.logoImageUrl}
                        onLogoChange={onLogoChange}
                        hasLogoAccessory={(() => {
                          const logoIds = ['logo-insert-aero-top', 'logo-panel-aero-400', 'logo-panel-aero-full',
                                          'logo-panel-classic-400', 'logo-panel-classic-full', 'crystalite-logo-classic'];
                          const accessories = config.selections[group.id] as Record<string, number> | undefined;
                          return logoIds.some(id => (accessories?.[id] || 0) > 0);
                        })()}
                      />
                      {onLogoTransformChange && (
                        <div className="mt-3 p-3 border border-zinc-700 rounded bg-zinc-900/60 space-y-3">
                          <div className="text-xs font-semibold text-zinc-200">Logo placement</div>
                          {(() => {
                            const t = config.logoTransform || { scale: 0.3, offsetX: 0, offsetY: 0, offsetZ: 0, tilt: 0 };
                            const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
                            const updateTransform = (patch: Partial<LogoTransform>) => {
                              const next = { scale: t.scale, offsetX: t.offsetX, offsetY: t.offsetY, offsetZ: t.offsetZ || 0, tilt: t.tilt || 0, ...patch };
                              next.scale = clamp(next.scale, 0, 1);       // 0..1 (0 hides, 1 fits)
                              next.offsetX = clamp(next.offsetX, -2, 2); // allow more travel
                              next.offsetY = clamp(next.offsetY, -2, 2);
                              next.offsetZ = clamp(next.offsetZ || 0, -2, 2);
                              next.tilt = clamp(next.tilt || 0, -1, 1);
                              onLogoTransformChange(next);
                            };
                            return (
                              <div className="space-y-3">
                                <div>
                                  <div className="flex justify-between text-[11px] text-zinc-400">
                                    <span>Scale</span>
                                    <span>{Math.round(t.scale * 100)}%</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={t.scale}
                                    onChange={(e) => updateTransform({ scale: parseFloat(e.target.value) })}
                                    className="w-full accent-amber-500"
                                  />
                                </div>
                                <div>
                                  <div className="flex justify-between text-[11px] text-zinc-400">
                                    <span>Offset X</span>
                                    <span>{(t.offsetX * 50).toFixed(0)}%</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="-2"
                                    max="2"
                                    step="0.01"
                                    value={t.offsetX}
                                    onChange={(e) => updateTransform({ offsetX: parseFloat(e.target.value) })}
                                    className="w-full accent-amber-500"
                                  />
                                </div>
                                <div>
                                  <div className="flex justify-between text-[11px] text-zinc-400">
                                    <span>Offset Y</span>
                                    <span>{(t.offsetY * 50).toFixed(0)}%</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="-2"
                                    max="2"
                                    step="0.01"
                                    value={t.offsetY}
                                    onChange={(e) => updateTransform({ offsetY: parseFloat(e.target.value) })}
                                    className="w-full accent-amber-500"
                                  />
                                </div>
                                <div>
                                  <div className="flex justify-between text-[11px] text-zinc-400">
                                    <span>Offset Z (Depth)</span>
                                    <span>{((t.offsetZ || 0) * 50).toFixed(0)}%</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="-2"
                                    max="2"
                                    step="0.01"
                                    value={t.offsetZ || 0}
                                    onChange={(e) => updateTransform({ offsetZ: parseFloat(e.target.value) })}
                                    className="w-full accent-amber-500"
                                  />
                                </div>
                                <div>
                                  <div className="flex justify-between text-[11px] text-zinc-400">
                                    <span>Tilt (Forward/Back)</span>
                                    <span>{((t.tilt || 0) * 45).toFixed(0)}°</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="-1"
                                    max="1"
                                    step="0.01"
                                    value={t.tilt || 0}
                                    onChange={(e) => updateTransform({ tilt: parseFloat(e.target.value) })}
                                    className="w-full accent-amber-500"
                                  />
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* INDUSTRIAL WORKBENCH SPECIFIC: EMBEDDED CABINET TRIGGER */}
              {product.id === 'prod-workbench-industrial' && group.id === 'under_bench' && (
                 <div className="mb-4">
                    <div className="space-y-2 mb-3">
                        <select
                          value={config.selections[group.id] as string || ''}
                          onChange={(e) => onChange(group.id, e.target.value)}
                          className="w-full bg-zinc-800 text-zinc-100 border border-zinc-600 rounded p-3 text-sm focus:border-amber-500 focus:outline-none"
                        >
                          <option value="" disabled>Select an option</option>
                          {visibleOptions.map(opt => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label} {opt.priceDelta && opt.priceDelta > 0 ? `(+$${opt.priceDelta})` : ''}
                            </option>
                          ))}
                        </select>
                    </div>

                    {(() => {
                       const sel = config.selections['under_bench'];
                       if (!sel) return null;
                       
                       const isCabinet = sel.includes('cabinet') || sel.includes('cab');
                       const isSingle = sel.includes('cabinet-1') || sel.includes('cab1') || sel.includes('shelf_cab') || sel.includes('hs_dr_cab');
                       const isDual = sel.includes('cabinet-2') || sel.includes('cab2');
                       const isCabMixed = sel.includes('cabinet-door') || sel.includes('cab_door') || sel.includes('cab_dr') || sel.includes('cabinet-drawer');
                       
                       const pos = config.selections['under_bench_pos']; 
                       const isLeft = pos === 'pos-left' || pos === 'left';
                       
                       const showLeft = isDual || isCabMixed || (isSingle && isLeft);
                       const showRight = isDual || (isSingle && !isLeft);

                       if (!isCabinet) return null;

                       const hdProduct = products.find(p => p.id === 'prod-hd-cabinet');
                       const drawerGroup = hdProduct?.groups.find(g => g.type === 'drawer_stack');

                       return (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                             {showLeft && (
                                <button 
                                   onClick={() => openCabinetConfig('left')}
                                   className={`p-3 rounded text-left border transition-colors relative overflow-hidden group
                                      ${config.embeddedCabinets?.find(c => c.placement === 'left') 
                                         ? 'bg-zinc-800 border-amber-500' 
                                         : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'}
                                   `}
                                >
                                   <div className="text-xs font-bold text-white mb-1">Left Cabinet</div>
                                   <div className="text-[10px] text-zinc-400">
                                     {(() => {
                                       const leftCab = config.embeddedCabinets?.find(c => c.placement === 'left');
                                       if (!leftCab) return 'Click to configure';
                                       if (!drawerGroup) return 'Drawer set';
                                       return summarizeDrawers(leftCab.configuration.customDrawers, drawerGroup);
                                     })()}
                                   </div>
                                   {config.embeddedCabinets?.find(c => c.placement === 'left') && (
                                      <div className="absolute top-2 right-2 text-amber-500 text-xs font-bold">✓</div>
                                   )}
                                </button>
                             )}
                             
                             {showRight && (
                                <button 
                                   onClick={() => openCabinetConfig('right')}
                                   className={`p-3 rounded text-left border transition-colors relative overflow-hidden group
                                      ${config.embeddedCabinets?.find(c => c.placement === 'right') 
                                         ? 'bg-zinc-800 border-amber-500' 
                                         : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'}
                                   `}
                                >
                                   <div className="text-xs font-bold text-white mb-1">Right Cabinet</div>
                                   <div className="text-[10px] text-zinc-400">
                                     {(() => {
                                       const rightCab = config.embeddedCabinets?.find(c => c.placement === 'right');
                                       if (!rightCab) return 'Click to configure';
                                       if (!drawerGroup) return 'Drawer set';
                                       return summarizeDrawers(rightCab.configuration.customDrawers, drawerGroup);
                                     })()}
                                   </div>
                                   {config.embeddedCabinets?.find(c => c.placement === 'right') && (
                                      <div className="absolute top-2 right-2 text-amber-500 text-xs font-bold">✓</div>
                                   )}
                                </button>
                             )}
                          </div>
                       );
                    })()}
                 </div>
              )}

              {activeDrawerIndex === null && group.type !== 'drawer_stack' && group.type !== 'qty_list' && 
                // Only skip under_bench for industrial (it has custom block above). 
                // For Heavy Duty, we WANT this standard block to render it.
                !(product.id === 'prod-workbench-industrial' && group.id === 'under_bench') && (
                 <>
                    {group.type === 'radio' && (
                      <RadioField 
                        group={group} 
                        options={visibleOptions} 
                        value={config.selections[group.id] as string} 
                        onChange={(val) => onChange(group.id, val)} 
                      />
                    )}

                    {group.type === 'select' && (
                      <div className="space-y-2">
                        <SelectField 
                          group={group} 
                          options={visibleOptions} 
                          value={(config.selections[group.id] as string) || ''} 
                          onChange={(val) => onChange(group.id, val)} 
                        />
                        {group.id === 'hanging_kits' && config.selections[group.id] && config.selections[group.id] !== 'none' && (
                           <div className="text-xs text-zinc-400 mt-2 bg-zinc-800 p-2 rounded border border-zinc-700">
                               ℹ️ {group.options.find(o => o.id === config.selections[group.id])?.description}
                           </div>
                        )}
                        {group.id === 'under_bench' && ['B1', 'B2', 'B3'].includes(config.selections[group.id]) && (
                           <div className="text-xs text-yellow-500 bg-yellow-900/20 p-2 rounded border border-yellow-700/50 flex items-start gap-2 mt-2">
                              <span>⚠️</span>
                              <span><strong>Required:</strong> If a fixed drawer unit is selected, ensure suitable frame support or under-shelf is added.</span>
                           </div>
                        )}
                      </div>
                    )}

                    {group.type === 'checkbox' && (
                       <div className="space-y-2">
                         {visibleOptions.map(opt => (
                           <div key={opt.id}>
                             <CheckboxField 
                               option={opt} 
                               checked={config.selections[group.id] === true} 
                               onChange={(checked) => onChange(group.id, checked)} 
                             />
                             {group.id === 'mobility' && opt.id === 'castors' && config.selections[group.id] === true && (
                                <div className="mt-2 text-xs text-yellow-500 bg-yellow-900/20 p-2 rounded border border-yellow-700/50">
                                   ⚠️ <strong>Load rating reduced</strong> when mobile. Contact Opie for critical load applications.
                                </div>
                             )}
                           </div>
                         ))}
                       </div>
                    )}

                    {group.type === 'qty' && (
                       <div className="space-y-2">
                         <div className="flex items-center gap-3">
                           <button
                             onClick={() => {
                               const current = Number(config.selections[group.id]) || group.defaultValue || 1;
                               const min = group.min ?? 1;
                               if (current > min) onChange(group.id, current - 1);
                             }}
                             className="w-10 h-10 flex items-center justify-center bg-zinc-800 border border-zinc-600 rounded text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors text-xl font-bold"
                           >
                             −
                           </button>
                           <span className="text-2xl font-bold text-white min-w-[3rem] text-center">
                             {Number(config.selections[group.id]) || group.defaultValue || 1}
                           </span>
                           <button
                             onClick={() => {
                               const current = Number(config.selections[group.id]) || group.defaultValue || 1;
                               const max = group.max ?? 10;
                               if (current < max) onChange(group.id, current + 1);
                             }}
                             className="w-10 h-10 flex items-center justify-center bg-zinc-800 border border-zinc-600 rounded text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors text-xl font-bold"
                           >
                             +
                           </button>
                         </div>
                         {group.description && (
                           <p className="text-xs text-zinc-500">{group.description}</p>
                         )}
                       </div>
                    )}

                    {group.type === 'color' && (
                      <ColorField 
                        options={visibleOptions} 
                        value={(config.selections[group.id] as string) || ''} 
                        onChange={(val) => onChange(group.id, val)} 
                      />
                    )}
                 </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  );
};

export default ConfiguratorControls;
