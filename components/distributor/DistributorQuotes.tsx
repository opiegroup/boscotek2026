import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useBrand } from '../../contexts/BrandContext';

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
  const [distributorAccountNumber, setDistributorAccountNumber] = useState<string>('');
  const { brand, brandSlug } = useBrand();

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
        .select('company_name, contact_name, contact_email, account_number, pricing_tier_id, pricing_tiers(*)')
        .eq('id', distributorId)
        .single();
      
      if (distributor) {
        setDistributorInfo({
          company_name: distributor.company_name,
          contact_name: distributor.contact_name,
          contact_email: distributor.contact_email,
        });
        setDistributorAccountNumber(distributor.account_number || '');
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

  // Print quote function - same format as admin
  const handlePrintQuote = (quote: Quote) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups for this site to print quotes.');
      return;
    }

    // Brand-specific footer mapping
    const brandFooters: Record<string, string> = {
      'boscotek': '/boscotek-footer.png',
      'lectrum': '/lectrum-footer.png',
      'gilkon': '/gilkon-footer.png',
      'argent': '/argent-footer.png',
      'bosco-office': '/bos-footer.png',
      'default': '/opiegroup-footer.png'
    };

    // Brand-specific logo mapping
    const brandLogos: Record<string, string> = {
      'boscotek': '/boscotek-logo.svg',
      'lectrum': '/lectrum-logo.png',
      'gilkon': '/gilkon-logo.jpg',
      'argent': '/argent-logo.png',
      'bosco-office': '/bos-logo.png',
      'opie-infrastructure': '/opiegroup-logo.png',
      'default': '/boscotek-logo.svg'
    };

    const brandLogo = brandLogos[brandSlug || ''] || brandLogos['default'];
    const brandName = brand?.name || 'Boscotek';
    const footerImage = brandFooters[brandSlug || ''] || brandFooters['default'];

    const quoteDate = new Date(quote.created_at);
    const expiryDate = new Date(quoteDate);
    expiryDate.setDate(expiryDate.getDate() + 30);
    
    const formatPrintDate = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'numeric', year: 'numeric' });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Quote ${quote.reference}</title>
        <style>
          @page { margin: 15mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #333; line-height: 1.4; }
          
          .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
          .hello-title img { height: 90px; width: auto; }
          .brand-logo { text-align: right; }
          .brand-logo img { height: 72px; width: auto; }
          
          .quote-info { display: flex; gap: 40px; margin-bottom: 25px; }
          .quote-info .quote-num h2 { font-size: 16px; font-weight: bold; }
          .quote-info .quote-num p { font-size: 11px; color: #666; }
          .quote-info .abn { font-size: 11px; color: #333; }
          
          .address-section { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 20px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid #C9A227; }
          .address-block label { font-size: 10px; font-weight: bold; color: #C9A227; display: block; margin-bottom: 5px; }
          .address-block p { font-size: 12px; line-height: 1.5; }
          .address-block .company-name { font-weight: bold; font-size: 13px; }
          .project-block .project-code { font-size: 18px; font-weight: bold; color: #333; }
          .project-block .customer-no { margin-top: 10px; }
          .project-block .customer-no label { font-size: 10px; color: #666; }
          .project-block .customer-no p { font-size: 20px; font-weight: bold; }
          
          .meta-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #e5e5e5; font-size: 9px; }
          .meta-row label { display: block; color: #999; text-transform: uppercase; font-weight: bold; }
          .meta-row p { color: #333; margin-top: 2px; }
          
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; page-break-inside: auto; }
          .items-table thead th { background: #C9A227; color: #fff; font-weight: bold; text-transform: uppercase; font-size: 10px; padding: 10px 8px; text-align: left; }
          .items-table thead th.qty { text-align: center; width: 60px; }
          .items-table thead th.price { text-align: right; width: 100px; }
          .items-table thead th.amount { text-align: right; width: 100px; }
          .items-table tbody td { padding: 12px 8px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
          .items-table tbody td.qty { text-align: center; font-weight: bold; }
          .items-table tbody td.price { text-align: right; }
          .items-table tbody td.amount { text-align: right; font-weight: bold; }
          .items-table tr { page-break-inside: avoid; }
          
          .item-code { font-weight: bold; color: #333; margin-bottom: 2px; }
          .item-name { font-weight: bold; margin-bottom: 8px; }
          .item-specs { color: #666; font-size: 10px; line-height: 1.6; }
          .item-image { margin: 10px 0; }
          .item-image img { max-height: 150px; max-width: 250px; }
          .item-line-num { margin-top: 10px; font-size: 10px; color: #999; }
          
          .page-footer { margin-top: 40px; }
          .page-footer img { width: 100%; height: auto; display: block; }
          
          .page-break { page-break-before: always; }
          
          .page2-wrapper { min-height: calc(100vh - 30mm); display: flex; flex-direction: column; }
          .page2-wrapper .page-footer { margin-top: auto; padding-top: 10mm; }
          
          .page2-top { display: flex; justify-content: space-between; margin-top: 80px; gap: 40px; }
          .page2-notes { flex: 1; }
          .page2-totals { width: 280px; }
          
          .additional-notes h3 { font-weight: bold; font-size: 13px; margin-bottom: 8px; }
          .additional-notes .notes-text { font-style: italic; font-size: 11px; line-height: 1.8; }
          .additional-notes .dimensions { font-style: italic; font-size: 11px; margin-top: 15px; line-height: 1.6; }
          
          .totals-box-page2 { border: 1px solid #e5e5e5; }
          .totals-box-page2 .totals-row { display: flex; justify-content: space-between; padding: 12px 15px; font-size: 13px; border-bottom: 1px solid #e5e5e5; }
          .totals-box-page2 .totals-row:last-child { border-bottom: none; }
          .totals-box-page2 .totals-row.final { background: #333; color: #fff; font-weight: bold; font-size: 15px; }
          .totals-box-page2 .totals-row .label { font-weight: 600; }
          .totals-box-page2 .totals-row .amount { font-family: 'Courier New', monospace; text-align: right; min-width: 100px; }
          
          .page2-bottom { display: flex; gap: 30px; margin-top: 40px; }
          .page2-card { width: 220px; }
          .page2-terms { flex: 1; }
          
          .card-payment h3 { font-weight: bold; font-size: 13px; margin-bottom: 4px; }
          .card-payment a { color: #333; font-size: 11px; text-decoration: underline; }
          .card-payment .payment-icons { width: 180px; margin: 15px 0; display: block; }
          .card-payment .thank-you { font-size: 20px; font-weight: bold; color: #C9A227; margin-top: 25px; }
          
          .terms-section h3 { font-size: 11px; font-weight: bold; font-style: italic; margin-bottom: 10px; }
          .terms-section h3 a { color: #C9A227; text-decoration: underline; }
          .terms-section ul { list-style: disc; padding-left: 18px; font-size: 9px; line-height: 1.5; font-style: italic; color: #333; }
          .terms-section li { margin-bottom: 3px; }
          .terms-section li strong { font-style: italic; }
          
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="page-header">
          <div class="hello-title">
            <img src="/hello-quotation.png" alt="Hello, here is your QUOTATION">
          </div>
          <div class="brand-logo">
            <img src="${brandLogo}" alt="${brandName}">
          </div>
        </div>
        
        <div class="quote-info">
          <div class="quote-num">
            <h2>Quote # ${quote.reference}</h2>
            <p>Date: ${formatPrintDate(quoteDate)}</p>
          </div>
          <div class="abn">
            ABN 31 003 951 004<br>
            Net 30
          </div>
        </div>
        
        <div class="address-section">
          <div class="address-block">
            <label>Bill to:</label>
            <p class="company-name">${distributorInfo?.company_name || ''}</p>
            <p>Attn: ${distributorInfo?.contact_name || quote.customer_data?.name || ''}</p>
          </div>
          <div class="address-block">
            <label>Ship to:</label>
            <p>Attn: ${distributorInfo?.contact_name || quote.customer_data?.name || ''}</p>
          </div>
          <div class="address-block project-block">
            <label>Project:</label>
            <p class="project-code">${quote.items_data?.[0]?.configurationCode || quote.reference}</p>
            <p>${quote.items_data?.[0]?.productName || ''}</p>
            <div class="customer-no">
              <label>Customer No:</label>
              <p>${distributorAccountNumber || 'WALK-IN'}</p>
            </div>
          </div>
        </div>
        
        <div class="meta-row">
          <div><label>Pricing Expires:</label><p>${formatPrintDate(expiryDate)}</p></div>
          <div><label>Sales Contact:</label><p>Sales Team</p></div>
          <div><label>Shipping Method:</label><p>TBA</p></div>
          <div><label>Shipping INCOTERM Code:</label><p></p></div>
          <div><label>Payment Terms:</label><p>Net 30</p></div>
        </div>
        
        <table class="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th class="qty">QTY</th>
              <th class="price">Unit Price</th>
              <th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${quote.items_data?.map((item: any, idx: number) => `
              <tr>
                <td>
                  <div class="item-code">${item.configurationCode || ''}</div>
                  <div class="item-name">${item.productName}</div>
                  ${item.thumbnail ? `<div class="item-image"><img src="${item.thumbnail}" alt="${item.productName}"></div>` : ''}
                  <div class="item-specs">
                    ${item.specsSummary ? item.specsSummary.join('<br>') : ''}
                  </div>
                  <div class="item-line-num">${idx + 1}</div>
                </td>
                <td class="qty">${item.quantity}</td>
                <td class="price">$${item.unitPrice?.toLocaleString(undefined, {minimumFractionDigits: 2}) || '0.00'}</td>
                <td class="amount">$${item.totalPrice?.toLocaleString(undefined, {minimumFractionDigits: 2}) || '0.00'}</td>
              </tr>
            `).join('') || ''}
          </tbody>
        </table>

        <!-- PAGE 2 - T&C and Totals -->
        <div class="page-break"></div>
        
        <div class="page2-wrapper">
          <div class="page-header">
            <div class="hello-title">
              <img src="/hello-quotation.png" alt="Hello, here is your QUOTATION">
            </div>
            <div class="brand-logo">
              <img src="${brandLogo}" alt="${brandName}">
            </div>
          </div>
          
          <div class="quote-info">
            <div class="quote-num">
              <h2>Quote # ${quote.reference}</h2>
              <p>Date: ${formatPrintDate(quoteDate)}</p>
            </div>
            <div class="abn">
              ABN 31 003 951 004<br>
              Net 30
            </div>
          </div>
          
          <div class="page2-top">
            <div class="page2-notes">
              <div class="additional-notes">
                <h3>Additional Notes:</h3>
                <p class="notes-text"><em>Note: This Product is manufactured to order.</em></p>
                <p class="dimensions"><em>Approximate Weight & Dimensions below:</em><br>
                ${quote.items_data?.[0]?.dimensions || '2300H x 1350W x 1050D @ 350kg.'}</p>
              </div>
            </div>
            
            <div class="page2-totals">
              <div class="totals-box-page2">
                <div class="totals-row">
                  <span class="label">Total (ex GST)</span>
                  <span class="amount">$${(quote.totals?.subtotal || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                <div class="totals-row">
                  <span class="label">Freight</span>
                  <span class="amount">$0.00</span>
                </div>
                <div class="totals-row">
                  <span class="label">GST</span>
                  <span class="amount">$${(quote.totals?.gst || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                <div class="totals-row final">
                  <span class="label">Total (inc GST)</span>
                  <span class="amount">$${(quote.totals?.total || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="page2-bottom">
            <div class="page2-card">
              <div class="card-payment">
                <h3>Card Payment</h3>
                <p><a href="https://www.opiegroup.com.au/payments/">www.opiegroup.com.au/payments/</a></p>
                <img src="/payment-cards.png" alt="Payment Methods" class="payment-icons">
                <p class="thank-you">Thank you for your business</p>
              </div>
            </div>
            
            <div class="page2-terms">
              <div class="terms-section">
                <h3>For full terms and conditions see website: <a href="https://www.opiegroup.com.au/terms-of-sale/">www.opiegroup.com.au/terms-of-sale/</a></h3>
                <ul>
                  <li>All quoted prices remain subject to rise and fall without notice.</li>
                  <li>Material availability remains subject to confirmation at time of order placement with our suppliers.</li>
                  <li>We maintain the right to adjust delivery time or cancel the order without notice or penalty if material cannot be sourced due to availability or within the budgeted price with our existing suppliers.</li>
                  <li>All lead times are provided in good faith and should be treated as an estimation only.</li>
                  <li>Please allow 1–2 days after estimated completion date for Sydney Metro delivery.</li>
                  <li>Unless expressly agreed to in writing, all thermal cutting tolerances are to ISO9013:2017-5.</li>
                  <li>All CAD files provided by the customer are treated as 1:1 scale and orientated to suit required grain direction.</li>
                  <li>Shipping is in compliance with Incoterms® 2020, or International Commercial Terms, of the globally-recognised international trade rules for the sale of goods.</li>
                  <li><strong>Delivery charges are provided as estimates only and will be adjusted to reflect the actual carrier invoice upon receipt, unless otherwise stated.</strong></li>
                </ul>
              </div>
            </div>
          </div>
          
          <div class="page-footer">
            <img src="${footerImage}" alt="${brandName} Footer">
          </div>
        </div>

        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
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
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePrintQuote(selectedQuote)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-700 text-white text-sm rounded hover:bg-zinc-600"
                >
                  🖨️ Print
                </button>
                <button
                  onClick={() => setSelectedQuote(null)}
                  className="text-zinc-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
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

            <div className="bg-zinc-800 px-6 py-4 border-t border-zinc-700 flex justify-between sticky bottom-0">
              <button
                onClick={() => handlePrintQuote(selectedQuote)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black font-medium rounded hover:bg-amber-400"
              >
                🖨️ Print Quote
              </button>
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
