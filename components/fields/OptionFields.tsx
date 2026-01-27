import React, { useRef, useState } from 'react';
import { OptionGroup, ProductAttribute } from '../../types';

type SelectFieldProps = {
  group: OptionGroup;
  value: string;
  options: ProductAttribute[];
  onChange: (val: string) => void;
};

export const SelectField: React.FC<SelectFieldProps> = ({ group, value, options, onChange }) => (
  <div className="space-y-2">
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-zinc-800 text-zinc-100 border border-zinc-600 rounded p-3 text-sm focus:border-amber-500 focus:outline-none"
    >
      <option value="" disabled>Select an option</option>
      {options.map(opt => (
        <option key={opt.id} value={opt.id}>
          {opt.label} {opt.priceDelta && opt.priceDelta > 0 ? `(+$${opt.priceDelta})` : ''}
        </option>
      ))}
    </select>
  </div>
);

type RadioFieldProps = {
  group: OptionGroup;
  value: string;
  options: ProductAttribute[];
  onChange: (val: string) => void;
};

export const RadioField: React.FC<RadioFieldProps> = ({ group, value, options, onChange }) => (
  <div className="grid grid-cols-1 gap-2">
    {options.map((opt) => (
      <label
        key={opt.id}
        className={`
          flex items-center p-3 rounded-md cursor-pointer border transition-all
          ${value === opt.id 
            ? 'bg-zinc-800 border-amber-500' 
            : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500'}
        `}
        onClick={(e) => {
          // Prevent any scroll behavior
          e.preventDefault();
          onChange(opt.id);
        }}
      >
        <input
          type="radio"
          name={group.id}
          value={opt.id}
          checked={value === opt.id}
          onChange={() => {}}
          className="sr-only"
          tabIndex={-1}
        />
        <div className="flex-1">
           <div className="flex justify-between items-center">
              <span className={`font-bold mr-2 ${value === opt.id ? 'text-amber-500' : 'text-zinc-500'}`}>
                {opt.label}
              </span>
              {opt.priceDelta && opt.priceDelta > 0 ? (
                <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">+$ {opt.priceDelta}</span>
              ) : null}
           </div>
           {opt.description && value === opt.id && (
              <div className="text-xs text-zinc-400 mt-1">{opt.description}</div>
           )}
        </div>
      </label>
    ))}
  </div>
);

type CheckboxFieldProps = {
  option: ProductAttribute;
  checked: boolean;
  onChange: (val: boolean) => void;
};

export const CheckboxField: React.FC<CheckboxFieldProps> = ({ option, checked, onChange }) => (
  <div>
    <label
      className={`
        flex items-center p-3 rounded-md cursor-pointer border transition-all select-none
        ${checked ? 'bg-zinc-800 border-amber-500' : 'bg-transparent border-zinc-700 hover:border-zinc-500'}
      `}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 accent-amber-500 rounded bg-zinc-700 border-zinc-600 mr-3"
      />
      <div className="flex-1">
        <span className="block text-sm font-medium text-zinc-200">{option.label}</span>
      </div>
      {option.priceDelta && option.priceDelta > 0 && <span className="text-xs text-amber-500 font-bold">+${option.priceDelta}</span>}
    </label>
  </div>
);

type ColorFieldProps = {
  options: ProductAttribute[];
  value: string;
  onChange: (val: string) => void;
};

