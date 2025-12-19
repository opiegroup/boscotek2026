import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

interface PricingTier {
  id: string;
  name: string;
  code: string;
  markup_percentage: number;
}

interface Contact {
  id: string;
  company_id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  job_title: string | null;
  is_primary: boolean;
  is_billing: boolean;
  is_shipping: boolean;
  can_order: boolean;
  can_view_pricing: boolean;
  is_active: boolean;
  notes: string | null;
}

interface Company {
  id: string;
  company_name: string;
  trading_name: string | null;
  abn: string | null;
  acn: string | null;
  account_number: string;
  netsuite_id: string | null;
  pricing_tier_id: string | null;
  preferred_currency: string;
  credit_limit: number | null;
  payment_terms: string | null;
  address_line1: string | null;
  address_line2: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  country: string;
  company_type: string;
  is_active: boolean;
  is_approved: boolean;
  internal_notes: string | null;
  created_at: string;
  pricing_tier?: PricingTier;
  contacts?: Contact[];
}

interface AvailableUser {
  id: string;
  email: string;
  full_name: string | null;
}

const COMPANY_TYPES = [
  { value: 'omg', label: 'OMG (Internal)', color: 'bg-red-500' },
  { value: 'distributor', label: 'Distributor', color: 'bg-green-500' },
  { value: 'retail', label: 'Retail', color: 'bg-blue-500' },
  { value: 'government', label: 'Government/Tertiary', color: 'bg-purple-500' },
  { value: 'export', label: 'Export', color: 'bg-amber-500' },
];

