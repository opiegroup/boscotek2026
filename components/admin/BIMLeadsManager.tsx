import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { BIMLead, BIMExport, LeadStage, SalesRep } from '../../types';

// Pipeline stage configuration
const LEAD_STAGES: { id: LeadStage; label: string; color: string; bgColor: string }[] = [
  { id: 'bim_downloaded', label: 'BIM Downloaded', color: 'text-blue-400', bgColor: 'bg-blue-900/30' },
  { id: 'not_contacted', label: 'Not Contacted', color: 'text-zinc-400', bgColor: 'bg-zinc-700/30' },
  { id: 'initial_email_sent', label: 'Initial Email Sent', color: 'text-cyan-400', bgColor: 'bg-cyan-900/30' },
  { id: 'follow_up_sent', label: 'Follow-Up Sent', color: 'text-purple-400', bgColor: 'bg-purple-900/30' },
  { id: 'call_meeting_booked', label: 'Call/Meeting Booked', color: 'text-amber-400', bgColor: 'bg-amber-900/30' },
  { id: 'quoted', label: 'Quoted', color: 'text-orange-400', bgColor: 'bg-orange-900/30' },
  { id: 'negotiation', label: 'Negotiation', color: 'text-pink-400', bgColor: 'bg-pink-900/30' },
  { id: 'won_order_placed', label: 'Won – Order Placed', color: 'text-green-400', bgColor: 'bg-green-900/30' },
  { id: 'lost_no_project', label: 'Lost – No Project', color: 'text-red-400', bgColor: 'bg-red-900/30' },
  { id: 'lost_competitor', label: 'Lost – Competitor', color: 'text-red-400', bgColor: 'bg-red-900/30' },
  { id: 'on_hold', label: 'On Hold / Dormant', color: 'text-zinc-500', bgColor: 'bg-zinc-800/30' },
];

const DEFAULT_SALES_REPS = ['Unassigned', 'Tristan', 'Marcus', 'Sarah', 'Other'];

// Load reps from localStorage or use defaults
const loadSalesReps = (): string[] => {
  try {
    const saved = localStorage.getItem('boscotek_sales_reps');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure 'Unassigned' is always first
      if (!parsed.includes('Unassigned')) {
        return ['Unassigned', ...parsed];
      }
      return parsed;
    }
  } catch (e) {
    console.error('Error loading sales reps:', e);
  }
  return DEFAULT_SALES_REPS;
};

const saveSalesReps = (reps: string[]) => {
  try {
    localStorage.setItem('boscotek_sales_reps', JSON.stringify(reps));
  } catch (e) {
    console.error('Error saving sales reps:', e);
  }
};

const NEXT_ACTIONS = [
  'Send intro email',
  'Follow up on quote',
  'Call to close',
  'Check project status',
  'Schedule meeting',
  'Send catalog',
  'No further action',
];

// Helper to format dates safely
const formatDate = (dateString?: string | null): string => {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-AU', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  } catch {
    return '—';
  }
};

const formatDateTime = (dateString?: string | null): string => {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-AU', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '—';
  }
};

const getStageConfig = (stageId: LeadStage) => {
  return LEAD_STAGES.find(s => s.id === stageId) || LEAD_STAGES[0];
};

