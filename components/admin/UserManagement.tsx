import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { UserRole } from '../../types';
import { useBrand } from '../../contexts/BrandContext';
import { useAuth } from '../../contexts/AuthContext';

interface BrandAccess {
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  access_level: 'viewer' | 'sales' | 'pricing' | 'admin';
  scopes: string[];
  is_active: boolean;
}

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  company: string | null;
  created_at: string;
  last_sign_in: string | null;
  role: UserRole | null;
  brand_accesses: BrandAccess[];
}

const ROLE_LABELS: Record<UserRole, { label: string; color: string; description: string }> = {
  super_admin: { label: 'Super Admin', color: 'bg-amber-500', description: 'God Mode - Full access to all brands' },
  admin: { label: 'Admin', color: 'bg-red-500', description: 'Full system access' },
  pricing_manager: { label: 'Pricing Manager', color: 'bg-purple-500', description: 'Manage pricing and catalogue' },
  sales: { label: 'Sales', color: 'bg-blue-500', description: 'Create quotes and manage customers' },
  distributor: { label: 'Distributor', color: 'bg-green-500', description: 'View own orders with tier pricing' },
  viewer: { label: 'Viewer', color: 'bg-zinc-500', description: 'Read-only access' },
};

const BRAND_ACCESS_LEVELS = [
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
  { value: 'sales', label: 'Sales', description: 'Create quotes' },
  { value: 'pricing', label: 'Pricing', description: 'Manage pricing' },
  { value: 'admin', label: 'Admin', description: 'Full brand access' },
];

