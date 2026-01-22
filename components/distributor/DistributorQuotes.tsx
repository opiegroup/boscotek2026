import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

interface CustomerData {
  name?: string;
  email?: string;
  company?: string;
  phone?: string;
}

interface Totals {
  subtotal?: number;
  gst?: number;
  total?: number;
}

interface Quote {
  id: string;
  reference: string;
  status: string;
  customer_data: CustomerData;
  totals: Totals;
  items_data: any[];
  created_at: string;
  updated_at: string;
  brand_id: string | null;
  brands?: { name: string } | null;
}

interface PricingTier {
  id: string;
  name: string;
  code: string;
  markup_percentage: number;
}

interface DistributorQuotesProps {
  distributorId: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-zinc-700', text: 'text-zinc-300' },
  sent: { bg: 'bg-blue-900/30', text: 'text-blue-400' },
  accepted: { bg: 'bg-green-900/30', text: 'text-green-400' },
  declined: { bg: 'bg-red-900/30', text: 'text-red-400' },
  expired: { bg: 'bg-yellow-900/30', text: 'text-yellow-400' },
  cancelled: { bg: 'bg-zinc-700', text: 'text-zinc-500' },
};

const RETAIL_MARKUP = 25; // Cash sale / retail markup %

interface DistributorInfo {
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
}