// Calculate days since last contact
const getDaysSinceContact = (lastContactDate?: string | null): number | null => {
  if (!lastContactDate) return null;
  try {
    const date = new Date(lastContactDate);
    if (isNaN(date.getTime())) return null;
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
};

export const BIMLeadsManager: React.FC = () => {
  const [leads, setLeads] = useState<BIMLead[]>([]);
  const [exports, setExports] = useState<BIMExport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<BIMLead | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [filterRep, setFilterRep] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'pipeline'>('table');
  const [saving, setSaving] = useState(false);
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Sales reps management
  const [salesReps, setSalesReps] = useState<string[]>(loadSalesReps);
  const [showRepsModal, setShowRepsModal] = useState(false);
  const [newRepName, setNewRepName] = useState('');
  
  const addSalesRep = () => {
    const name = newRepName.trim();
    if (name && !salesReps.includes(name)) {
      const updated = [...salesReps, name];
      setSalesReps(updated);
      saveSalesReps(updated);
      setNewRepName('');
    }
  };
  
  const removeSalesRep = (rep: string) => {
    if (rep === 'Unassigned') return; // Can't remove Unassigned
    const updated = salesReps.filter(r => r !== rep);
    setSalesReps(updated);
    saveSalesReps(updated);
  };

  useEffect(() => {
    fetchLeads();
    fetchExports();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bim_leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      // Map database fields and set defaults for new fields
      const mappedLeads = (data || []).map((lead: any) => ({
        ...lead,
        lead_stage: lead.lead_stage || 'bim_downloaded',
        assigned_rep: lead.assigned_rep || 'Unassigned',
        contacted: lead.contacted || false,
        last_contact_date: lead.last_contact_date || null,
        next_action: lead.next_action || null,
        notes: lead.notes || '',
      }));

      setLeads(mappedLeads);
      setSelectedIds(new Set()); // Clear selection on refresh
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExports = async () => {
    try {
      const { data, error } = await supabase
        .from('bim_exports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setExports(data as any[] || []);
    } catch (error) {
      console.error('Error fetching exports:', error);
    }
  };

  const updateLead = async (leadId: string, updates: Partial<BIMLead>) => {
    setSaving(true);
    try {
      // Auto-update contacted and last_contact_date based on stage changes
      const finalUpdates = { ...updates };
      
      if (updates.lead_stage) {
        const contactedStages: LeadStage[] = [
          'initial_email_sent', 'follow_up_sent', 'call_meeting_booked', 
          'quoted', 'negotiation', 'won_order_placed'
        ];
        if (contactedStages.includes(updates.lead_stage)) {
          finalUpdates.contacted = true;
          if (!updates.last_contact_date) {
            finalUpdates.last_contact_date = new Date().toISOString();
          }
        }
      }

      // Try to update - if columns don't exist, the error will tell us
      const { error } = await supabase
        .from('bim_leads')
        .update(finalUpdates)
        .eq('id', leadId);

      if (error) {
        // Check if it's a column doesn't exist error
        if (error.message?.includes('column') || error.code === '42703') {
          // Show a more helpful error
          console.error('Database schema needs updating. Missing columns for pipeline fields.');
          alert('Database needs migration! The new pipeline columns (lead_stage, assigned_rep, etc.) need to be added to the bim_leads table. Check console for SQL migration script.');
          
          // Log the migration SQL
          console.log(`
-- Run this SQL in your Supabase SQL Editor to add the new columns:

ALTER TABLE bim_leads 
ADD COLUMN IF NOT EXISTS lead_stage TEXT DEFAULT 'bim_downloaded',
ADD COLUMN IF NOT EXISTS assigned_rep TEXT DEFAULT 'Unassigned',
ADD COLUMN IF NOT EXISTS contacted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_action TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_bim_leads_lead_stage ON bim_leads(lead_stage);
CREATE INDEX IF NOT EXISTS idx_bim_leads_assigned_rep ON bim_leads(assigned_rep);
          `);
          return;
        }
        throw error;
      }

      // Update local state
      setLeads(leads.map(lead => 
        lead.id === leadId ? { ...lead, ...finalUpdates } : lead
      ));

      // Update selected lead if open
      if (selectedLead?.id === leadId) {
        setSelectedLead({ ...selectedLead, ...finalUpdates });
      }
    } catch (error: any) {
      console.error('Error updating lead:', error);
      alert(`Failed to update lead: ${error.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map(l => l.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const deleteSelectedLeads = async () => {
    if (selectedIds.size === 0) return;
    
    setDeleting(true);
    try {
      const idsToDelete = Array.from(selectedIds);
      
      // Try to nullify the foreign key reference first (safer than delete)
      // Try both possible column names
      await supabase
        .from('configurations')
        .update({ lead_id: null })
        .in('lead_id', idsToDelete);
      
      // Also try with camelCase column name  
      await supabase
        .from('configurations')
        .update({ leadId: null })
        .in('leadId', idsToDelete);

      // Handle bim_exports - try to nullify
      await supabase
        .from('bim_exports')
        .update({ lead_id: null })
        .in('lead_id', idsToDelete);
        
      await supabase
        .from('bim_exports')
        .update({ leadId: null })
        .in('leadId', idsToDelete);
      
      // Now delete the leads
      const { error } = await supabase
        .from('bim_leads')
        .delete()
        .in('id', idsToDelete);

      if (error) {
        // If still failing due to FK constraint, show SQL fix
        if (error.message?.includes('foreign key')) {
          console.error('Foreign key constraint still blocking delete. Run this SQL in Supabase:');
          console.log(`
-- Option 1: Make the foreign key cascade on delete
ALTER TABLE configurations DROP CONSTRAINT IF EXISTS configurations_lead_id_fkey;
ALTER TABLE configurations ADD CONSTRAINT configurations_lead_id_fkey 
  FOREIGN KEY (lead_id) REFERENCES bim_leads(id) ON DELETE CASCADE;

-- Option 2: Or just remove the constraint entirely
ALTER TABLE configurations DROP CONSTRAINT IF EXISTS configurations_lead_id_fkey;

-- Option 3: Delete all test data
DELETE FROM configurations WHERE lead_id IN (SELECT id FROM bim_leads);
DELETE FROM bim_leads;
          `);
          throw new Error('Foreign key constraint blocking delete. Check browser console for SQL fix.');
        }
        throw error;
      }

      // Update local state
      setLeads(leads.filter(lead => !selectedIds.has(lead.id)));
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
      setExports(exports.filter(exp => !idsToDelete.includes(exp.leadId || '')));
      
      if (selectedLead && selectedIds.has(selectedLead.id)) {
        setSelectedLead(null);
      }
    } catch (error: any) {
      console.error('Error deleting leads:', error);
      alert(`Failed to delete leads: ${error.message || 'Unknown error'}`);
    } finally {
      setDeleting(false);
    }
  };

  const deleteSingleLead = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    
    setDeleting(true);
    try {
      // Try to nullify FK references first (both column name variants)
      await supabase.from('configurations').update({ lead_id: null }).eq('lead_id', leadId);
      await supabase.from('configurations').update({ leadId: null }).eq('leadId', leadId);
      await supabase.from('bim_exports').update({ lead_id: null }).eq('lead_id', leadId);
      await supabase.from('bim_exports').update({ leadId: null }).eq('leadId', leadId);

      // Now delete the lead
      const { error } = await supabase
        .from('bim_leads')
        .delete()
        .eq('id', leadId);

      if (error) {
        if (error.message?.includes('foreign key')) {
          console.error('Foreign key constraint blocking delete. Run this SQL in Supabase:');
          console.log(`
-- Fix the foreign key to cascade on delete:
ALTER TABLE configurations DROP CONSTRAINT IF EXISTS configurations_lead_id_fkey;
ALTER TABLE configurations ADD CONSTRAINT configurations_lead_id_fkey 
  FOREIGN KEY (lead_id) REFERENCES bim_leads(id) ON DELETE CASCADE;
          `);
          throw new Error('Foreign key constraint blocking delete. Check browser console for SQL fix.');
        }
        throw error;
      }

      setLeads(leads.filter(lead => lead.id !== leadId));
      setExports(exports.filter(exp => exp.leadId !== leadId));
      setSelectedLead(null);
    } catch (error: any) {
      console.error('Error deleting lead:', error);
      alert(`Failed to delete lead: ${error.message || 'Unknown error'}`);
    } finally {
      setDeleting(false);
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.company && lead.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.projectName && lead.projectName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesRole = filterRole === 'all' || lead.role === filterRole;
    const matchesStage = filterStage === 'all' || lead.lead_stage === filterStage;
    const matchesRep = filterRep === 'all' || lead.assigned_rep === filterRep;
    
    return matchesSearch && matchesRole && matchesStage && matchesRep;
  });

  const getLeadExports = (leadId: string) => {
    return exports.filter(exp => exp.leadId === leadId);
  };

  const getAnalytics = () => {
    const totalLeads = leads.length;
    const totalExports = exports.length;
    const needsContact = leads.filter(l => 
      l.lead_stage === 'bim_downloaded' || l.lead_stage === 'not_contacted'
    ).length;
    const activeDeals = leads.filter(l => 
      ['quoted', 'negotiation', 'call_meeting_booked'].includes(l.lead_stage)
    ).length;
    const wonDeals = leads.filter(l => l.lead_stage === 'won_order_placed').length;
    
    const stageBreakdown = leads.reduce((acc, lead) => {
      acc[lead.lead_stage] = (acc[lead.lead_stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { totalLeads, totalExports, needsContact, activeDeals, wonDeals, stageBreakdown };
  };

  const analytics = getAnalytics();

  // Get leads grouped by stage for pipeline view
  const getLeadsByStage = (stageId: LeadStage) => {
    return filteredLeads.filter(lead => lead.lead_stage === stageId);
  };

  return (
    <div className="p-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">BIM Leads Manager</h1>
          <p className="text-zinc-400">Track and manage your BIM download leads through the sales pipeline</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('table')}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              viewMode === 'table' 
                ? 'bg-amber-500 text-black' 
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            📋 Table
          </button>
          <button
            onClick={() => setViewMode('pipeline')}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              viewMode === 'pipeline' 
                ? 'bg-amber-500 text-black' 
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            📊 Pipeline
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-5 rounded-lg text-white">
          <div className="text-sm font-medium opacity-80 mb-1">Total Leads</div>
          <div className="text-3xl font-bold">{analytics.totalLeads}</div>
        </div>
        <div className="bg-gradient-to-br from-red-600 to-red-700 p-5 rounded-lg text-white">
          <div className="text-sm font-medium opacity-80 mb-1">Needs Contact</div>
          <div className="text-3xl font-bold">{analytics.needsContact}</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-5 rounded-lg text-black">
          <div className="text-sm font-medium opacity-80 mb-1">Active Deals</div>
          <div className="text-3xl font-bold">{analytics.activeDeals}</div>
        </div>
        <div className="bg-gradient-to-br from-green-600 to-green-700 p-5 rounded-lg text-white">
          <div className="text-sm font-medium opacity-80 mb-1">Won</div>
          <div className="text-3xl font-bold">{analytics.wonDeals}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 p-5 rounded-lg text-white">
          <div className="text-sm font-medium opacity-80 mb-1">Total Exports</div>
          <div className="text-3xl font-bold">{analytics.totalExports}</div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-center justify-between">
          <div className="text-white">
            <span className="font-bold">{selectedIds.size}</span> lead{selectedIds.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded font-medium transition-colors"
            >
              Clear Selection
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-medium transition-colors flex items-center gap-2"
            >
              🗑️ Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name, email, company, or project..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:border-amber-500"
          />
        </div>
        <select
          value={filterStage}
          onChange={(e) => setFilterStage(e.target.value)}
          className="px-4 py-2 bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:border-amber-500"
        >
          <option value="all">All Stages</option>
          {LEAD_STAGES.map(stage => (
            <option key={stage.id} value={stage.id}>{stage.label}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <select
            value={filterRep}
            onChange={(e) => setFilterRep(e.target.value)}
            className="px-4 py-2 bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Reps</option>
            {salesReps.map(rep => (
              <option key={rep} value={rep}>{rep}</option>
            ))}
          </select>
          <button
            onClick={() => setShowRepsModal(true)}
            className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
            title="Manage Sales Reps"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-4 py-2 bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:border-amber-500"
        >
          <option value="all">All Roles</option>
          <option value="Architect">Architect</option>
          <option value="Builder">Builder</option>
          <option value="Designer">Designer</option>
          <option value="Engineer">Engineer</option>
          <option value="Buyer">Buyer</option>
          <option value="Other">Other</option>
        </select>
        <button
          onClick={fetchLeads}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium rounded transition-colors"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Pipeline View */}
      {viewMode === 'pipeline' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {LEAD_STAGES.slice(0, 8).map(stage => {
              const stageLeads = getLeadsByStage(stage.id);
              return (
                <div key={stage.id} className="w-72 flex-shrink-0">
                  <div className={`p-3 rounded-t-lg ${stage.bgColor} border border-zinc-700 border-b-0`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-bold text-sm ${stage.color}`}>{stage.label}</span>
                      <span className="text-xs text-zinc-400 bg-zinc-900/50 px-2 py-0.5 rounded-full">
                        {stageLeads.length}
                      </span>
                    </div>
                  </div>
                  <div className="bg-zinc-900/50 border border-zinc-700 border-t-0 rounded-b-lg p-2 space-y-2 min-h-[300px] max-h-[500px] overflow-y-auto">
                    {stageLeads.map(lead => (
                      <div
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className="p-3 bg-zinc-800 rounded border border-zinc-700 hover:border-amber-500/50 cursor-pointer transition-colors"
                      >
                        <div className="font-medium text-white text-sm mb-1 truncate">{lead.name}</div>
                        <div className="text-xs text-zinc-400 truncate mb-2">{lead.company || lead.email}</div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="px-1.5 py-0.5 bg-blue-900/30 text-blue-400 rounded">
                            {lead.role}
                          </span>
                          {lead.assigned_rep && lead.assigned_rep !== 'Unassigned' && (
                            <span className="text-zinc-500">{lead.assigned_rep}</span>
                          )}
                        </div>
                        {getDaysSinceContact(lead.last_contact_date) !== null && getDaysSinceContact(lead.last_contact_date)! > 7 && (
                          <div className="mt-2 text-xs text-red-400">
                            ⚠️ {getDaysSinceContact(lead.last_contact_date)} days since contact
                          </div>
                        )}
                      </div>
                    ))}
                    {stageLeads.length === 0 && (
                      <div className="text-center py-8 text-zinc-600 text-sm">
                        No leads
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-800 text-zinc-300 text-sm">
                <tr>
                  <th className="text-left p-4 font-medium w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === filteredLeads.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                    />
                  </th>
                  <th className="text-left p-4 font-medium">Contact</th>
                  <th className="text-left p-4 font-medium">Company / Project</th>
                  <th className="text-left p-4 font-medium">Stage</th>
                  <th className="text-left p-4 font-medium">Assigned Rep</th>
                  <th className="text-left p-4 font-medium">Contacted</th>
                  <th className="text-left p-4 font-medium">Last Contact</th>
                  <th className="text-left p-4 font-medium">Created</th>
                  <th className="text-left p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-zinc-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                        Loading leads...
                      </div>
                    </td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-zinc-500">
                      No leads found
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map(lead => {
                    const stageConfig = getStageConfig(lead.lead_stage);
                    const daysSince = getDaysSinceContact(lead.last_contact_date);
                    const isStale = daysSince !== null && daysSince > 7 && 
                      !['won_order_placed', 'lost_no_project', 'lost_competitor', 'on_hold'].includes(lead.lead_stage);
                    const isSelected = selectedIds.has(lead.id);
                    
                    return (
                      <tr
                        key={lead.id}
                        className={`border-t border-zinc-800 hover:bg-zinc-800/50 transition-colors ${isStale ? 'bg-red-900/10' : ''} ${isSelected ? 'bg-amber-900/20' : ''}`}
                      >
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(lead.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-4">
                          <div className="font-medium text-white">{lead.name}</div>
                          <div className="text-xs text-zinc-400">{lead.email}</div>
                          <span className="text-xs px-1.5 py-0.5 bg-blue-900/30 text-blue-400 rounded mt-1 inline-block">
                            {lead.role}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="text-zinc-300">{lead.company || '—'}</div>
                          {lead.projectName && (
                            <div className="text-xs text-zinc-500">{lead.projectName}</div>
                          )}
                        </td>
                        <td className="p-4">
                          <select
                            value={lead.lead_stage}
                            onChange={(e) => updateLead(lead.id, { lead_stage: e.target.value as LeadStage })}
                            disabled={saving}
                            className={`px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer ${stageConfig.bgColor} ${stageConfig.color} focus:outline-none focus:ring-2 focus:ring-amber-500`}
                          >
                            {LEAD_STAGES.map(stage => (
                              <option key={stage.id} value={stage.id}>{stage.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-4">
                          <select
                            value={lead.assigned_rep || 'Unassigned'}
                            onChange={(e) => updateLead(lead.id, { assigned_rep: e.target.value as SalesRep })}
                            disabled={saving}
                            className="px-2 py-1 bg-zinc-700 rounded text-xs text-white border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500"
                          >
                            {salesReps.map(rep => (
                              <option key={rep} value={rep}>{rep}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => updateLead(lead.id, { contacted: !lead.contacted })}
                            disabled={saving}
                            className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                              lead.contacted 
                                ? 'bg-green-500 border-green-500 text-black' 
                                : 'border-zinc-600 text-zinc-600 hover:border-green-500'
                            }`}
                          >
                            {lead.contacted && '✓'}
                          </button>
                        </td>
                        <td className="p-4">
                          <div className={`text-sm ${isStale ? 'text-red-400' : 'text-zinc-400'}`}>
                            {formatDate(lead.last_contact_date)}
                          </div>
                          {daysSince !== null && (
                            <div className={`text-xs ${isStale ? 'text-red-400' : 'text-zinc-600'}`}>
                              {daysSince === 0 ? 'Today' : `${daysSince}d ago`}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-zinc-500 text-xs">
                          {formatDate(lead.created_at)}
                        </td>
                        <td className="p-4">
                          <div className="flex gap-1">
                            <button
                              onClick={() => setSelectedLead(lead)}
                              className="w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-700 text-zinc-400 hover:text-amber-400 transition-colors"
                              title="View Details"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteSingleLead(lead.id)}
                              disabled={deleting}
                              className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-900/30 text-zinc-400 hover:text-red-400 transition-colors disabled:opacity-50"
                              title="Delete Lead"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-md w-full p-6">
            <div className="text-center">
              <div className="text-5xl mb-4">⚠️</div>
              <h2 className="text-xl font-bold text-white mb-2">Delete {selectedIds.size} Lead{selectedIds.size !== 1 ? 's' : ''}?</h2>
              <p className="text-zinc-400 mb-6">
                This action cannot be undone. All selected leads and their associated data will be permanently removed.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-6 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteSelectedLeads}
                  disabled={deleting}
                  className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-medium transition-colors flex items-center gap-2"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Deleting...
                    </>
                  ) : (
                    <>🗑️ Delete</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Sales Reps Modal */}
      {showRepsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Manage Sales Reps</h2>
              <button
                onClick={() => setShowRepsModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Add New Rep */}
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={newRepName}
                onChange={(e) => setNewRepName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSalesRep()}
                placeholder="New rep name..."
                className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={addSalesRep}
                disabled={!newRepName.trim()}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded transition-colors"
              >
                Add
              </button>
            </div>
            
            {/* Current Reps List */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {salesReps.map(rep => (
                <div 
                  key={rep}
                  className={`flex items-center justify-between p-3 rounded border ${
                    rep === 'Unassigned' 
                      ? 'bg-zinc-800/50 border-zinc-700' 
                      : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <span className={`font-medium ${rep === 'Unassigned' ? 'text-zinc-500' : 'text-white'}`}>
                    {rep}
                  </span>
                  {rep !== 'Unassigned' && (
                    <button
                      onClick={() => removeSalesRep(rep)}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-900/30 text-zinc-500 hover:text-red-400 transition-colors"
                      title="Remove Rep"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-4 border-t border-zinc-800 text-xs text-zinc-500">
              Sales reps are saved locally. "Unassigned" cannot be removed.
            </div>
          </div>
        </div>
      )}

      {/* Lead Details Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-zinc-800">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">{selectedLead.name}</h2>
                  <p className="text-zinc-400">{selectedLead.email}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => deleteSingleLead(selectedLead.id)}
                    disabled={deleting}
                    className="w-9 h-9 flex items-center justify-center rounded hover:bg-red-900/30 text-zinc-400 hover:text-red-400 transition-colors disabled:opacity-50"
                    title="Delete Lead"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setSelectedLead(null)}
                    className="w-9 h-9 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    title="Close"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Contact & Company Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Company</div>
                  <div className="text-white">{selectedLead.company || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Role</div>
                  <div className="text-white">{selectedLead.role}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Project Name</div>
                  <div className="text-white">{selectedLead.projectName || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Project Location</div>
                  <div className="text-white">{selectedLead.projectLocation || '—'}</div>
                </div>
              </div>

              {/* Pipeline Status */}
              <div className="border-t border-zinc-800 pt-4">
                <h3 className="font-bold text-white mb-4">Pipeline Status</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Lead Stage</div>
                    <select
                      value={selectedLead.lead_stage}
                      onChange={(e) => updateLead(selectedLead.id, { lead_stage: e.target.value as LeadStage })}
                      disabled={saving}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:border-amber-500"
                    >
                      {LEAD_STAGES.map(stage => (
                        <option key={stage.id} value={stage.id}>{stage.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Assigned Rep</div>
                    <select
                      value={selectedLead.assigned_rep || 'Unassigned'}
                      onChange={(e) => updateLead(selectedLead.id, { assigned_rep: e.target.value as SalesRep })}
                      disabled={saving}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:border-amber-500"
                    >
                      {salesReps.map(rep => (
                        <option key={rep} value={rep}>{rep}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Next Action</div>
                    <select
                      value={selectedLead.next_action || ''}
                      onChange={(e) => updateLead(selectedLead.id, { next_action: e.target.value })}
                      disabled={saving}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="">Select next action...</option>
                      {NEXT_ACTIONS.map(action => (
                        <option key={action} value={action}>{action}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wide">Last Contact</div>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={selectedLead.last_contact_date ? selectedLead.last_contact_date.split('T')[0] : ''}
                        onChange={(e) => updateLead(selectedLead.id, { 
                          last_contact_date: e.target.value ? new Date(e.target.value).toISOString() : undefined 
                        })}
                        disabled={saving}
                        className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:border-amber-500"
                      />
                      <button
                        onClick={() => updateLead(selectedLead.id, { 
                          last_contact_date: new Date().toISOString(),
                          contacted: true
                        })}
                        disabled={saving}
                        className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded text-sm font-medium"
                      >
                        Now
                      </button>
                    </div>
                  </div>
                </div>

                {/* Contacted Checkbox */}
                <div className="mt-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <button
                      onClick={() => updateLead(selectedLead.id, { contacted: !selectedLead.contacted })}
                      disabled={saving}
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedLead.contacted 
                          ? 'bg-green-500 border-green-500 text-black' 
                          : 'border-zinc-600 text-zinc-600 hover:border-green-500'
                      }`}
                    >
                      {selectedLead.contacted && '✓'}
                    </button>
                    <span className="text-white">Contacted</span>
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div className="border-t border-zinc-800 pt-4">
                <h3 className="font-bold text-white mb-3">Notes / Activity Log</h3>
                <textarea
                  value={selectedLead.notes || ''}
                  onChange={(e) => updateLead(selectedLead.id, { notes: e.target.value })}
                  disabled={saving}
                  placeholder="Add notes, call logs, special requests..."
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:border-amber-500 min-h-[120px] resize-y"
                />
              </div>

              {/* Exports */}
              <div className="border-t border-zinc-800 pt-4">
                <h3 className="font-bold text-white mb-3">BIM Exports ({getLeadExports(selectedLead.id).length})</h3>
                <div className="space-y-2">
                  {getLeadExports(selectedLead.id).map(exp => (
                    <div key={exp.id} className="p-3 bg-zinc-800 rounded border border-zinc-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">{exp.exportType}</span>
                        <span className="text-xs text-zinc-500">{formatDateTime(exp.createdAt)}</span>
                      </div>
                      <div className="flex gap-3">
                        {exp.ifcUrl && (
                          <a href={exp.ifcUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">
                            📦 IFC
                          </a>
                        )}
                        {exp.csvExportUrl && (
                          <a href={exp.csvExportUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-green-400 hover:text-green-300">
                            📊 CSV
                          </a>
                        )}
                        {exp.jsonExportUrl && (
                          <a href={exp.jsonExportUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400 hover:text-purple-300">
                            📄 JSON
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  {getLeadExports(selectedLead.id).length === 0 && (
                    <div className="text-center py-4 text-zinc-500 text-sm">No exports yet</div>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="border-t border-zinc-800 pt-4 text-xs text-zinc-500">
                <div className="grid grid-cols-2 gap-2">
                  <div>Created: {formatDateTime(selectedLead.created_at)}</div>
                  <div>Updated: {formatDateTime(selectedLead.updated_at)}</div>
                  <div>Lead ID: {selectedLead.id}</div>
                  {selectedLead.sessionId && <div>Session: {selectedLead.sessionId}</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saving Indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-amber-500 text-black px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
          Saving...
        </div>
      )}
    </div>
  );
};

export default BIMLeadsManager;
