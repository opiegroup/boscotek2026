import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { BIMLead, BIMExport } from '../../types';

export const BIMLeadsManager: React.FC = () => {
  const [leads, setLeads] = useState<BIMLead[]>([]);
  const [exports, setExports] = useState<BIMExport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<BIMLead | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

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
        .limit(100);

      if (error) throw error;

      setLeads(data as any[] || []);
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
        .limit(100);

      if (error) throw error;

      setExports(data as any[] || []);
    } catch (error) {
      console.error('Error fetching exports:', error);
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.company && lead.company.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesRole = filterRole === 'all' || lead.role === filterRole;
    
    return matchesSearch && matchesRole;
  });

  const getLeadExports = (leadId: string) => {
    return exports.filter(exp => exp.leadId === leadId);
  };

  const getAnalytics = () => {
    const totalLeads = leads.length;
    const totalExports = exports.length;
    const roleBreakdown = leads.reduce((acc, lead) => {
      acc[lead.role] = (acc[lead.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const exportTypeBreakdown = exports.reduce((acc, exp) => {
      acc[exp.exportType] = (acc[exp.exportType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { totalLeads, totalExports, roleBreakdown, exportTypeBreakdown };
  };

  const analytics = getAnalytics();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">BIM Leads Manager</h1>
        <p className="text-zinc-400">View and manage BIM export leads and downloads</p>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-lg text-white">
          <div className="text-sm font-medium opacity-80 mb-1">Total Leads</div>
          <div className="text-3xl font-bold">{analytics.totalLeads}</div>
        </div>
        <div className="bg-gradient-to-br from-green-600 to-green-700 p-6 rounded-lg text-white">
          <div className="text-sm font-medium opacity-80 mb-1">Total Exports</div>
          <div className="text-3xl font-bold">{analytics.totalExports}</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-6 rounded-lg text-black">
          <div className="text-sm font-medium opacity-80 mb-1">Conversion Rate</div>
          <div className="text-3xl font-bold">
            {analytics.totalLeads > 0 ? Math.round((analytics.totalExports / analytics.totalLeads) * 100) : 0}%
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 p-6 rounded-lg text-white">
          <div className="text-sm font-medium opacity-80 mb-1">Top Role</div>
          <div className="text-xl font-bold">
            {Object.entries(analytics.roleBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:border-amber-500"
          />
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
          className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Leads Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-800 text-zinc-300 text-sm">
              <tr>
                <th className="text-left p-4 font-medium">Name</th>
                <th className="text-left p-4 font-medium">Email</th>
                <th className="text-left p-4 font-medium">Company</th>
                <th className="text-left p-4 font-medium">Role</th>
                <th className="text-left p-4 font-medium">Project</th>
                <th className="text-left p-4 font-medium">Exports</th>
                <th className="text-left p-4 font-medium">Date</th>
                <th className="text-left p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                      Loading leads...
                    </div>
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-500">
                    No leads found
                  </td>
                </tr>
              ) : (
                filteredLeads.map(lead => {
                  const leadExports = getLeadExports(lead.id);
                  return (
                    <tr
                      key={lead.id}
                      className="border-t border-zinc-800 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <td className="p-4 text-white font-medium">{lead.name}</td>
                      <td className="p-4 text-zinc-300">{lead.email}</td>
                      <td className="p-4 text-zinc-400">{lead.company || '—'}</td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded text-xs font-medium">
                          {lead.role}
                        </span>
                      </td>
                      <td className="p-4 text-zinc-400">{lead.projectName || '—'}</td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs font-bold">
                          {leadExports.length}
                        </span>
                      </td>
                      <td className="p-4 text-zinc-500">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLead(lead);
                          }}
                          className="text-amber-500 hover:text-amber-400 font-medium text-xs"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lead Details Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-zinc-800">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">{selectedLead.name}</h2>
                  <p className="text-zinc-400">{selectedLead.email}</p>
                </div>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="text-zinc-500 hover:text-white text-2xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Company</div>
                  <div className="text-white">{selectedLead.company || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Role</div>
                  <div className="text-white">{selectedLead.role}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Project Name</div>
                  <div className="text-white">{selectedLead.projectName || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Project Location</div>
                  <div className="text-white">{selectedLead.projectLocation || '—'}</div>
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <h3 className="font-bold text-white mb-3">Exports ({getLeadExports(selectedLead.id).length})</h3>
                <div className="space-y-2">
                  {getLeadExports(selectedLead.id).map(exp => (
                    <div key={exp.id} className="p-3 bg-zinc-800 rounded border border-zinc-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">{exp.exportType}</span>
                        <span className="text-xs text-zinc-500">{new Date(exp.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex gap-2">
                        {exp.ifcUrl && (
                          <a href={exp.ifcUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">
                            Download IFC
                          </a>
                        )}
                        {exp.csvExportUrl && (
                          <a href={exp.csvExportUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-green-400 hover:text-green-300">
                            Download CSV
                          </a>
                        )}
                        {exp.jsonExportUrl && (
                          <a href={exp.jsonExportUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-green-400 hover:text-green-300">
                            Download JSON
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BIMLeadsManager;