const DistributorQuotes: React.FC<DistributorQuotesProps> = ({ distributorId }) => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [pricingTier, setPricingTier] = useState<PricingTier | null>(null);
  const [distributorInfo, setDistributorInfo] = useState<DistributorInfo | null>(null);

  useEffect(() => {
    loadQuotes();
    loadDistributorInfo();
  }, [distributorId]);

  const loadDistributorInfo = async () => {
    if (!distributorId) return;
    
    try {
      // Get distributor's current info and pricing tier
      const { data: distributor } = await supabase
        .from('distributors')
        .select('company_name, contact_name, contact_email, pricing_tier_id, pricing_tiers(*)')
        .eq('id', distributorId)
        .single();
      
      if (distributor) {
        setDistributorInfo({
          company_name: distributor.company_name,
          contact_name: distributor.contact_name,
          contact_email: distributor.contact_email,
        });
        if (distributor.pricing_tiers) {
          setPricingTier(distributor.pricing_tiers as PricingTier);
        }
      }
    } catch (err) {
      console.error('Failed to load distributor info:', err);
    }
  };

  // Calculate savings from retail
  const calculateSavings = (quoteTotal: number) => {
    if (!pricingTier || pricingTier.markup_percentage >= RETAIL_MARKUP) {
      return { retailTotal: null, savings: 0, savingsPercent: 0 };
    }
    
    // Quote total = wholesale × (1 + markup%)
    // Retail total = wholesale × (1 + 25%)
    // So: Retail = Quote × (1.25 / (1 + markup%))
    const retailTotal = quoteTotal * ((100 + RETAIL_MARKUP) / (100 + pricingTier.markup_percentage));
    const savings = retailTotal - quoteTotal;
    const savingsPercent = (savings / retailTotal) * 100;
    
    return { retailTotal, savings, savingsPercent };
  };

  const loadQuotes = async () => {
    if (!distributorId) {
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('quotes')
        .select('*, brands(name)')
        .eq('distributor_id', distributorId)
        .order('created_at', { ascending: false });

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setQuotes(data || []);
    } catch (err: any) {
      console.error('Failed to load quotes:', err);
      setError(err.message || 'Failed to load quotes');
    } finally {
      setLoading(false);
    }
  };

  const filteredQuotes = statusFilter === 'all'
    ? quotes
    : quotes.filter(q => q.status === statusFilter);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number | null, currency: string = 'AUD') => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!distributorId) {
    return (
      <div className="text-center py-12 text-zinc-400">
        <p>Unable to load quotes. Please contact support.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header with filter */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white px-4 py-2 rounded focus:border-amber-500 outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
            <option value="expired">Expired</option>
          </select>
          
          <span className="text-sm text-zinc-500">
            {filteredQuotes.length} quote{filteredQuotes.length !== 1 ? 's' : ''}
          </span>
        </div>

        <button
          onClick={loadQuotes}
          className="text-sm text-zinc-400 hover:text-white px-4 py-2 bg-zinc-800 rounded"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-900/20 border border-red-900/50 text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Quotes Table */}
      {filteredQuotes.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-white mb-2">No Quotes Yet</h3>
          <p className="text-zinc-400 text-sm">
            {statusFilter === 'all'
              ? "You haven't created any quotes yet. Use the configurator to create your first quote."
              : `No quotes with status "${statusFilter}" found.`}
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-xs font-mono text-zinc-500 uppercase">
                <th className="text-left p-4">Reference</th>
                <th className="text-left p-4">Customer</th>
                <th className="text-left p-4">Brand</th>
                <th className="text-left p-4">Status</th>
                <th className="text-right p-4">Amount</th>
                <th className="text-left p-4">Date</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.map((quote) => {
                const statusStyle = STATUS_COLORS[quote.status] || STATUS_COLORS.draft;
                
                return (
                  <tr 
                    key={quote.id} 
                    className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/50"
                  >
                    <td className="p-4">
                      <span className="font-mono text-amber-400">{quote.reference}</span>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="text-white text-sm">{distributorInfo?.company_name || '-'}</p>
                        {distributorInfo?.contact_name && (
                          <p className="text-zinc-500 text-xs">{distributorInfo.contact_name}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-zinc-400 text-sm">
                      {quote.brands?.name || '-'}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                        {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-white font-medium">
                        {formatCurrency(quote.totals?.total || 0, 'AUD')}
                      </span>
                      {(() => {
                        const { savings, savingsPercent } = calculateSavings(quote.totals?.total || 0);
                        return savings > 0 ? (
                          <div className="text-green-400 text-xs mt-0.5">
                            Save ${savings.toFixed(0)} ({savingsPercent.toFixed(0)}%)
                          </div>
                        ) : null;
                      })()}
                    </td>
                    <td className="p-4 text-zinc-400 text-sm">
                      {formatDate(quote.created_at)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedQuote(quote)}
                          className="text-xs text-zinc-400 hover:text-white px-3 py-1 bg-zinc-700 rounded"
                          title="View quote details"
                        >
                          View
                        </button>
                        <button
                          className="text-xs text-zinc-400 hover:text-amber-400 px-3 py-1 bg-zinc-700 rounded"
                          title="Duplicate quote"
                        >
                          Duplicate
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Quote Detail Modal */}
      {selectedQuote && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-zinc-800 px-6 py-4 border-b border-zinc-700 flex justify-between items-center sticky top-0">
              <div>
                <h3 className="font-bold text-white text-lg">Quote {selectedQuote.reference}</h3>
                <p className="text-xs text-zinc-400">
                  Created {formatDate(selectedQuote.created_at)}
                </p>
              </div>
              <button
                onClick={() => setSelectedQuote(null)}
                className="text-zinc-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Your Account Info (current) */}
              <div className="bg-zinc-800 rounded-lg p-4">
                <h4 className="text-xs font-mono text-zinc-500 uppercase mb-3">Your Account</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-zinc-500">Company:</span>
                    <span className="text-white ml-2 font-medium">{distributorInfo?.company_name || '-'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Contact:</span>
                    <span className="text-white ml-2">{distributorInfo?.contact_name || '-'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Email:</span>
                    <span className="text-white ml-2">{distributorInfo?.contact_email || '-'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Tier:</span>
                    <span className="text-green-400 ml-2">{pricingTier?.name || 'Cash Sale'}</span>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <h4 className="text-xs font-mono text-zinc-500 uppercase mb-3">Products</h4>
                <div className="space-y-4">
                  {selectedQuote.items_data?.map((item: any, idx: number) => (
                    <div key={idx} className="bg-zinc-800 rounded-lg overflow-hidden">
                      {/* Product Image */}
                      {item.thumbnail && (
                        <div className="bg-zinc-950 p-4">
                          <img 
                            src={item.thumbnail} 
                            alt={item.productName}
                            className="w-full max-h-64 object-contain rounded"
                          />
                        </div>
                      )}
                      
                      {/* Product Details */}
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium text-white text-lg">{item.productName}</p>
                            <p className="text-sm text-amber-500 font-mono">{item.configurationCode}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-white font-bold text-lg">${item.totalPrice?.toFixed(2)}</p>
                            <p className="text-xs text-zinc-500">Qty: {item.quantity}</p>
                          </div>
                        </div>
                        
                        {/* Specifications */}
                        {item.specsSummary && item.specsSummary.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-zinc-700">
                            {item.specsSummary.map((spec: string, i: number) => (
                              <span key={i} className="text-xs bg-zinc-700 text-zinc-300 px-2 py-1 rounded">
                                {spec}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {/* Price Breakdown */}
                        {item.breakdown && item.breakdown.length > 0 && (
                          <details className="mt-3 pt-3 border-t border-zinc-700">
                            <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">
                              View price breakdown ({item.breakdown.length} items)
                            </summary>
                            <div className="mt-2 space-y-1">
                              {item.breakdown.map((line: any, i: number) => (
                                <div key={i} className="flex justify-between text-xs">
                                  <span className="text-zinc-400">{line.label}</span>
                                  <span className="text-zinc-300">${line.price?.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  )) || (
                    <p className="text-zinc-500 text-sm">No items in this quote.</p>
                  )}
                </div>
              </div>

              {/* Totals */}
              <div className="bg-zinc-800 rounded-lg p-4">
                {/* Savings Banner */}
                {(() => {
                  const { retailTotal, savings, savingsPercent } = calculateSavings(selectedQuote.totals?.total || 0);
                  if (savings <= 0 || !retailTotal) return null;
                  
                  return (
                    <div className="bg-gradient-to-r from-green-900/40 to-emerald-900/20 border border-green-700/50 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-green-400 text-2xl">💎</span>
                          <div>
                            <p className="text-green-300 font-bold text-lg">{pricingTier?.name}</p>
                            <p className="text-green-400/70 text-xs">({pricingTier?.markup_percentage}% markup tier)</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="bg-green-500 text-black text-sm font-bold px-4 py-1.5 rounded">
                            SAVE {savingsPercent.toFixed(0)}%
                          </div>
                        </div>
                      </div>
                      <div className="text-green-400/80 text-xs mb-3">
                        vs Standard Retail Price
                      </div>
                      <div className="flex items-center justify-between bg-black/20 rounded p-3">
                        <div className="flex items-center gap-3">
                          <span className="text-zinc-500 line-through text-lg">${retailTotal.toFixed(2)}</span>
                          <span className="text-white text-2xl">→</span>
                          <span className="text-green-400 font-bold text-xl">${(selectedQuote.totals?.total || 0).toFixed(2)}</span>
                        </div>
                        <div className="text-green-400 font-bold text-lg">
                          You save ${savings.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Subtotal (Ex GST)</span>
                    <span className="text-white">${selectedQuote.totals?.subtotal?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">GST (10%)</span>
                    <span className="text-white">${selectedQuote.totals?.gst?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-700 pt-2 mt-2">
                    <span className="text-white font-bold">Your Total (Inc GST)</span>
                    <span className="text-amber-500 font-bold text-lg">${selectedQuote.totals?.total?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-4">
                <span className="text-zinc-500 text-sm">Status:</span>
                <span className={`px-3 py-1 rounded text-sm font-medium ${STATUS_COLORS[selectedQuote.status]?.bg || 'bg-zinc-700'} ${STATUS_COLORS[selectedQuote.status]?.text || 'text-zinc-300'}`}>
                  {selectedQuote.status.charAt(0).toUpperCase() + selectedQuote.status.slice(1)}
                </span>
              </div>
            </div>

            <div className="bg-zinc-800 px-6 py-4 border-t border-zinc-700 flex justify-end gap-3 sticky bottom-0">
              <button
                onClick={() => setSelectedQuote(null)}
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DistributorQuotes;
