import React from 'react';
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
      >
        <input
          type="radio"
          name={group.id}
          value={opt.id}
          checked={value === opt.id}
          onChange={() => onChange(opt.id)}
          className="sr-only"
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

export const ColorField: React.FC<ColorFieldProps> = ({ options, value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => (
      <button
        key={opt.id}
        onClick={() => onChange(opt.id)}
        title={opt.label}
        className={`
          w-8 h-8 rounded-full border-2 transition-all shadow-sm
          ${value === opt.id ? 'border-amber-500 scale-110' : 'border-zinc-600 hover:border-zinc-400'}
        `}
        style={{ backgroundColor: opt.value as string }}
      />
    ))}
    <div className="w-full text-xs text-zinc-500 mt-1 pl-1 font-mono">
      {options.find(o => o.id === value)?.label}
    </div>
  </div>
);

type QtyListFieldProps = {
  group: OptionGroup;
  values: Record<string, number>;
  onChange: (val: Record<string, number>) => void;
};

export const QtyListField: React.FC<QtyListFieldProps> = ({ group, values, onChange }) => {
  const handleQtyChange = (itemId: string, delta: number) => {
    const currentQty = values[itemId] || 0;
    const newQty = Math.max(0, currentQty + delta);
    
    const newValues = { ...values, [itemId]: newQty };
    if (newQty === 0) delete newValues[itemId];
    
    onChange(newValues);
  };

  return (
    <div className="space-y-2">
      {group.options.map(opt => {
        const qty = values[opt.id] || 0;
        return (
          <div key={opt.id} className={`flex items-center justify-between p-3 rounded border transition-colors ${qty > 0 ? 'bg-zinc-800 border-amber-500/50' : 'bg-zinc-900 border-zinc-700'}`}>
             <div className="flex-1">
                <div className={`text-sm font-medium ${qty > 0 ? 'text-white' : 'text-zinc-400'}`}>{opt.label}</div>
                <div className="text-xs text-amber-500 font-bold">+${opt.priceDelta} ea</div>
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
    </div>
  );
};

