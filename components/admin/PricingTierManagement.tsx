import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

interface PricingTier {
  id: string;
  name: string;
  code: string;
  markup_percentage: number;
  min_order_value: number | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  is_public_default: boolean;
  distributor_count?: number;
}

const PricingTierManagement: React.FC = () => {
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTier, setEditingTier] = useState<PricingTier | null>(null);
  const [saving, setSaving] = useState(false);

  // Load pricing tiers with distributor counts
  const loadTiers = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get tiers
      const { data: tiersData, error: tiersError } = await supabase
        .from('pricing_tiers')
        .select('*')
        .order('sort_order');

      if (tiersError) throw tiersError;

      // Get distributor counts per tier
      const { data: countData, error: countError } = await supabase
        .from('distributors')
        .select('pricing_tier_id')
        .eq('is_active', true);

      if (countError) throw countError;

      // Merge counts
      const tierCounts = countData?.reduce((acc: Record<string, number>, d) => {
        if (d.pricing_tier_id) {
          acc[d.pricing_tier_id] = (acc[d.pricing_tier_id] || 0) + 1;
        }
        return acc;
      }, {}) || {};

      const tiersWithCounts = (tiersData || []).map(tier => ({
        ...tier,
        distributor_count: tierCounts[tier.id] || 0,
      }));

      setTiers(tiersWithCounts);
    } catch (err: any) {
      console.error('Error loading tiers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTiers();
  }, []);

  // Save tier changes
  const handleSave = async (tier: PricingTier) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('pricing_tiers')
        .update({
          name: tier.name,
          code: tier.code,
          markup_percentage: tier.markup_percentage,
          min_order_value: tier.min_order_value,
          description: tier.description,
          sort_order: tier.sort_order,
          is_active: tier.is_active,
        })
        .eq('id', tier.id);

      if (error) throw error;

      await loadTiers();
      setEditingTier(null);
    } catch (err: any) {
      console.error('Error saving tier:', err);
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Create new tier
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTier, setNewTier] = useState({
    name: '',
    code: '',
    markup_percentage: 0,
    description: '',
  });

  const handleCreateTier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const maxOrder = Math.max(...tiers.map(t => t.sort_order), 0);

      const { error } = await supabase
        .from('pricing_tiers')
        .insert({
          name: newTier.name,
          code: newTier.code.toUpperCase(),
          markup_percentage: newTier.markup_percentage,
          description: newTier.description || null,
          sort_order: maxOrder + 1,
          is_active: true,
        });

      if (error) throw error;

      setNewTier({ name: '', code: '', markup_percentage: 0, description: '' });
      setShowNewForm(false);
      await loadTiers();
    } catch (err: any) {
      console.error('Error creating tier:', err);
      alert(`Failed to create tier: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Quick markup update
  const handleQuickMarkupChange = async (tierId: string, newMarkup: number) => {
    console.log('Updating tier:', tierId, 'to markup:', newMarkup);
    try {
      const { data, error } = await supabase
        .from('pricing_tiers')
        .update({ markup_percentage: newMarkup })
        .eq('id', tierId)
        .select();

      console.log('Update result:', { data, error });

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('No rows updated - RLS policy may be blocking the update');
      }

      // Update local state with actual returned data
      setTiers(tiers.map(t => 
        t.id === tierId ? { ...t, markup_percentage: data[0].markup_percentage } : t
      ));
    } catch (err: any) {
      console.error('Error updating markup:', err);
      alert(`Failed to update pricing tier: ${err.message}`);
      // Reload to get actual values
      loadTiers();
    }
  };

  // Reorder tiers
  const handleReorder = async (tierId: string, direction: 'up' | 'down') => {
    const currentIndex = tiers.findIndex(t => t.id === tierId);
    if (currentIndex === -1) return;
    
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= tiers.length) return;

    const currentTier = tiers[currentIndex];
    const swapTier = tiers[swapIndex];

    try {
      // Swap sort_order values
      const { error: error1 } = await supabase
        .from('pricing_tiers')
        .update({ sort_order: swapTier.sort_order })
        .eq('id', currentTier.id);

      if (error1) throw error1;

      const { error: error2 } = await supabase
        .from('pricing_tiers')
        .update({ sort_order: currentTier.sort_order })
        .eq('id', swapTier.id);

      if (error2) throw error2;

      // Update local state
      const newTiers = [...tiers];
      newTiers[currentIndex] = { ...swapTier, sort_order: currentTier.sort_order };
      newTiers[swapIndex] = { ...currentTier, sort_order: swapTier.sort_order };
      newTiers.sort((a, b) => a.sort_order - b.sort_order);
      setTiers(newTiers);
    } catch (err: any) {
      console.error('Error reordering:', err);
      alert(`Failed to reorder: ${err.message}`);
      loadTiers();
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
          <h1 className="text-3xl font-bold mb-2">Pricing Tiers</h1>
          <p className="text-zinc-400">Manage markup tiers. Wholesale is base cost, Cash Sale (25%) is public price.</p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="bg-amber-500 text-black font-bold px-4 py-2 rounded hover:bg-amber-400"
        >
          {showNewForm ? 'Cancel' : '+ Add Tier'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* New Tier Form */}
      {showNewForm && (
        <div className="bg-zinc-900 border border-amber-500/50 rounded-lg p-6">
          <h3 className="font-bold text-white mb-4">Create New Pricing Tier</h3>
          <form onSubmit={handleCreateTier} className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">TIER NAME *</label>
              <input
                type="text"
                required
                value={newTier.name}
                onChange={(e) => setNewTier({ ...newTier, name: e.target.value })}
                placeholder="Diamond Partner"
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">CODE *</label>
              <input
                type="text"
                required
                value={newTier.code}
                onChange={(e) => setNewTier({ ...newTier, code: e.target.value.toUpperCase() })}
                placeholder="DIAMOND"
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-500 mb-2">MARKUP %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={newTier.markup_percentage}
                onChange={(e) => setNewTier({ ...newTier, markup_percentage: parseFloat(e.target.value) || 0 })}
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-amber-500 text-black font-bold px-6 py-3 rounded hover:bg-amber-400 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Tier'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pricing Visual */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h3 className="text-sm font-bold text-zinc-400 uppercase mb-4">Markup Structure Overview</h3>
        <p className="text-xs text-zinc-500 mb-4">
          Wholesale (0%) is base cost. Public sees Cash Sale price (25% markup). Other tiers for specific customers.
        </p>
        <div className="flex items-end gap-4 h-48">
          {tiers.filter(t => t.is_active).map((tier) => (
            <div key={tier.id} className="flex-1 flex flex-col items-center">
              <div 
                className={`w-full rounded-t-lg transition-all relative group ${
                  tier.is_public_default 
                    ? 'bg-gradient-to-t from-green-500 to-green-600' 
                    : tier.markup_percentage === 0 
                      ? 'bg-gradient-to-t from-zinc-600 to-zinc-500'
                      : 'bg-gradient-to-t from-amber-500 to-amber-600'
                }`}
                style={{ height: `${Math.max(tier.markup_percentage * 6, 20)}px` }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-amber-500 font-bold text-lg">
                  +{tier.markup_percentage}%
                </div>
              </div>
              <div className="mt-2 text-center">
                <div className="text-white font-medium text-sm">{tier.name}</div>
                {tier.is_public_default && (
                  <div className="text-xs text-green-400 font-bold">PUBLIC</div>
                )}
                <div className="text-xs text-zinc-500">{tier.distributor_count || 0} customers</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tiers Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="bg-zinc-800 px-6 py-4 border-b border-zinc-700">
          <h3 className="font-bold text-white">All Pricing Tiers</h3>
        </div>

        <table className="w-full">
          <thead className="bg-zinc-950 text-xs text-zinc-500 uppercase">
            <tr>
              <th className="text-center px-3 py-3 w-20">Order</th>
              <th className="text-left px-6 py-3">Tier</th>
              <th className="text-left px-6 py-3">Code</th>
              <th className="text-left px-6 py-3">Markup %</th>
              <th className="text-left px-6 py-3">Example ($1000)</th>
              <th className="text-left px-6 py-3">Customers</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-left px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {tiers.map((tier, index) => (
              <tr key={tier.id} className={`hover:bg-zinc-800/50 ${!tier.is_active ? 'opacity-50' : ''}`}>
                <td className="px-3 py-4">
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => handleReorder(tier.id, 'up')}
                      disabled={index === 0}
                      className="text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed p-1"
                      title="Move up"
                    >
                      ▲
                    </button>
                    <span className="text-zinc-600 text-xs">{index + 1}</span>
                    <button
                      onClick={() => handleReorder(tier.id, 'down')}
                      disabled={index === tiers.length - 1}
                      className="text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed p-1"
                      title="Move down"
                    >
                      ▼
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-white">{tier.name}</div>
                  {tier.description && (
                    <div className="text-xs text-zinc-500">{tier.description}</div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className="font-mono text-amber-500">{tier.code}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={tier.markup_percentage}
                      onChange={(e) => handleQuickMarkupChange(tier.id, parseFloat(e.target.value) || 0)}
                      className="w-20 bg-zinc-800 border border-zinc-700 text-white text-center p-2 rounded focus:border-amber-500 outline-none"
                    />
                    <span className="text-zinc-500">%</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {tier.min_order_value ? (
                    <span className="text-zinc-300">${tier.min_order_value.toLocaleString()}</span>
                  ) : (
                    <span className="text-zinc-600">-</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    (tier.distributor_count || 0) > 0 
                      ? 'bg-green-900/30 text-green-400' 
                      : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {tier.distributor_count || 0}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {tier.is_active ? (
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
                  <button
                    onClick={() => setEditingTier(tier)}
                    className="text-xs text-zinc-400 hover:text-white px-3 py-1 bg-zinc-700 rounded"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingTier && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg">
            <div className="bg-zinc-800 px-6 py-4 border-b border-zinc-700 flex justify-between items-center">
              <h3 className="font-bold text-white text-lg">Edit Pricing Tier</h3>
              <button
                onClick={() => setEditingTier(null)}
                className="text-zinc-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">TIER NAME</label>
                  <input
                    type="text"
                    value={editingTier.name}
                    onChange={(e) => setEditingTier({ ...editingTier, name: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">CODE</label>
                  <input
                    type="text"
                    value={editingTier.code}
                    onChange={(e) => setEditingTier({ ...editingTier, code: e.target.value.toUpperCase() })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">DISCOUNT PERCENTAGE</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={editingTier.markup_percentage}
                      onChange={(e) => setEditingTier({ ...editingTier, markup_percentage: parseFloat(e.target.value) || 0 })}
                      className="flex-1 bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                    />
                    <span className="text-zinc-500 text-xl">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">MIN ORDER VALUE</label>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">$</span>
                    <input
                      type="number"
                      min="0"
                      value={editingTier.min_order_value || ''}
                      onChange={(e) => setEditingTier({ ...editingTier, min_order_value: parseFloat(e.target.value) || null })}
                      placeholder="Optional"
                      className="flex-1 bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-2">DESCRIPTION</label>
                <input
                  type="text"
                  value={editingTier.description || ''}
                  onChange={(e) => setEditingTier({ ...editingTier, description: e.target.value })}
                  placeholder="Short description of this tier..."
                  className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-zinc-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingTier.is_active}
                    onChange={(e) => setEditingTier({ ...editingTier, is_active: e.target.checked })}
                    className="w-5 h-5"
                  />
                  <span className="text-white">Active</span>
                </label>
                {(editingTier.distributor_count || 0) > 0 && !editingTier.is_active && (
                  <span className="text-amber-500 text-sm">
                    ⚠️ {editingTier.distributor_count} distributors will lose this tier
                  </span>
                )}
              </div>
            </div>

            <div className="bg-zinc-800 px-6 py-4 border-t border-zinc-700 flex justify-end gap-3">
              <button
                onClick={() => setEditingTier(null)}
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave(editingTier)}
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

export default PricingTierManagement;