const CompanyManagement: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Selected company for editing
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Add contact to existing company
  const [addingContactToCompany, setAddingContactToCompany] = useState<Company | null>(null);
  const [newContact, setNewContact] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    mobile: '',
    job_title: '',
    user_id: '',
    is_primary: false,
    can_order: true,
    can_view_pricing: true,
  });

  const resetNewContact = () => {
    setNewContact({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      mobile: '',
      job_title: '',
      user_id: '',
      is_primary: false,
      can_order: true,
      can_view_pricing: true,
    });
  };

  // New company form
  const [showNewCompanyForm, setShowNewCompanyForm] = useState(false);
  const [newCompany, setNewCompany] = useState({
    company_name: '',
    trading_name: '',
    abn: '',
    company_type: 'distributor',
    pricing_tier_id: '',
    // Primary contact
    contact_first_name: '',
    contact_last_name: '',
    contact_email: '',
    contact_phone: '',
    link_user_id: '',
  });

  // Load all data
  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load pricing tiers
      const { data: tiersData, error: tiersError } = await supabase
        .from('pricing_tiers')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (tiersError) throw tiersError;
      setPricingTiers(tiersData || []);

      // Load companies with contacts
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select(`
          *,
          pricing_tier:pricing_tiers(id, name, code, markup_percentage),
          contacts(*)
        `)
        .order('company_name');

      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);

      // Load available users for linking
      try {
        const { data: usersData } = await supabase.rpc('get_users_with_emails');
        if (usersData) {
          setAvailableUsers(usersData.map((u: any) => ({
            id: u.id,
            email: u.email,
            full_name: u.full_name,
          })));
        }
      } catch {
        // RPC not available
      }

    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Create new company with primary contact
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Create company
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({
          company_name: newCompany.company_name,
          trading_name: newCompany.trading_name || null,
          abn: newCompany.abn || null,
          company_type: newCompany.company_type,
          pricing_tier_id: newCompany.pricing_tier_id || null,
          is_approved: true,
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // Create primary contact if details provided
      if (newCompany.contact_first_name && newCompany.contact_last_name) {
        const { error: contactError } = await supabase
          .from('contacts')
          .insert({
            company_id: companyData.id,
            user_id: newCompany.link_user_id || null,
            first_name: newCompany.contact_first_name,
            last_name: newCompany.contact_last_name,
            email: newCompany.contact_email || null,
            phone: newCompany.contact_phone || null,
            is_primary: true,
            can_order: true,
            can_view_pricing: true,
          });

        if (contactError) throw contactError;

        // If user linked, assign distributor role
        if (newCompany.link_user_id) {
          await supabase
            .from('user_roles')
            .upsert({ user_id: newCompany.link_user_id, role: 'distributor' });
        }
      }

      // Reset and reload
      setNewCompany({
        company_name: '',
        trading_name: '',
        abn: '',
        company_type: 'distributor',
        pricing_tier_id: '',
        contact_first_name: '',
        contact_last_name: '',
        contact_email: '',
        contact_phone: '',
        link_user_id: '',
      });
      setShowNewCompanyForm(false);
      await loadData();

    } catch (err: any) {
      console.error('Error creating company:', err);
      alert(`Failed to create company: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Save company changes
  const handleSaveCompany = async (company: Company) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          company_name: company.company_name,
          trading_name: company.trading_name,
          abn: company.abn,
          acn: company.acn,
          company_type: company.company_type,
          pricing_tier_id: company.pricing_tier_id,
          preferred_currency: company.preferred_currency,
          credit_limit: company.credit_limit,
          payment_terms: company.payment_terms,
          address_line1: company.address_line1,
          address_line2: company.address_line2,
          suburb: company.suburb,
          state: company.state,
          postcode: company.postcode,
          country: company.country,
          is_active: company.is_active,
          is_approved: company.is_approved,
          internal_notes: company.internal_notes,
        })
        .eq('id', company.id);

      if (error) throw error;

      await loadData();
      setSelectedCompany(null);
    } catch (err: any) {
      console.error('Error saving company:', err);
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Add contact to company
  const handleAddContact = async (companyId: string, contact: Partial<Contact>) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .insert({
          company_id: companyId,
          ...contact,
        });

      if (error) throw error;

      // If user linked, assign role
      if (contact.user_id) {
        await supabase
          .from('user_roles')
          .upsert({ user_id: contact.user_id, role: 'distributor' });
      }

      await loadData();
    } catch (err: any) {
      console.error('Error adding contact:', err);
      alert(`Failed to add contact: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Save contact changes
  const handleSaveContact = async (contact: Contact) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .update({
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email,
          phone: contact.phone,
          mobile: contact.mobile,
          job_title: contact.job_title,
          is_primary: contact.is_primary,
          is_billing: contact.is_billing,
          is_shipping: contact.is_shipping,
          can_order: contact.can_order,
          can_view_pricing: contact.can_view_pricing,
          is_active: contact.is_active,
          notes: contact.notes,
          user_id: contact.user_id,
        })
        .eq('id', contact.id);

      if (error) throw error;

      await loadData();
      setSelectedContact(null);
    } catch (err: any) {
      console.error('Error saving contact:', err);
      alert(`Failed to save contact: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Toggle approval
  const handleToggleApproval = async (company: Company) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ is_approved: !company.is_approved })
        .eq('id', company.id);

      if (error) throw error;
      await loadData();
    } catch (err: any) {
      alert(`Failed to update: ${err.message}`);
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
          <h1 className="text-3xl font-bold mb-2">Companies & Contacts</h1>
          <p className="text-zinc-400">Manage customer companies, contacts, and pricing tiers.</p>
        </div>
        <button
          onClick={() => setShowNewCompanyForm(!showNewCompanyForm)}
          className="bg-amber-500 text-black font-bold px-4 py-2 rounded hover:bg-amber-400"
        >
          {showNewCompanyForm ? 'Cancel' : '+ Add Company'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* New Company Form */}
      {showNewCompanyForm && (
        <div className="bg-zinc-900 border border-amber-500/50 rounded-lg p-6">
          <h3 className="font-bold text-white mb-4">Add New Company</h3>
          <form onSubmit={handleCreateCompany} className="space-y-6">
            {/* Company Details */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-2">COMPANY NAME *</label>
                <input
                  type="text"
                  required
                  value={newCompany.company_name}
                  onChange={(e) => setNewCompany({ ...newCompany, company_name: e.target.value })}
                  placeholder="ABC Supplies Pty Ltd"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-2">TRADING NAME</label>
                <input
                  type="text"
                  value={newCompany.trading_name}
                  onChange={(e) => setNewCompany({ ...newCompany, trading_name: e.target.value })}
                  placeholder="ABC Supplies"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-2">ABN</label>
                <input
                  type="text"
                  value={newCompany.abn}
                  onChange={(e) => setNewCompany({ ...newCompany, abn: e.target.value })}
                  placeholder="12 345 678 901"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-2">COMPANY TYPE</label>
                <select
                  value={newCompany.company_type}
                  onChange={(e) => setNewCompany({ ...newCompany, company_type: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                >
                  {COMPANY_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-2">PRICING TIER</label>
                <select
                  value={newCompany.pricing_tier_id}
                  onChange={(e) => setNewCompany({ ...newCompany, pricing_tier_id: e.target.value })}
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
            </div>

            {/* Primary Contact */}
            <div className="border-t border-zinc-700 pt-4">
              <h4 className="text-sm font-bold text-zinc-400 uppercase mb-3">Primary Contact</h4>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">FIRST NAME *</label>
                  <input
                    type="text"
                    required
                    value={newCompany.contact_first_name}
                    onChange={(e) => setNewCompany({ ...newCompany, contact_first_name: e.target.value })}
                    placeholder="John"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">LAST NAME *</label>
                  <input
                    type="text"
                    required
                    value={newCompany.contact_last_name}
                    onChange={(e) => setNewCompany({ ...newCompany, contact_last_name: e.target.value })}
                    placeholder="Smith"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">EMAIL</label>
                  <input
                    type="email"
                    value={newCompany.contact_email}
                    onChange={(e) => setNewCompany({ ...newCompany, contact_email: e.target.value })}
                    placeholder="john@abc.com"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">PHONE</label>
                  <input
                    type="tel"
                    value={newCompany.contact_phone}
                    onChange={(e) => setNewCompany({ ...newCompany, contact_phone: e.target.value })}
                    placeholder="02 9000 0000"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-mono text-zinc-500 mb-2">LINK TO USER ACCOUNT (optional)</label>
                <select
                  value={newCompany.link_user_id}
                  onChange={(e) => setNewCompany({ ...newCompany, link_user_id: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                >
                  <option value="">No login account</option>
                  {availableUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.email} {user.full_name ? `(${user.full_name})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500 mt-1">
                  Link to an existing user account to enable login access with company pricing.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowNewCompanyForm(false)}
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-amber-500 text-black font-bold px-6 py-2 rounded hover:bg-amber-400 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Company'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Companies List */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="bg-zinc-800 px-6 py-4 border-b border-zinc-700 flex justify-between items-center">
          <h3 className="font-bold text-white">Companies ({companies.length})</h3>
          <button
            onClick={loadData}
            className="text-xs text-zinc-400 hover:text-white px-3 py-1 bg-zinc-700 rounded"
          >
            Refresh
          </button>
        </div>

        {companies.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            No companies yet. Click "Add Company" to create one.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {companies.map(company => (
              <div key={company.id} className="p-4 hover:bg-zinc-800/50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-white text-lg">{company.company_name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        COMPANY_TYPES.find(t => t.value === company.company_type)?.color || 'bg-zinc-500'
                      } text-white`}>
                        {COMPANY_TYPES.find(t => t.value === company.company_type)?.label || company.company_type}
                      </span>
                      {company.is_approved ? (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-900/30 text-green-400">
                          Approved
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-900/30 text-amber-400">
                          Pending
                        </span>
                      )}
                      {!company.is_active && (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-900/30 text-red-400">
                          Inactive
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      <span className="text-zinc-500">
                        Account: <span className="font-mono text-amber-500">{company.account_number}</span>
                      </span>
                      {company.abn && (
                        <span className="text-zinc-500">
                          ABN: <span className="text-zinc-300">{company.abn}</span>
                        </span>
                      )}
                      {company.pricing_tier && (
                        <span className="text-zinc-500">
                          Tier: <span className="text-green-400">{company.pricing_tier.name} (+{company.pricing_tier.markup_percentage}%)</span>
                        </span>
                      )}
                    </div>

                    {/* Contacts */}
                    {company.contacts && company.contacts.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {company.contacts.map(contact => (
                          <button
                            key={contact.id}
                            onClick={() => setSelectedContact(contact)}
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
                              contact.is_primary 
                                ? 'bg-amber-900/30 text-amber-400 border border-amber-500/30' 
                                : 'bg-zinc-800 text-zinc-300'
                            } hover:bg-zinc-700`}
                          >
                            <span className="font-medium">{contact.first_name} {contact.last_name}</span>
                            {contact.email && <span className="text-zinc-500">({contact.email})</span>}
                            {contact.is_primary && <span className="text-[10px] text-amber-500">PRIMARY</span>}
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            resetNewContact();
                            setAddingContactToCompany(company);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30"
                        >
                          + Add Contact
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => setSelectedCompany(company)}
                      className="text-xs text-zinc-400 hover:text-white px-3 py-1 bg-zinc-700 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleApproval(company)}
                      className={`text-xs px-3 py-1 rounded ${
                        company.is_approved
                          ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
                          : 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
                      }`}
                    >
                      {company.is_approved ? 'Revoke' : 'Approve'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Company Modal */}
      {selectedCompany && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-700 px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">Edit Company</h3>
                <p className="text-sm text-zinc-500">{selectedCompany.account_number}</p>
              </div>
              <button
                onClick={() => setSelectedCompany(null)}
                className="text-zinc-500 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">COMPANY NAME</label>
                  <input
                    type="text"
                    value={selectedCompany.company_name}
                    onChange={(e) => setSelectedCompany({ ...selectedCompany, company_name: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">TRADING NAME</label>
                  <input
                    type="text"
                    value={selectedCompany.trading_name || ''}
                    onChange={(e) => setSelectedCompany({ ...selectedCompany, trading_name: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">ABN</label>
                  <input
                    type="text"
                    value={selectedCompany.abn || ''}
                    onChange={(e) => setSelectedCompany({ ...selectedCompany, abn: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">ACN</label>
                  <input
                    type="text"
                    value={selectedCompany.acn || ''}
                    onChange={(e) => setSelectedCompany({ ...selectedCompany, acn: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">NETSUITE ID</label>
                  <input
                    type="text"
                    value={selectedCompany.netsuite_id || ''}
                    onChange={(e) => setSelectedCompany({ ...selectedCompany, netsuite_id: e.target.value })}
                    placeholder="For NetSuite sync"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">COMPANY TYPE</label>
                  <select
                    value={selectedCompany.company_type}
                    onChange={(e) => setSelectedCompany({ ...selectedCompany, company_type: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  >
                    {COMPANY_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">PRICING TIER</label>
                  <select
                    value={selectedCompany.pricing_tier_id || ''}
                    onChange={(e) => setSelectedCompany({ ...selectedCompany, pricing_tier_id: e.target.value || null })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  >
                    <option value="">No tier (Cash Sale pricing)</option>
                    {pricingTiers.map(tier => (
                      <option key={tier.id} value={tier.id}>
                        {tier.name} (+{tier.markup_percentage}%)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">PAYMENT TERMS</label>
                  <input
                    type="text"
                    value={selectedCompany.payment_terms || ''}
                    onChange={(e) => setSelectedCompany({ ...selectedCompany, payment_terms: e.target.value })}
                    placeholder="Net 30"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="border-t border-zinc-700 pt-4">
                <h4 className="text-sm font-bold text-zinc-400 uppercase mb-3">Address</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={selectedCompany.address_line1 || ''}
                      onChange={(e) => setSelectedCompany({ ...selectedCompany, address_line1: e.target.value })}
                      placeholder="Street address"
                      className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={selectedCompany.suburb || ''}
                      onChange={(e) => setSelectedCompany({ ...selectedCompany, suburb: e.target.value })}
                      placeholder="Suburb"
                      className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={selectedCompany.state || ''}
                      onChange={(e) => setSelectedCompany({ ...selectedCompany, state: e.target.value })}
                      placeholder="State"
                      className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                    />
                    <input
                      type="text"
                      value={selectedCompany.postcode || ''}
                      onChange={(e) => setSelectedCompany({ ...selectedCompany, postcode: e.target.value })}
                      placeholder="Postcode"
                      className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-2">INTERNAL NOTES</label>
                <textarea
                  value={selectedCompany.internal_notes || ''}
                  onChange={(e) => setSelectedCompany({ ...selectedCompany, internal_notes: e.target.value })}
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                />
              </div>

              {/* Status toggles */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedCompany.is_active}
                    onChange={(e) => setSelectedCompany({ ...selectedCompany, is_active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-white">Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedCompany.is_approved}
                    onChange={(e) => setSelectedCompany({ ...selectedCompany, is_approved: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-white">Approved</span>
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-zinc-900 border-t border-zinc-700 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setSelectedCompany(null)}
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveCompany(selectedCompany)}
                disabled={saving}
                className="bg-amber-500 text-black font-bold px-6 py-2 rounded hover:bg-amber-400 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {selectedContact && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-zinc-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Edit Contact</h3>
              <button
                onClick={() => setSelectedContact(null)}
                className="text-zinc-500 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">FIRST NAME</label>
                  <input
                    type="text"
                    value={selectedContact.first_name}
                    onChange={(e) => setSelectedContact({ ...selectedContact, first_name: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">LAST NAME</label>
                  <input
                    type="text"
                    value={selectedContact.last_name}
                    onChange={(e) => setSelectedContact({ ...selectedContact, last_name: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-2">EMAIL</label>
                <input
                  type="email"
                  value={selectedContact.email || ''}
                  onChange={(e) => setSelectedContact({ ...selectedContact, email: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">PHONE</label>
                  <input
                    type="tel"
                    value={selectedContact.phone || ''}
                    onChange={(e) => setSelectedContact({ ...selectedContact, phone: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">MOBILE</label>
                  <input
                    type="tel"
                    value={selectedContact.mobile || ''}
                    onChange={(e) => setSelectedContact({ ...selectedContact, mobile: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-2">JOB TITLE</label>
                <input
                  type="text"
                  value={selectedContact.job_title || ''}
                  onChange={(e) => setSelectedContact({ ...selectedContact, job_title: e.target.value })}
                  placeholder="Purchasing Manager"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-2">LINK TO USER ACCOUNT</label>
                <select
                  value={selectedContact.user_id || ''}
                  onChange={(e) => setSelectedContact({ ...selectedContact, user_id: e.target.value || null })}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                >
                  <option value="">No login account</option>
                  {availableUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.email} {user.full_name ? `(${user.full_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Checkboxes */}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedContact.is_primary}
                    onChange={(e) => setSelectedContact({ ...selectedContact, is_primary: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-white">Primary Contact</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedContact.is_billing}
                    onChange={(e) => setSelectedContact({ ...selectedContact, is_billing: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-white">Billing Contact</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedContact.can_order}
                    onChange={(e) => setSelectedContact({ ...selectedContact, can_order: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-white">Can Place Orders</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedContact.can_view_pricing}
                    onChange={(e) => setSelectedContact({ ...selectedContact, can_view_pricing: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-white">View Pricing</span>
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-700 flex justify-end gap-3">
              <button
                onClick={() => setSelectedContact(null)}
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveContact(selectedContact)}
                disabled={saving}
                className="bg-amber-500 text-black font-bold px-6 py-2 rounded hover:bg-amber-400 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Contact'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {addingContactToCompany && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-lg">
            <div className="px-6 py-4 border-b border-zinc-700 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">Add Contact</h3>
                <p className="text-sm text-zinc-500">to {addingContactToCompany.company_name}</p>
              </div>
              <button
                onClick={() => setAddingContactToCompany(null)}
                className="text-zinc-500 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">FIRST NAME *</label>
                  <input
                    type="text"
                    value={newContact.first_name}
                    onChange={(e) => setNewContact({ ...newContact, first_name: e.target.value })}
                    placeholder="John"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">LAST NAME *</label>
                  <input
                    type="text"
                    value={newContact.last_name}
                    onChange={(e) => setNewContact({ ...newContact, last_name: e.target.value })}
                    placeholder="Smith"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-2">EMAIL</label>
                <input
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="john@company.com"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">PHONE</label>
                  <input
                    type="tel"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    placeholder="02 9000 0000"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">MOBILE</label>
                  <input
                    type="tel"
                    value={newContact.mobile}
                    onChange={(e) => setNewContact({ ...newContact, mobile: e.target.value })}
                    placeholder="0400 000 000"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-2">JOB TITLE</label>
                <input
                  type="text"
                  value={newContact.job_title}
                  onChange={(e) => setNewContact({ ...newContact, job_title: e.target.value })}
                  placeholder="Sales Manager"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-2">LINK TO USER ACCOUNT</label>
                <select
                  value={newContact.user_id}
                  onChange={(e) => setNewContact({ ...newContact, user_id: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                >
                  <option value="">No login account</option>
                  {availableUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.email} {user.full_name ? `(${user.full_name})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500 mt-1">
                  Link to enable this person to log in and see company pricing.
                </p>
              </div>

              {/* Checkboxes */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newContact.is_primary}
                    onChange={(e) => setNewContact({ ...newContact, is_primary: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-white">Primary Contact</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newContact.can_order}
                    onChange={(e) => setNewContact({ ...newContact, can_order: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-white">Can Place Orders</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newContact.can_view_pricing}
                    onChange={(e) => setNewContact({ ...newContact, can_view_pricing: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-white">View Pricing</span>
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-700 flex justify-end gap-3">
              <button
                onClick={() => setAddingContactToCompany(null)}
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newContact.first_name || !newContact.last_name) {
                    alert('First name and last name are required');
                    return;
                  }
                  await handleAddContact(addingContactToCompany.id, {
                    first_name: newContact.first_name,
                    last_name: newContact.last_name,
                    email: newContact.email || null,
                    phone: newContact.phone || null,
                    mobile: newContact.mobile || null,
                    job_title: newContact.job_title || null,
                    user_id: newContact.user_id || null,
                    is_primary: newContact.is_primary,
                    can_order: newContact.can_order,
                    can_view_pricing: newContact.can_view_pricing,
                  });
                  setAddingContactToCompany(null);
                  resetNewContact();
                }}
                disabled={saving || !newContact.first_name || !newContact.last_name}
                className="bg-amber-500 text-black font-bold px-6 py-2 rounded hover:bg-amber-400 disabled:opacity-50"
              >
                {saving ? 'Adding...' : 'Add Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyManagement;