const UserManagement: React.FC = () => {
  const { brand, brandSlug, availableBrands } = useBrand();
  const { isSuperAdmin, isAdmin } = useAuth();
  
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [viewAllBrands, setViewAllBrands] = useState(false);

  // Load users with brand access
  const loadUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      // Try the new RPC function first
      const brandIdFilter = (isSuperAdmin && viewAllBrands) ? null : brand?.id;
      
      const { data: userData, error: rpcError } = await supabase
        .rpc('get_users_with_brand_access', { 
          p_brand_id: brandIdFilter 
        });

      if (rpcError) {
        console.warn('get_users_with_brand_access RPC failed:', rpcError);
        // Fallback to old method
        await loadUsersLegacy();
        return;
      }

      const usersWithRoles: UserWithRole[] = (userData || []).map((u: any) => ({
        id: u.user_id,
        email: u.email || '(no email)',
        full_name: u.full_name,
        phone: null,
        company: null,
        created_at: new Date().toISOString(),
        last_sign_in: null,
        role: u.global_role as UserRole | null,
        brand_accesses: u.brand_accesses || [],
      }));

      setUsers(usersWithRoles);
    } catch (err: any) {
      console.error('Error loading users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fallback to legacy user loading
  const loadUsersLegacy = async () => {
    try {
      const { data: userDetails, error: rpcError } = await supabase
        .rpc('get_users_with_emails');

      if (rpcError) {
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role');

        if (rolesError) throw rolesError;

        const usersWithRoles: UserWithRole[] = rolesData?.map(r => ({
          id: r.user_id,
          email: `(ID: ${r.user_id.substring(0, 8)}...)`,
          full_name: null,
          phone: null,
          company: null,
          created_at: new Date().toISOString(),
          last_sign_in: null,
          role: r.role as UserRole,
          brand_accesses: [],
        })) || [];

        setUsers(usersWithRoles);
        return;
      }

      const usersWithRoles: UserWithRole[] = (userDetails || []).map((u: any) => ({
        id: u.id,
        email: u.email || '(no email)',
        full_name: u.full_name,
        phone: u.phone,
        company: u.company,
        created_at: u.created_at,
        last_sign_in: u.last_sign_in,
        role: u.role as UserRole | null,
        brand_accesses: [],
      }));

      setUsers(usersWithRoles);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [brand?.id, viewAllBrands]);

  // Assign or update global role
  const handleRoleChange = async (userId: string, newRole: UserRole | 'none') => {
    setSaving(userId);
    
    try {
      if (newRole === 'none') {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId);
        
        if (error) throw error;
      } else {
        const existingUser = users.find(u => u.id === userId);
        
        if (existingUser?.role) {
          const { error } = await supabase
            .from('user_roles')
            .update({ role: newRole })
            .eq('user_id', userId);
          
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('user_roles')
            .insert({ user_id: userId, role: newRole });
          
          if (error) throw error;
        }
      }
      
      await loadUsers();
    } catch (err: any) {
      console.error('Error updating role:', err);
      alert(`Failed to update role: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  // Assign user to brand
  const handleAssignToBrand = async (userId: string, brandId: string, accessLevel: string) => {
    setSaving(userId);
    
    try {
      // Get current user for granted_by
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      // Direct upsert instead of RPC to avoid type casting issues
      const { error } = await supabase
        .from('user_brand_access')
        .upsert({
          user_id: userId,
          brand_id: brandId,
          access_level: accessLevel,
          granted_by: currentUser?.id || null,
          is_active: true,
        }, { 
          onConflict: 'user_id,brand_id',
          ignoreDuplicates: false 
        });
      
      if (error) throw error;
      
      await loadUsers();
    } catch (err: any) {
      console.error('Error assigning to brand:', err);
      alert(`Failed to assign to brand: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  // Remove user from brand
  const handleRemoveFromBrand = async (userId: string, brandId: string) => {
    setSaving(userId);
    
    try {
      const { error } = await supabase.rpc('remove_user_from_brand', {
        p_user_id: userId,
        p_brand_id: brandId,
      });
      
      if (error) throw error;
      
      await loadUsers();
    } catch (err: any) {
      console.error('Error removing from brand:', err);
      alert(`Failed to remove from brand: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  // Assign user to ALL brands
  const handleAssignToAllBrands = async (userId: string, accessLevel: string) => {
    setSaving(userId);
    
    try {
      // Get current user for granted_by
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      // Get all active brands
      const { data: allBrands, error: brandsError } = await supabase
        .from('brands')
        .select('id, name')
        .eq('status', 'active');
      
      if (brandsError) throw brandsError;
      if (!allBrands || allBrands.length === 0) {
        alert('No active brands found');
        return;
      }

      // Build records for upsert
      const brandAccessRecords = allBrands.map(b => ({
        user_id: userId,
        brand_id: b.id,
        access_level: accessLevel,
        granted_by: currentUser?.id || null,
        is_active: true,
      }));

      // Use upsert to insert or update all at once
      const { error: upsertError } = await supabase
        .from('user_brand_access')
        .upsert(brandAccessRecords, { 
          onConflict: 'user_id,brand_id',
          ignoreDuplicates: false 
        });
      
      if (upsertError) {
        console.error('Upsert error:', upsertError);
        throw upsertError;
      }
      
      alert(`Assigned ${accessLevel} access to ${allBrands.length} brands`);
      await loadUsers();
    } catch (err: any) {
      console.error('Error assigning to all brands:', err);
      alert(`Failed to assign to all brands: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  // Resend invite to existing user
  const handleResendInvite = async (email: string) => {
    const user = users.find(u => u.email === email);
    if (!user) return;
    
    setResending(user.id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        alert('You must be logged in to resend invites');
        return;
      }

      const response = await supabase.functions.invoke('invite-user', {
        body: {
          email: email,
          role: user.role || 'viewer',
          resendInvite: true,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to resend invite');
      }

      const data = response.data;

      if (data.success) {
        alert(`Invite resent to ${email}! They'll receive an email with a login link.`);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Resend invite error:', err);
      alert(`Failed to resend invite: ${err.message}`);
    } finally {
      setResending(null);
    }
  };

  // Modal states
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', company: '' });
  const [showBrandAssign, setShowBrandAssign] = useState<{ userId: string; userName: string } | null>(null);
  const [newBrandAssign, setNewBrandAssign] = useState({ brandId: '', accessLevel: 'viewer', allBrands: false });

  useEffect(() => {
    if (editingUser) {
      setEditForm({
        full_name: editingUser.full_name || '',
        phone: editingUser.phone || '',
        company: editingUser.company || '',
      });
    }
  }, [editingUser]);

  const handleSaveProfile = async () => {
    if (!editingUser) return;
    setSaving(editingUser.id);

    try {
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', editingUser.id)
        .single();

      let error;
      
      if (existingProfile) {
        const result = await supabase
          .from('user_profiles')
          .update({
            full_name: editForm.full_name || null,
            phone: editForm.phone || null,
            company: editForm.company || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingUser.id);
        error = result.error;
      } else {
        const result = await supabase
          .from('user_profiles')
          .insert({
            id: editingUser.id,
            full_name: editForm.full_name || null,
            phone: editForm.phone || null,
            company: editForm.company || null,
          });
        error = result.error;
      }

      if (error) throw error;

      await loadUsers();
      setEditingUser(null);
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  // Invite user
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('viewer');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteAllBrands, setInviteAllBrands] = useState(false);
  const [inviteBrandAccess, setInviteBrandAccess] = useState<string>('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setInviting(true);
    setInviteSuccess(null);
    setInviteError(null);

    try {
      // Get the current user's session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        setInviteError('You must be logged in to invite users');
        return;
      }

      // Call the invite-user edge function
      const response = await supabase.functions.invoke('invite-user', {
        body: {
          email: inviteEmail,
          role: inviteRole,
          fullName: inviteFullName || undefined,
          brandId: inviteAllBrands ? undefined : brand?.id,
          brandAccessLevel: inviteBrandAccess,
          assignAllBrands: inviteAllBrands,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to invite user');
      }

      const data = response.data;

      if (data.success) {
        if (data.isNewUser) {
          setInviteSuccess(`Invite sent to ${inviteEmail}! They'll receive an email to set their password.`);
        } else {
          setInviteSuccess(`Role "${inviteRole}" assigned to existing user ${inviteEmail}.`);
        }
        setInviteEmail('');
        setInviteFullName('');
        // Refresh the user list
        await loadUsers();
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      console.error('Invite error:', err);
      setInviteError(err.message || 'Failed to invite user');
    } finally {
      setInviting(false);
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
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">Users & Roles</h1>
          <p className="text-zinc-400">
            Manage user access and brand assignments.
            {isSuperAdmin && (
              <span className="ml-2 text-amber-500 text-sm">(God Mode Active)</span>
            )}
          </p>
        </div>
        
        {/* Super Admin Toggle */}
        {isSuperAdmin && (
          <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2">
            <span className="text-sm text-zinc-400">View:</span>
            <button
              onClick={() => setViewAllBrands(false)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                !viewAllBrands ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Current Brand
            </button>
            <button
              onClick={() => setViewAllBrands(true)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewAllBrands ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              All Brands
            </button>
          </div>
        )}
      </div>

      {/* Role Legend */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <h3 className="text-sm font-bold text-zinc-400 uppercase mb-3">Role Definitions</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {(Object.entries(ROLE_LABELS) as [UserRole, typeof ROLE_LABELS[UserRole]][]).map(([role, info]) => (
            <div key={role} className="flex items-start gap-2">
              <span className={`w-3 h-3 rounded-full ${info.color} mt-1 flex-shrink-0`} />
              <div>
                <div className="text-sm font-medium text-white">{info.label}</div>
                <div className="text-xs text-zinc-500">{info.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="bg-zinc-800 px-6 py-4 border-b border-zinc-700 flex justify-between items-center">
          <h3 className="font-bold text-white">
            Users ({users.length})
            {!viewAllBrands && brand && (
              <span className="ml-2 text-sm font-normal text-zinc-400">
                for {brand.name}
              </span>
            )}
          </h3>
          <button
            onClick={loadUsers}
            className="text-xs text-zinc-400 hover:text-white px-3 py-1 bg-zinc-700 rounded"
          >
            Refresh
          </button>
        </div>

        {users.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            No users found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-950 text-xs text-zinc-500 uppercase">
                <tr>
                  <th className="text-left px-6 py-3">User</th>
                  <th className="text-left px-6 py-3">Global Role</th>
                  <th className="text-left px-6 py-3">Brand Access</th>
                  <th className="text-left px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-zinc-800/50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">
                        {user.full_name || user.email.split('@')[0]}
                      </div>
                      <div className="text-sm text-zinc-500">{user.email}</div>
                      <div className="text-xs text-zinc-600 font-mono">{user.id.substring(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4">
                      {isSuperAdmin ? (
                        <select
                          value={user.role || 'none'}
                          onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole | 'none')}
                          disabled={saving === user.id}
                          className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded px-3 py-2 focus:border-amber-500 outline-none disabled:opacity-50"
                        >
                          <option value="none">No Role</option>
                          <option value="super_admin">⭐ Super Admin</option>
                          <option value="admin">Admin</option>
                          <option value="pricing_manager">Pricing Manager</option>
                          <option value="sales">Sales</option>
                          <option value="distributor">Distributor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : user.role ? (
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-white ${ROLE_LABELS[user.role].color}`}>
                          {ROLE_LABELS[user.role].label}
                        </span>
                      ) : (
                        <span className="text-zinc-500 italic">No role</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {user.brand_accesses.filter(ba => ba.is_active).map(access => (
                          <div 
                            key={access.brand_id} 
                            className="flex items-center gap-1 bg-zinc-800 rounded-full pl-3 pr-1 py-1"
                          >
                            <span className="text-xs text-white font-medium">{access.brand_name}</span>
                            <span className="text-xs text-zinc-400">({access.access_level})</span>
                            {(isSuperAdmin || (isAdmin && access.brand_id === brand?.id)) && (
                              <button
                                onClick={() => handleRemoveFromBrand(user.id, access.brand_id)}
                                className="ml-1 w-5 h-5 rounded-full bg-zinc-700 hover:bg-red-600 text-zinc-400 hover:text-white text-xs flex items-center justify-center"
                                title="Remove access"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                        {user.brand_accesses.filter(ba => ba.is_active).length === 0 && (
                          <span className="text-zinc-500 text-xs italic">No brand access</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {saving === user.id && (
                          <span className="text-amber-500 text-xs">Saving...</span>
                        )}
                        <button
                          onClick={() => setShowBrandAssign({ userId: user.id, userName: user.full_name || user.email })}
                          className="text-xs text-zinc-400 hover:text-white px-2 py-1 bg-zinc-700 rounded"
                        >
                          + Brand
                        </button>
                        <button
                          onClick={() => handleResendInvite(user.email)}
                          disabled={resending === user.id}
                          className="text-xs text-zinc-400 hover:text-amber-400 px-2 py-1 bg-zinc-700 rounded disabled:opacity-50"
                          title="Resend login invite email"
                        >
                          {resending === user.id ? '...' : '📧 Resend'}
                        </button>
                        <button
                          onClick={() => setEditingUser(user)}
                          className="text-xs text-zinc-400 hover:text-white px-2 py-1 bg-zinc-700 rounded"
                        >
                          Edit
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

      {/* Invite User Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h3 className="font-bold text-white mb-4">Invite New User</h3>
        
        {/* Success Message */}
        {inviteSuccess && (
          <div className="mb-4 bg-green-900/20 border border-green-900/50 text-green-400 p-4 rounded-lg flex items-start gap-3">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium">{inviteSuccess}</p>
            </div>
            <button 
              onClick={() => setInviteSuccess(null)}
              className="ml-auto text-green-400 hover:text-green-300"
            >
              ×
            </button>
          </div>
        )}

        {/* Error Message */}
        {inviteError && (
          <div className="mb-4 bg-red-900/20 border border-red-900/50 text-red-400 p-4 rounded-lg flex items-start gap-3">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium">{inviteError}</p>
            </div>
            <button 
              onClick={() => setInviteError(null)}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleInvite} className="space-y-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-mono text-zinc-500 mb-2">EMAIL ADDRESS *</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@company.com"
                required
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>
            <div className="w-48">
              <label className="block text-xs font-mono text-zinc-500 mb-2">FULL NAME</label>
              <input
                type="text"
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
                placeholder="John Smith"
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              />
            </div>
            <div className="w-48">
              <label className="block text-xs font-mono text-zinc-500 mb-2">GLOBAL ROLE</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              >
                <option value="viewer">Viewer</option>
                <option value="distributor">Distributor</option>
                <option value="sales">Sales</option>
                <option value="pricing_manager">Pricing Manager</option>
                <option value="admin">Admin</option>
                {isSuperAdmin && <option value="super_admin">Super Admin</option>}
              </select>
            </div>
          </div>

          {/* Brand Access Options */}
          <div className="flex gap-4 items-end flex-wrap border-t border-zinc-800 pt-4">
            <div className="w-48">
              <label className="block text-xs font-mono text-zinc-500 mb-2">BRAND ACCESS LEVEL</label>
              <select
                value={inviteBrandAccess}
                onChange={(e) => setInviteBrandAccess(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
              >
                <option value="viewer">Viewer</option>
                <option value="sales">Sales</option>
                <option value="pricing">Pricing</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            
            {isSuperAdmin && (
              <label className="flex items-center gap-3 bg-zinc-800 border border-zinc-700 rounded px-4 py-3 cursor-pointer hover:border-amber-500/50 transition-colors">
                <input
                  type="checkbox"
                  checked={inviteAllBrands}
                  onChange={(e) => setInviteAllBrands(e.target.checked)}
                  className="w-5 h-5 rounded border-zinc-600 text-amber-500 focus:ring-amber-500 focus:ring-offset-zinc-900"
                />
                <div>
                  <span className="text-white font-medium">Assign to ALL Brands</span>
                  <p className="text-xs text-zinc-500">Grant access to every active brand</p>
                </div>
              </label>
            )}

            <button
              type="submit"
              disabled={inviting || !inviteEmail}
              className="bg-amber-500 text-black font-bold px-6 py-3 rounded hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ml-auto"
            >
              {inviting ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" />
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Send Invite
                </>
              )}
            </button>
          </div>
        </form>
        <p className="text-xs text-zinc-500 mt-3">
          The user will receive an email invitation to set up their account and password.
          {inviteAllBrands 
            ? ' They will be granted access to all active brands.'
            : brand && ` They will also be granted ${inviteBrandAccess} access to ${brand.name}.`
          }
        </p>
      </div>

      {/* Brand Assignment Modal */}
      {showBrandAssign && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">Assign Brand Access</h3>
                <p className="text-sm text-zinc-400">For {showBrandAssign.userName}</p>
              </div>
              <button
                onClick={() => setShowBrandAssign(null)}
                className="text-zinc-500 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* All Brands Toggle - Super Admin Only */}
              {isSuperAdmin && (
                <label className="flex items-center gap-3 bg-zinc-800 border border-zinc-700 rounded px-4 py-3 cursor-pointer hover:border-amber-500/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={newBrandAssign.allBrands}
                    onChange={(e) => setNewBrandAssign({ ...newBrandAssign, allBrands: e.target.checked, brandId: '' })}
                    className="w-5 h-5 rounded border-zinc-600 text-amber-500 focus:ring-amber-500 focus:ring-offset-zinc-900"
                  />
                  <div>
                    <span className="text-white font-medium">Assign to ALL Brands</span>
                    <p className="text-xs text-zinc-500">Grant access to every active brand at once</p>
                  </div>
                </label>
              )}

              {/* Brand Selector - Hidden when All Brands is checked */}
              {!newBrandAssign.allBrands && (
                <div>
                  <label className="block text-xs font-mono text-zinc-500 mb-2">SELECT BRAND</label>
                  <select
                    value={newBrandAssign.brandId}
                    onChange={(e) => setNewBrandAssign({ ...newBrandAssign, brandId: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                  >
                    <option value="">Select a brand...</option>
                    {availableBrands.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-2">ACCESS LEVEL</label>
                <div className="grid grid-cols-2 gap-2">
                  {BRAND_ACCESS_LEVELS.map(level => (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => setNewBrandAssign({ ...newBrandAssign, accessLevel: level.value })}
                      className={`p-3 rounded border text-left transition-colors ${
                        newBrandAssign.accessLevel === level.value
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      <div className="font-medium text-white text-sm">{level.label}</div>
                      <div className="text-xs text-zinc-500">{level.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowBrandAssign(null);
                  setNewBrandAssign({ brandId: '', accessLevel: 'viewer', allBrands: false });
                }}
                className="flex-1 bg-zinc-700 text-white font-bold py-3 rounded hover:bg-zinc-600"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (newBrandAssign.allBrands) {
                    await handleAssignToAllBrands(showBrandAssign.userId, newBrandAssign.accessLevel);
                    setShowBrandAssign(null);
                    setNewBrandAssign({ brandId: '', accessLevel: 'viewer', allBrands: false });
                  } else if (newBrandAssign.brandId) {
                    await handleAssignToBrand(showBrandAssign.userId, newBrandAssign.brandId, newBrandAssign.accessLevel);
                    setShowBrandAssign(null);
                    setNewBrandAssign({ brandId: '', accessLevel: 'viewer', allBrands: false });
                  }
                }}
                disabled={(!newBrandAssign.allBrands && !newBrandAssign.brandId) || saving === showBrandAssign.userId}
                className="flex-1 bg-amber-500 text-black font-bold py-3 rounded hover:bg-amber-400 disabled:opacity-50"
              >
                {saving === showBrandAssign.userId ? 'Assigning...' : (newBrandAssign.allBrands ? 'Assign to All Brands' : 'Assign Access')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">Edit User Profile</h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-zinc-500 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-2">EMAIL ADDRESS</label>
                <div className="w-full bg-zinc-800/50 border border-zinc-700 text-zinc-300 p-3 rounded">
                  {editingUser.email}
                </div>
                <p className="text-xs text-zinc-600 mt-1">Email cannot be changed here</p>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-2">FULL NAME</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  placeholder="John Smith"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-2">PHONE</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="+61 400 000 000"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-500 mb-2">COMPANY</label>
                <input
                  type="text"
                  value={editForm.company}
                  onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                  placeholder="Company Name"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
                />
              </div>

              <div className="bg-zinc-800/50 rounded p-3 text-xs text-zinc-400">
                <div className="flex justify-between mb-1">
                  <span>User ID:</span>
                  <span className="font-mono text-zinc-500 text-[10px]">{editingUser.id}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingUser(null)}
                className="flex-1 bg-zinc-700 text-white font-bold py-3 rounded hover:bg-zinc-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={saving === editingUser.id}
                className="flex-1 bg-amber-500 text-black font-bold py-3 rounded hover:bg-amber-400 disabled:opacity-50"
              >
                {saving === editingUser.id ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