export const ColorField: React.FC<ColorFieldProps> = ({ options, value, onChange }) => {
  const [hoveredColor, setHoveredColor] = React.useState<string | null>(null);
  
  const selectedOption = options.find(o => o.id === value);
  const hoveredOption = hoveredColor ? options.find(o => o.id === hoveredColor) : null;
  const displayOption = hoveredOption || selectedOption;
  
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          // Get hex colour from meta.hex, fallback to value if it looks like a hex code
          const hexColour = opt.meta?.hex || (typeof opt.value === 'string' && opt.value.startsWith('#') ? opt.value : '#888888');
          const isSelected = value === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              onMouseEnter={() => setHoveredColor(opt.id)}
              onMouseLeave={() => setHoveredColor(null)}
              title={opt.label}
              className={`
                w-8 h-8 rounded-full border-2 transition-all shadow-sm relative
                ${isSelected ? 'border-amber-500 scale-110 ring-2 ring-amber-500/30' : 'border-zinc-600 hover:border-zinc-400 hover:scale-105'}
              `}
              style={{ backgroundColor: hexColour }}
            >
              {isSelected && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-white/80 shadow" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Selected/hovered color name display */}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-zinc-800/50 rounded border border-zinc-700">
        {displayOption && (
          <>
            <span 
              className="w-4 h-4 rounded-full border border-zinc-600 flex-shrink-0" 
              style={{ backgroundColor: displayOption.meta?.hex || '#888' }}
            />
            <div className="flex-1 min-w-0">
              <span className={`text-sm font-medium ${hoveredOption ? 'text-zinc-300' : 'text-amber-400'}`}>
                {displayOption.label}
              </span>
              {displayOption.description && (
                <span className="text-xs text-zinc-500 ml-2">
                  ({displayOption.description})
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

type QtyListFieldProps = {
  group: OptionGroup;
  values: Record<string, number>;
  onChange: (val: Record<string, number>) => void;
  onConfigureV50?: () => void; // Callback to launch V50 Data Vault configurator
  v50Count?: number; // Number of V50 Data Vaults already in quote
};

// Logo accessory IDs that require image upload
const LOGO_ACCESSORY_IDS = [
  'logo-insert-aero-top', 
  'logo-panel-aero-400', 
  'logo-panel-aero-full',
  'logo-panel-classic-400', 
  'logo-panel-classic-full', 
  'crystalite-logo-classic'
];

// Data Security Cage accessory that links to V50 Data Vault
const DATA_SECURITY_CAGE_ID = 'acc-data-security-cage';

export const QtyListField: React.FC<QtyListFieldProps> = ({ group, values, onChange, onConfigureV50, v50Count = 0 }) => {
  const handleQtyChange = (itemId: string, delta: number) => {
    const currentQty = values[itemId] || 0;
    const newQty = Math.max(0, currentQty + delta);
    
    const newValues = { ...values, [itemId]: newQty };
    if (newQty === 0) delete newValues[itemId];
    
    onChange(newValues);
  };

  // Check if any logo accessory is selected
  const hasLogoAccessorySelected = LOGO_ACCESSORY_IDS.some(id => (values[id] || 0) > 0);
  
  // Check if Data Security Cage is selected
  const hasDataSecurityCageSelected = (values[DATA_SECURITY_CAGE_ID] || 0) > 0;

  return (
    <div className="space-y-2">
      {group.options.map(opt => {
        const qty = values[opt.id] || 0;
        const isLogoAccessory = LOGO_ACCESSORY_IDS.includes(opt.id);
        const isDataSecurityCage = opt.id === DATA_SECURITY_CAGE_ID;
        
        return (
          <div key={opt.id} className={`flex items-center justify-between p-3 rounded border transition-colors ${qty > 0 ? 'bg-zinc-800 border-amber-500/50' : 'bg-zinc-900 border-zinc-700'}`}>
             <div className="flex-1">
                <div className={`text-sm font-medium ${qty > 0 ? 'text-white' : 'text-zinc-400'}`}>
                  {opt.label}
                  {isLogoAccessory && <span className="ml-2 text-xs text-blue-400">📷</span>}
                  {isDataSecurityCage && <span className="ml-2 text-xs text-emerald-400">🔐</span>}
                </div>
                <div className="text-xs text-amber-500 font-bold">+${opt.priceDelta} ea</div>
                {isDataSecurityCage && (
                  <div className="text-xs text-emerald-400 mt-1">Configurable V50 Data Vault available</div>
                )}
             </div>
             
             <div className="flex items-center gap-3 bg-zinc-950 rounded px-2 py-1 border border-zinc-800">
                <button 
                   onClick={() => handleQtyChange(opt.id, -1)}
                   className={`w-6 h-6 flex items-center justify-center rounded text-sm hover:bg-zinc-800 ${qty === 0 ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-200'}`}
                   disabled={qty === 0}
                >
                   -
                </button>
                <span className={`w-4 text-center text-sm font-mono font-bold ${qty > 0 ? 'text-amber-500' : 'text-zinc-500'}`}>{qty}</span>
                <button 
                   onClick={() => handleQtyChange(opt.id, 1)}
                   className="w-6 h-6 flex items-center justify-center rounded text-sm hover:bg-zinc-800 text-zinc-200"
                >
                   +
                </button>
             </div>
          </div>
        );
      })}
      
      {/* Show V50 Data Vault configuration prompt when Data Security Cage is selected */}
      {hasDataSecurityCageSelected && (
        <div className="mt-3 p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-emerald-400">🔐</span>
            <span className="text-sm font-medium text-emerald-300">V50 Data Vault Configuration</span>
          </div>
          <p className="text-xs text-zinc-400 mb-3">
            The Data Security Cage is a basic internal enclosure. For fully configurable in-rack security with adjustable RU height, depth options, and clamshell door access, configure a <strong className="text-emerald-400">V50 Data Vault</strong> instead.
          </p>
          <div className="flex flex-col gap-2">
            {onConfigureV50 && (
              <button
                onClick={onConfigureV50}
                className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2"
              >
                <span>Configure V50 Data Vault</span>
                <span>→</span>
              </button>
            )}
            {v50Count > 0 && (
              <div className="text-xs text-emerald-400 text-center">
                {v50Count} V50 Data Vault{v50Count > 1 ? 's' : ''} already in quote
              </div>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-2 italic">
            Tip: You can add multiple V50 Data Vaults with different configurations to your quote.
          </p>
        </div>
      )}
      
      {/* Show logo upload prompt when any logo accessory is selected */}
      {hasLogoAccessorySelected && (
        <div className="mt-3 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-blue-400">📷</span>
            <span className="text-sm font-medium text-blue-300">Logo Image Required</span>
          </div>
          <p className="text-xs text-zinc-400 mb-2">
            Upload your logo image to see it on the 3D model. Use the logo upload section below to add your custom logo.
          </p>
        </div>
      )}
    </div>
  );
};

// Logo Upload Field Component
type LogoUploadFieldProps = {
  logoImageUrl?: string;
  onLogoChange: (url: string | undefined) => void;
  hasLogoAccessory: boolean;
};

export const LogoUploadField: React.FC<LogoUploadFieldProps> = ({ logoImageUrl, onLogoChange, hasLogoAccessory }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  if (!hasLogoAccessory) return null;
  
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, SVG)');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Convert to base64 data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        onLogoChange(dataUrl);
        setIsLoading(false);
      };
      reader.onerror = () => {
        alert('Failed to read image file');
        setIsLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error processing logo:', err);
      setIsLoading(false);
    }
  };
  
  const handleRemoveLogo = () => {
    onLogoChange(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  return (
    <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700 mt-4">
      <h4 className="text-sm font-bold text-amber-500 mb-3 flex items-center gap-2">
        <span>🎨</span>
        Custom Logo Upload
      </h4>
      
      {logoImageUrl ? (
        <div className="space-y-3">
          <div className="relative aspect-video bg-zinc-900 rounded-lg overflow-hidden border border-zinc-600">
            <img 
              src={logoImageUrl} 
              alt="Custom Logo Preview" 
              className="w-full h-full object-contain p-2"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 px-3 py-2 text-xs font-medium bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
            >
              Change Logo
            </button>
            <button
              onClick={handleRemoveLogo}
              className="px-3 py-2 text-xs font-medium bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-600 hover:border-amber-500 rounded-lg p-6 text-center cursor-pointer transition-colors"
        >
          {isLoading ? (
            <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto" />
          ) : (
            <>
              <div className="text-3xl mb-2">📤</div>
              <div className="text-sm text-zinc-300 mb-1">Click to upload logo</div>
              <div className="text-xs text-zinc-500">PNG, JPG, or SVG (max 5MB)</div>
            </>
          )}
        </div>
      )}
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <p className="text-xs text-zinc-500 mt-3">
        Your logo will appear on the lectern's logo panel area in the 3D preview.
      </p>
    </div>
  );
};

