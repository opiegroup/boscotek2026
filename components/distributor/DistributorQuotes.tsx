import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

interface Quote {
  id: string;
  reference: string;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_company: string | null;
  total_amount: number | null;
  currency: string;
  created_at: string;
  updated_at: string;
  brand_id: string | null;
  brands?: { name: string } | null;
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

const DistributorQuotes: React.FC<DistributorQuotesProps> = ({ distributorId }) => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadQuotes();
  }, [distributorId]);

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
                        <p className="text-white text-sm">{quote.customer_name || '-'}</p>
                        {quote.customer_company && (
                          <p className="text-zinc-500 text-xs">{quote.customer_company}</p>
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
                        {formatCurrency(quote.total_amount, quote.currency)}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-400 text-sm">
                      {formatDate(quote.created_at)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
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
                        {quote.status === 'draft' && (
                          <button
                            className="text-xs text-zinc-400 hover:text-green-400 px-3 py-1 bg-zinc-700 rounded"
                            title="Send to customer"
                          >
                            Send
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DistributorQuotes;
