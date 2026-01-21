import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

interface PricingTier {
  id: string;
  name: string;
  code: string;
  markup_percentage?: number;
}

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  user_id: string | null;
}

interface Customer {
  id: string;
  company_name: string;
  trading_name: string | null;
  abn: string | null;
  account_number: string | null;
  netsuite_id: string | null;
  company_type: string;
  pricing_tier_id: string | null;
  address_line1: string | null;
  address_line2: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  credit_limit: number | null;
  payment_terms: string | null;
  is_active: boolean;
  is_approved: boolean;
  internal_notes: string | null;
  created_at: string;
  pricing_tier?: PricingTier | null;
  contacts?: Contact[];
}

const COMPANY_TYPES = [
  { value: 'retail', label: 'Retail', color: 'bg-blue-500' },
  { value: 'distributor', label: 'Distributor', color: 'bg-green-500' },
  { value: 'reseller', label: 'Reseller', color: 'bg-purple-500' },
  { value: 'wholesale', label: 'Wholesale', color: 'bg-amber-500' },
  { value: 'government', label: 'Government', color: 'bg-red-500' },
  { value: 'education', label: 'Education', color: 'bg-cyan-500' },
  { value: 'trade', label: 'Trade', color: 'bg-orange-500' },
  { value: 'export', label: 'Export', color: 'bg-indigo-500' },
  { value: 'vip', label: 'VIP', color: 'bg-pink-500' },
  { value: 'internal', label: 'Internal', color: 'bg-zinc-500' },
];

