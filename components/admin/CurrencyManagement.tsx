import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchange_rate: number;
  is_base: boolean;
  is_active: boolean;
  decimal_places: number;
  last_updated: string;
}

const CurrencyManagement: React.FC = () => {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [testAmount, setTestAmount] = useState(1000);
  const [testFromCurrency, setTestFromCurrency] = useState('AUD');
  const [testToCurrency, setTestToCurrency] = useState('USD');

  // Load currencies
  const loadCurrencies = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('currencies')
        .select('*')
        .order('sort_order');

      if (fetchError) throw fetchError;
      setCurrencies(data || []);
    } catch (err: any) {
      console.error('Error loading currencies:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrencies();
  }, []);

  // Update exchange rate
  const handleRateChange = async (currencyId: string, newRate: number) => {
    setSaving(currencyId);
    try {
      const { error } = await supabase
        .from('currencies')
        .update({ 
          exchange_rate: newRate,
          last_updated: new Date().toISOString()
        })
        .eq('id', currencyId);

      if (error) throw error;

      // Update local state
      setCurrencies(currencies.map(c => 
        c.id === currencyId ? { ...c, exchange_rate: newRate, last_updated: new Date().toISOString() } : c
      ));
    } catch (err: any) {
      console.error('Error updating rate:', err);
      alert(`Failed to update: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  // Toggle currency active status
  const handleToggleActive = async (currency: Currency) => {
    if (currency.is_base) {
      alert('Cannot deactivate base currency (AUD)');
      return;
    }

    try {
      const { error } = await supabase
        .from('currencies')
        .update({ is_active: !currency.is_active })
        .eq('id', currency.id);

      if (error) throw error;
      await loadCurrencies();
    } catch (err: any) {
      console.error('Error toggling currency:', err);
      alert(`Failed to update: ${err.message}`);
    }
  };

  // Calculate converted amount
  const calculateConversion = () => {
    const fromCurrency = currencies.find(c => c.code === testFromCurrency);
    const toCurrency = currencies.find(c => c.code === testToCurrency);
    
    if (!fromCurrency || !toCurrency) return testAmount;
    
    // Convert via AUD
    let audAmount = testAmount;
    if (testFromCurrency !== 'AUD') {
      audAmount = testAmount / fromCurrency.exchange_rate;
    }
    
    if (testToCurrency === 'AUD') {
      return audAmount;
    }
    
    return audAmount * toCurrency.exchange_rate;
  };

  // Fetch live rates (placeholder - would call external API)
  const handleFetchLiveRates = async () => {
    alert(
      'Live rate fetching would connect to an exchange rate API like:\n\n' +
      '• Open Exchange Rates\n' +
      '• Fixer.io\n' +
      '• XE.com\n\n' +
      'For now, update rates manually based on current market rates.'
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const activeCurrencies = currencies.filter(c => c.is_active);
  const baseCurrency = currencies.find(c => c.is_base);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">Currency Management</h1>
          <p className="text-zinc-400">Manage exchange rates for multi-currency pricing.</p>
        </div>
        <button
          onClick={handleFetchLiveRates}
          className="bg-zinc-700 text-white px-4 py-2 rounded hover:bg-zinc-600 text-sm"
        >
          🔄 Fetch Live Rates
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Currency Converter Tool */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h3 className="text-sm font-bold text-zinc-400 uppercase mb-4">Currency Converter</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs text-zinc-500 mb-2">Amount</label>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">{baseCurrency?.symbol || '$'}</span>
              <input
                type="number"
                value={testAmount}
                onChange={(e) => setTestAmount(parseFloat(e.target.value) || 0)}
                className="flex-1 bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none text-lg"
              />
            </div>
          </div>
          
          <div className="w-32">
            <label className="block text-xs text-zinc-500 mb-2">From</label>
            <select
              value={testFromCurrency}
              onChange={(e) => setTestFromCurrency(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
            >
              {activeCurrencies.map(c => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>
          </div>

          <div className="text-2xl text-zinc-500 mt-6">→</div>

          <div className="w-32">
            <label className="block text-xs text-zinc-500 mb-2">To</label>
            <select
              value={testToCurrency}
              onChange={(e) => setTestToCurrency(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
            >
              {activeCurrencies.map(c => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-xs text-zinc-500 mb-2">Result</label>
            <div className="bg-zinc-950 border border-zinc-700 p-3 rounded text-lg">
              <span className="text-zinc-500">{currencies.find(c => c.code === testToCurrency)?.symbol || '$'}</span>
              <span className="text-amber-500 font-bold ml-1">
                {calculateConversion().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Exchange Rates Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="bg-zinc-800 px-6 py-4 border-b border-zinc-700 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-white">Exchange Rates</h3>
            <p className="text-xs text-zinc-500 mt-1">Rates are relative to AUD (base currency)</p>
          </div>
          <div className="text-xs text-zinc-500">
            Last updated: {baseCurrency?.last_updated ? new Date(baseCurrency.last_updated).toLocaleString() : 'Never'}
          </div>
        </div>

        <table className="w-full">
          <thead className="bg-zinc-950 text-xs text-zinc-500 uppercase">
            <tr>
              <th className="text-left px-6 py-3">Currency</th>
              <th className="text-left px-6 py-3">Symbol</th>
              <th className="text-left px-6 py-3">Rate (vs AUD)</th>
              <th className="text-left px-6 py-3">$1,000 AUD =</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-left px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {currencies.map(currency => (
              <tr key={currency.id} className={`hover:bg-zinc-800/50 ${!currency.is_active ? 'opacity-50' : ''}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getFlagEmoji(currency.code)}</span>
                    <div>
                      <div className="font-medium text-white">{currency.name}</div>
                      <div className="text-xs text-zinc-500 font-mono">{currency.code}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xl text-amber-500">{currency.symbol}</span>
                </td>
                <td className="px-6 py-4">
                  {currency.is_base ? (
                    <span className="text-zinc-400">1.000000 (base)</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.000001"
                        value={currency.exchange_rate}
                        onChange={(e) => handleRateChange(currency.id, parseFloat(e.target.value) || 0)}
                        disabled={saving === currency.id}
                        className="w-28 bg-zinc-800 border border-zinc-700 text-white text-right p-2 rounded focus:border-amber-500 outline-none font-mono disabled:opacity-50"
                      />
                      {saving === currency.id && (
                        <span className="text-amber-500 text-xs">Saving...</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className="font-mono text-zinc-300">
                    {currency.symbol}{(1000 * currency.exchange_rate).toLocaleString(undefined, { 
                      minimumFractionDigits: currency.decimal_places, 
                      maximumFractionDigits: currency.decimal_places 
                    })}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {currency.is_base ? (
                    <span className="px-2 py-1 rounded text-xs font-bold bg-amber-900/30 text-amber-400">
                      Base Currency
                    </span>
                  ) : currency.is_active ? (
                    <span className="px-2 py-1 rounded text-xs font-bold bg-green-900/30 text-green-400">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded text-xs font-bold bg-zinc-700 text-zinc-400">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {!currency.is_base && (
                    <button
                      onClick={() => handleToggleActive(currency)}
                      className={`text-xs px-3 py-1 rounded ${
                        currency.is_active
                          ? 'text-red-400 hover:bg-red-900/30'
                          : 'text-green-400 hover:bg-green-900/30'
                      }`}
                    >
                      {currency.is_active ? 'Disable' : 'Enable'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-900/50 rounded-lg p-4">
        <h4 className="font-bold text-blue-400 mb-2">How Currency Conversion Works</h4>
        <ul className="text-sm text-blue-300 space-y-1">
          <li>• All prices are stored in <strong>AUD</strong> (base currency)</li>
          <li>• When a distributor selects a different currency, prices are converted at checkout</li>
          <li>• Exchange rates should be updated regularly to reflect market rates</li>
          <li>• Distributors can set their preferred currency in their account settings</li>
        </ul>
      </div>
    </div>
  );
};

// Helper to get flag emoji from currency code
function getFlagEmoji(currencyCode: string): string {
  const flags: Record<string, string> = {
    AUD: '🇦🇺',
    USD: '🇺🇸',
    EUR: '🇪🇺',
    GBP: '🇬🇧',
    NZD: '🇳🇿',
    CAD: '🇨🇦',
    CNY: '🇨🇳',
    JPY: '🇯🇵',
    SGD: '🇸🇬',
  };
  return flags[currencyCode] || '💱';
}

export default CurrencyManagement;
