import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

interface PricingTier {
  id: string;
  name: string;
  code: string;
  markup_percentage: number;
}

interface Distributor {
  id: string;
  user_id: string;
  company_name: string;
  trading_name: string | null;
  abn: string | null;
  account_number: string;
  pricing_tier_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address_line1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  is_active: boolean;
  is_approved: boolean;
  internal_notes: string | null;
  created_at: string;
  pricing_tier?: PricingTier;
}

const DistributorManagement: React.FC = () => {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDistributor, setSelectedDistributor] = useState<Distributor | null>(null);
  const [saving, setSaving] = useState(false);

  // Load distributors and pricing tiers
  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load pricing tiers
      const { data: tiersData, error: tiersError } = await supabase
        .from('pricing_tiers')
        .select('*')
        .order('sort_order');

      if (tiersError) throw tiersError;
      setPricingTiers(tiersData || []);

      // Load distributors with their tier info
      const { data: distData, error: distError } = await supabase
        .from('distributors')
        .select(`
          *,
          pricing_tier:pricing_tiers(id, name, code, discount_percentage)
        `)
        .order('company_name');

      if (distError) throw distError;
      setDistributors(distData || []);
    } catch (err: any) {
      console.error('Error loading distributors:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update distributor
  const handleSave = async (distributor: Distributor) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('distributors')
        .update({
          company_name: distributor.company_name,
          trading_name: distributor.trading_name,
          abn: distributor.abn,
          pricing_tier_id: distributor.pricing_tier_id,
          contact_name: distributor.contact_name,
          contact_email: distributor.contact_email,
          contact_phone: distributor.contact_phone,
          address_line1: distributor.address_line1,
          suburb: distributor.suburb,
          state: distributor.state,
          postcode: distributor.postcode,
          is_active: distributor.is_active,
          is_approved: distributor.is_approved,
          internal_notes: distributor.internal_notes,
        })
        .eq('id', distributor.id);

      if (error) throw error;

      // Reload data
      await loadData();
      setSelectedDistributor(null);
    } catch (err: any) {
      console.error('Error saving distributor:', err);
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Toggle approval
  const handleToggleApproval = async (distributor: Distributor) => {
    try {
      const { error } = await supabase
        .from('distributors')
        .update({ 
          is_approved: !distributor.is_approved,
          approved_at: !distributor.is_approved ? new Date().toISOString() : null,
        })
        .eq('id', distributor.id);

      if (error) throw error;
      await loadData();
    } catch (err: any) {
      console.error('Error toggling approval:', err);
      alert(`Failed to update: ${err.message}`);
    }
  };

  // Create new distributor (form state)
  const [showNewForm, setShowNewForm] = useState(false);
  const [newDistributor, setNewDistributor] = useState({
    user_id: '',
    company_name: '',
    contact_email: '',
    pricing_tier_id: '',
  });

  const handleCreateDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // First, check if user exists and add distributor role
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({ 
          user_id: newDistributor.user_id, 
          role: 'distributor' 
        }, { 
          onConflict: 'user_id,role' 
        });

      if (roleError) {
        console.warn('Role assignment warning:', roleError);
      }

      // Create distributor record
      const { error } = await supabase
        .from('distributors')
        .insert({
          user_id: newDistributor.user_id,
          company_name: newDistributor.company_name,
          contact_email: newDistributor.contact_email,
          pricing_tier_id: newDistributor.pricing_tier_id || null,
          is_approved: true, // Auto-approve when admin creates
        });

      if (error) throw error;

      // Reset form and reload
      setNewDistributor({ user_id: '', company_name: '', contact_email: '', pricing_tier_id: '' });
      setShowNewForm(false);
      await loadData();
    } catch (err: any) {
      console.error('Error creating distributor:', err);
      alert(`Failed to create distributor: ${err.message}`);
    } finally {
      setSaving(false);
    }
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
          <h1 className="text-3xl font-bold mb-2">Distributor Accounts</h1>
          <p className="text-zinc-400">Manage distributor companies and their pricing tiers.</p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="bg-amber-500 text-black font-bold px-4 py-2 rounded hover:bg-amber-400"
        >
          {showNewForm ? 'Cancel' : '+ Add Distributor'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* New Distributor Form */}
      {showNewForm && (
        <div className="bg-zinc-900 border border-amber-500/50 rounded-lg p-6">
          <h3 className="font-bold text-white mb-4">Add New Distributor</h3>
          <form onSubmit={handleCreateDistributor} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">USER ID *</label>
              <input
                type="text"
                required
                value={newDistributor.user_id}
                onChange={(e) => setNewDistributor({ ...newDistributor, user_id: e.target.value })}
                placeholder="UUID from auth.users"
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none font-mono text-sm"
              />
              <p className="text-xs text-zinc-500 mt-1">Find in Supabase Dashboard → Authentication → Users</p>
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">COMPANY NAME *</label>
              <input
                type="text"
                required
                value={newDistributor.company_name}
                onChange={(e) => setNewDistributor({ ...newDistributor, company_name: e.target.value })}
                placeholder="Company Pty Ltd"
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">CONTACT EMAIL</label>
              <input
                type="email"
                value={newDistributor.contact_email}
                onChange={(e) => setNewDistributor({ ...newDistributor, contact_email: e.target.value })}
                placeholder="contact@company.com"
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">PRICING TIER</label>
              <select
                value={newDistributor.pricing_tier_id}
                onChange={(e) => setNewDistributor({ ...newDistributor, pricing_tier_id: e.target.value })}
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              >
                <option value="">Select a tier...</option>
                {pricingTiers.map(tier => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name} (+{tier.markup_percentage}%)
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-amber-500 text-black font-bold px-6 py-2 rounded hover:bg-amber-400 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Distributor'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Distributors Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="bg-zinc-800 px-6 py-4 border-b border-zinc-700">
          <h3 className="font-bold text-white">Distributors ({distributors.length})</h3>
        </div>

        {distributors.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            No distributors yet. Click "Add Distributor" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-950 text-xs text-zinc-500 uppercase">
                <tr>
                  <th className="text-left px-6 py-3">Company</th>
                  <th className="text-left px-6 py-3">Account #</th>
                  <th className="text-left px-6 py-3">Pricing Tier</th>
                  <th className="text-left px-6 py-3">Status</th>
                  <th className="text-left px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {distributors.map(dist => (
                  <tr key={dist.id} className="hover:bg-zinc-800/50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{dist.company_name}</div>
                      {dist.contact_email && (
                        <div className="text-xs text-zinc-500">{dist.contact_email}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-amber-500">{dist.account_number}</span>
                    </td>
                    <td className="px-6 py-4">
                      {dist.pricing_tier ? (
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-green-900/30 text-green-400">
                          {dist.pricing_tier.name}
                          <span className="text-green-600">(+{dist.pricing_tier.markup_percentage}%)</span>
                        </span>
                      ) : (
                        <span className="text-zinc-500 italic">No tier assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {dist.is_approved ? (
                          <span className="px-2 py-1 rounded text-xs font-bold bg-green-900/30 text-green-400">
                            Approved
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded text-xs font-bold bg-amber-900/30 text-amber-400">
                            Pending
                          </span>
                        )}
                        {!dist.is_active && (
                          <span className="px-2 py-1 rounded text-xs font-bold bg-red-900/30 text-red-400">
                            Inactive
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedDistributor(dist)}
                          className="text-xs text-zinc-400 hover:text-white px-3 py-1 bg-zinc-700 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleApproval(dist)}
                          className={`text-xs px-3 py-1 rounded ${
                            dist.is_approved
                              ? 'text-red-400 hover:bg-red-900/30'
                              : 'text-green-400 hover:bg-green-900/30'
                          }`}
                        >
                          {dist.is_approved ? 'Revoke' : 'Approve'}
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
      {selectedDistributor && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-zinc-800 px-6 py-4 border-b border-zinc-700 flex justify-between items-center sticky top-0">
              <h3 className="font-bold text-white text-lg">Edit Distributor</h3>
              <button
                onClick={() => setSelectedDistributor(null)}
                className="text-zinc-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">COMPANY NAME</label>
                  <input
                    type="text"
                    value={selectedDistributor.company_name}
                    onChange={(e) => setSelectedDistributor({ ...selectedDistributor, company_name: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">TRADING NAME</label>
                  <input
                    type="text"
                    value={selectedDistributor.trading_name || ''}
                    onChange={(e) => setSelectedDistributor({ ...selectedDistributor, trading_name: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">ABN</label>
                  <input
                    type="text"
                    value={selectedDistributor.abn || ''}
                    onChange={(e) => setSelectedDistributor({ ...selectedDistributor, abn: e.target.value })}
                    placeholder="XX XXX XXX XXX"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">PRICING TIER</label>
                  <select
                    value={selectedDistributor.pricing_tier_id || ''}
                    onChange={(e) => setSelectedDistributor({ ...selectedDistributor, pricing_tier_id: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  >
                    <option value="">No tier (retail pricing)</option>
                    {pricingTiers.map(tier => (
                      <option key={tier.id} value={tier.id}>
                        {tier.name} (+{tier.markup_percentage}%)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <h4 className="text-sm font-bold text-zinc-400 uppercase mb-3">Contact Details</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2">NAME</label>
                    <input
                      type="text"
                      value={selectedDistributor.contact_name || ''}
                      onChange={(e) => setSelectedDistributor({ ...selectedDistributor, contact_name: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2">EMAIL</label>
                    <input
                      type="email"
                      value={selectedDistributor.contact_email || ''}
                      onChange={(e) => setSelectedDistributor({ ...selectedDistributor, contact_email: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2">PHONE</label>
                    <input
                      type="tel"
                      value={selectedDistributor.contact_phone || ''}
                      onChange={(e) => setSelectedDistributor({ ...selectedDistributor, contact_phone: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <h4 className="text-sm font-bold text-zinc-400 uppercase mb-3">Address</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-mono text-zinc-500 mb-2">STREET ADDRESS</label>
                    <input
                      type="text"
                      value={selectedDistributor.address_line1 || ''}
                      onChange={(e) => setSelectedDistributor({ ...selectedDistributor, address_line1: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-zinc-500 mb-2">SUBURB</label>
                    <input
                      type="text"
                      value={selectedDistributor.suburb || ''}
                      onChange={(e) => setSelectedDistributor({ ...selectedDistributor, suburb: e.target.value })}
                      className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono text-zinc-500 mb-2">STATE</label>
                      <select
                        value={selectedDistributor.state || ''}
                        onChange={(e) => setSelectedDistributor({ ...selectedDistributor, state: e.target.value })}
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
                        value={selectedDistributor.postcode || ''}
                        onChange={(e) => setSelectedDistributor({ ...selectedDistributor, postcode: e.target.value })}
                        className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <label className="block text-xs font-mono text-zinc-500 mb-2">INTERNAL NOTES</label>
                <textarea
                  value={selectedDistributor.internal_notes || ''}
                  onChange={(e) => setSelectedDistributor({ ...selectedDistributor, internal_notes: e.target.value })}
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none resize-none"
                  placeholder="Internal notes about this distributor..."
                />
              </div>

              <div className="border-t border-zinc-800 pt-4 flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedDistributor.is_active}
                    onChange={(e) => setSelectedDistributor({ ...selectedDistributor, is_active: e.target.checked })}
                    className="w-5 h-5"
                  />
                  <span className="text-white">Active Account</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedDistributor.is_approved}
                    onChange={(e) => setSelectedDistributor({ ...selectedDistributor, is_approved: e.target.checked })}
                    className="w-5 h-5"
                  />
                  <span className="text-white">Approved</span>
                </label>
              </div>
            </div>

            <div className="bg-zinc-800 px-6 py-4 border-t border-zinc-700 flex justify-end gap-3 sticky bottom-0">
              <button
                onClick={() => setSelectedDistributor(null)}
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave(selectedDistributor)}
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

export default DistributorManagement;