const CustomerManagement: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Load customers and pricing tiers
  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load pricing tiers
      const { data: tiersData, error: tiersError } = await supabase
        .from('pricing_tiers')
        .select('id, name, code, markup_percentage')
        .order('sort_order');

      if (tiersError) throw tiersError;
      setPricingTiers(tiersData || []);

      // Load companies with pricing tier and contacts
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select(`
          *,
          pricing_tier:pricing_tiers(id, name, code, markup_percentage),
          contacts(id, first_name, last_name, email, phone, is_primary, user_id)
        `)
        .order('company_name');

      if (companyError) throw companyError;
      setCustomers(companyData || []);
    } catch (err: any) {
      console.error('Error loading customers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save customer
  const handleSave = async (customer: Customer) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          company_name: customer.company_name,
          trading_name: customer.trading_name,
          abn: customer.abn,
          netsuite_id: customer.netsuite_id,
          company_type: customer.company_type,
          pricing_tier_id: customer.pricing_tier_id,
          address_line1: customer.address_line1,
          address_line2: customer.address_line2,
          suburb: customer.suburb,
          state: customer.state,
          postcode: customer.postcode,
          country: customer.country,
          credit_limit: customer.credit_limit,
          payment_terms: customer.payment_terms,
          is_active: customer.is_active,
          is_approved: customer.is_approved,
          internal_notes: customer.internal_notes,
        })
        .eq('id', customer.id);

      if (error) throw error;

      await loadData();
      setSelectedCustomer(null);
    } catch (err: any) {
      console.error('Error saving customer:', err);
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Toggle approval
  const handleToggleApproval = async (customer: Customer) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ is_approved: !customer.is_approved })
        .eq('id', customer.id);

      if (error) throw error;
      await loadData();
    } catch (err: any) {
      console.error('Error toggling approval:', err);
      alert(`Failed to update: ${err.message}`);
    }
  };

  // Quick tier change
  const handleQuickTierChange = async (customerId: string, tierId: string | null) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ pricing_tier_id: tierId || null })
        .eq('id', customerId);

      if (error) throw error;
      
      setCustomers(customers.map(c => 
        c.id === customerId 
          ? { ...c, pricing_tier_id: tierId, pricing_tier: pricingTiers.find(t => t.id === tierId) || null }
          : c
      ));
    } catch (err: any) {
      console.error('Error updating tier:', err);
      alert(`Failed to update: ${err.message}`);
    }
  };

  // New customer form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    company_name: '',
    company_type: 'retail',
    pricing_tier_id: '',
    netsuite_id: '',
  });

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('companies')
        .insert({
          company_name: newCustomer.company_name,
          company_type: newCustomer.company_type,
          pricing_tier_id: newCustomer.pricing_tier_id || null,
          netsuite_id: newCustomer.netsuite_id || null,
          is_approved: true,
          is_active: true,
        });

      if (error) throw error;

      setNewCustomer({ company_name: '', company_type: 'retail', pricing_tier_id: '', netsuite_id: '' });
      setShowNewForm(false);
      await loadData();
    } catch (err: any) {
      console.error('Error creating customer:', err);
      alert(`Failed to create customer: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Filter customers
  const filteredCustomers = customers.filter(c => {
    const matchesCategory = categoryFilter === 'all' || c.company_type === categoryFilter;
    const matchesSearch = searchTerm === '' || 
      c.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.account_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.netsuite_id?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Category badge color
  const getCategoryColor = (category: string) => {
    return COMPANY_TYPES.find(c => c.value === category)?.color || 'bg-zinc-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">Customer Accounts</h1>
          <p className="text-zinc-400">Manage customers, pricing tiers, and NetSuite integration.</p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="bg-amber-500 text-black font-bold px-4 py-2 rounded hover:bg-amber-400"
        >
          {showNewForm ? 'Cancel' : '+ Add Customer'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* New Customer Form */}
      {showNewForm && (
        <div className="bg-zinc-900 border border-amber-500/50 rounded-lg p-6">
          <h3 className="font-bold text-white mb-4">Add New Customer</h3>
          <form onSubmit={handleCreateCustomer} className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">COMPANY NAME *</label>
              <input
                type="text"
                required
                value={newCustomer.company_name}
                onChange={(e) => setNewCustomer({ ...newCustomer, company_name: e.target.value })}
                placeholder="Company Pty Ltd"
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">NETSUITE ID</label>
              <input
                type="text"
                value={newCustomer.netsuite_id}
                onChange={(e) => setNewCustomer({ ...newCustomer, netsuite_id: e.target.value })}
                placeholder="e.g. CUST-12345"
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">TYPE</label>
              <select
                value={newCustomer.company_type}
                onChange={(e) => setNewCustomer({ ...newCustomer, company_type: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              >
                {COMPANY_TYPES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">PRICING TIER</label>
              <select
                value={newCustomer.pricing_tier_id}
                onChange={(e) => setNewCustomer({ ...newCustomer, pricing_tier_id: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              >
                <option value="">Cash Sale (default)</option>
                {pricingTiers.map(tier => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name} ({tier.markup_percentage || 0}%)
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-amber-500 text-black font-bold px-6 py-3 rounded hover:bg-amber-400 disabled:opacity-50 w-full"
              >
                {saving ? 'Creating...' : 'Create Customer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search by name, account #, or NetSuite ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 max-w-md bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
        >
          <option value="all">All Types</option>
          {COMPANY_TYPES.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
        <span className="text-sm text-zinc-500">
          {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Customers Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            No customers found. Click "Add Customer" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-950 text-xs text-zinc-500 uppercase">
                <tr>
                  <th className="text-left px-6 py-3">Company</th>
                  <th className="text-left px-6 py-3">Type</th>
                  <th className="text-left px-6 py-3">Account #</th>
                  <th className="text-left px-6 py-3">NetSuite</th>
                  <th className="text-left px-6 py-3">Pricing Tier</th>
                  <th className="text-left px-6 py-3">Status</th>
                  <th className="text-left px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-zinc-800/50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{customer.company_name}</div>
                      {customer.trading_name && customer.trading_name !== customer.company_name && (
                        <div className="text-xs text-zinc-400">t/a {customer.trading_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold text-white ${getCategoryColor(customer.company_type)}`}>
                        {COMPANY_TYPES.find(c => c.value === customer.company_type)?.label || customer.company_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-amber-500">{customer.account_number || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-zinc-400">{customer.netsuite_id || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={customer.pricing_tier_id || ''}
                        onChange={(e) => handleQuickTierChange(customer.id, e.target.value)}
                        className="bg-zinc-800 border border-zinc-700 text-white text-sm px-2 py-1 rounded focus:border-amber-500 outline-none"
                      >
                        <option value="">Cash Sale</option>
                        {pricingTiers.map(tier => (
                          <option key={tier.id} value={tier.id}>
                            {tier.name} ({tier.markup_percentage || 0}%)
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {customer.is_approved ? (
                          <span className="px-2 py-1 rounded text-xs font-bold bg-green-900/30 text-green-400">
                            Approved
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded text-xs font-bold bg-amber-900/30 text-amber-400">
                            Pending
                          </span>
                        )}
                        {!customer.is_active && (
                          <span className="px-2 py-1 rounded text-xs font-bold bg-red-900/30 text-red-400">
                            Inactive
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedCustomer(customer)}
                          className="text-xs text-zinc-400 hover:text-white px-3 py-1 bg-zinc-700 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleApproval(customer)}
                          className={`text-xs px-3 py-1 rounded ${
                            customer.is_approved
                              ? 'text-red-400 hover:bg-red-900/30'
                              : 'text-green-400 hover:bg-green-900/30'
                          }`}
                        >
                          {customer.is_approved ? 'Revoke' : 'Approve'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="bg-zinc-800 px-6 py-4 border-b border-zinc-700 flex justify-between items-center sticky top-0">
              <h3 className="font-bold text-white text-lg">Edit Customer</h3>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-zinc-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">COMPANY NAME</label>
                  <input
                    type="text"
                    value={selectedCustomer.company_name}
                    onChange={(e) => setSelectedCustomer({ ...selectedCustomer, company_name: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">TRADING NAME</label>
                  <input
                    type="text"
                    value={selectedCustomer.trading_name || ''}
                    onChange={(e) => setSelectedCustomer({ ...selectedCustomer, trading_name: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">ABN</label>
                  <input
                    type="text"
                    value={selectedCustomer.abn || ''}
                    onChange={(e) => setSelectedCustomer({ ...selectedCustomer, abn: e.target.value })}
                    placeholder="XX XXX XXX XXX"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">COUNTRY</label>
                  <input
                    type="text"
                    value={selectedCustomer.country || 'Australia'}
                    onChange={(e) => setSelectedCustomer({ ...selectedCustomer, country: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Classification & Pricing */}
              <div className="border-t border-zinc-800 pt-4">
                <h4 className="text-sm font-bold text-zinc-400 uppercase mb-3">Classification & Pricing</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2">TYPE</label>
                    <select
                      value={selectedCustomer.company_type || 'retail'}
                      onChange={(e) => setSelectedCustomer({ ...selectedCustomer, company_type: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                    >
                      {COMPANY_TYPES.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2">PRICING TIER</label>
                    <select
                      value={selectedCustomer.pricing_tier_id || ''}
                      onChange={(e) => setSelectedCustomer({ ...selectedCustomer, pricing_tier_id: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                    >
                      <option value="">Cash Sale (default)</option>
                      {pricingTiers.map(tier => (
                        <option key={tier.id} value={tier.id}>
                          {tier.name} ({tier.markup_percentage || 0}%)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2">CREDIT LIMIT</label>
                    <input
                      type="number"
                      value={selectedCustomer.credit_limit || ''}
                      onChange={(e) => setSelectedCustomer({ ...selectedCustomer, credit_limit: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="e.g. 50000"
                      className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* NetSuite & Account Info */}
              <div className="border-t border-zinc-800 pt-4">
                <h4 className="text-sm font-bold text-zinc-400 uppercase mb-3">Account Integration</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2">ACCOUNT NUMBER</label>
                    <input
                      type="text"
                      value={selectedCustomer.account_number || ''}
                      disabled
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-500 p-3 rounded font-mono"
                    />
                    <p className="text-xs text-zinc-600 mt-1">Auto-generated</p>
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2">NETSUITE ID</label>
                    <input
                      type="text"
                      value={selectedCustomer.netsuite_id || ''}
                      onChange={(e) => setSelectedCustomer({ ...selectedCustomer, netsuite_id: e.target.value })}
                      placeholder="e.g. CUST-12345"
                      className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2">PAYMENT TERMS</label>
                    <select
                      value={selectedCustomer.payment_terms || '30 days'}
                      onChange={(e) => setSelectedCustomer({ ...selectedCustomer, payment_terms: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                    >
                      <option value="COD">COD (Cash on Delivery)</option>
                      <option value="7 days">Net 7 days</option>
                      <option value="14 days">Net 14 days</option>
                      <option value="30 days">Net 30 days</option>
                      <option value="60 days">Net 60 days</option>
                      <option value="EOM">End of Month</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="border-t border-zinc-800 pt-4">
                <h4 className="text-sm font-bold text-zinc-400 uppercase mb-3">Address</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-mono text-zinc-500 mb-2">ADDRESS LINE 1</label>
                    <input
                      type="text"
                      value={selectedCustomer.address_line1 || ''}
                      onChange={(e) => setSelectedCustomer({ ...selectedCustomer, address_line1: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-mono text-zinc-500 mb-2">ADDRESS LINE 2</label>
                    <input
                      type="text"
                      value={selectedCustomer.address_line2 || ''}
                      onChange={(e) => setSelectedCustomer({ ...selectedCustomer, address_line2: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2">SUBURB</label>
                    <input
                      type="text"
                      value={selectedCustomer.suburb || ''}
                      onChange={(e) => setSelectedCustomer({ ...selectedCustomer, suburb: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono text-zinc-500 mb-2">STATE</label>
                      <select
                        value={selectedCustomer.state || ''}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, state: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                      >
                        <option value="">Select...</option>
                        <option value="NSW">NSW</option>
                        <option value="VIC">VIC</option>
                        <option value="QLD">QLD</option>
                        <option value="WA">WA</option>
                        <option value="SA">SA</option>
                        <option value="TAS">TAS</option>
                        <option value="ACT">ACT</option>
                        <option value="NT">NT</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-zinc-500 mb-2">POSTCODE</label>
                      <input
                        type="text"
                        value={selectedCustomer.postcode || ''}
                        onChange={(e) => setSelectedCustomer({ ...selectedCustomer, postcode: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Internal Notes */}
              <div className="border-t border-zinc-800 pt-4">
                <label className="block text-xs font-mono text-zinc-500 mb-2">INTERNAL NOTES</label>
                <textarea
                  value={selectedCustomer.internal_notes || ''}
                  onChange={(e) => setSelectedCustomer({ ...selectedCustomer, internal_notes: e.target.value })}
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none resize-none"
                  placeholder="Internal notes about this customer..."
                />
              </div>

              {/* Status */}
              <div className="border-t border-zinc-800 pt-4 flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCustomer.is_active}
                    onChange={(e) => setSelectedCustomer({ ...selectedCustomer, is_active: e.target.checked })}
                    className="w-5 h-5"
                  />
                  <span className="text-white">Active Account</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCustomer.is_approved}
                    onChange={(e) => setSelectedCustomer({ ...selectedCustomer, is_approved: e.target.checked })}
                    className="w-5 h-5"
                  />
                  <span className="text-white">Approved for Pricing</span>
                </label>
              </div>
            </div>

            <div className="bg-zinc-800 px-6 py-4 border-t border-zinc-700 flex justify-end gap-3 sticky bottom-0">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave(selectedCustomer)}
                disabled={saving}
                className="bg-amber-500 text-black font-bold px-6 py-2 rounded hover:bg-amber-400 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerManagement;
