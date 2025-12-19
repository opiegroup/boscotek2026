import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { UserRole } from '../../types';

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  company: string | null;
  created_at: string;
  last_sign_in: string | null;
  role: UserRole | null;
}

const ROLE_LABELS: Record<UserRole, { label: string; color: string; description: string }> = {
  admin: { label: 'Admin', color: 'bg-red-500', description: 'Full system access' },
  pricing_manager: { label: 'Pricing Manager', color: 'bg-purple-500', description: 'Manage pricing and catalogue' },
  sales: { label: 'Sales', color: 'bg-blue-500', description: 'Create quotes and manage customers' },
  distributor: { label: 'Distributor', color: 'bg-green-500', description: 'View own orders with tier pricing' },
  viewer: { label: 'Viewer', color: 'bg-zinc-500', description: 'Read-only access' },
};

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  // Load users and their roles
  const loadUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      // Call the RPC function that fetches users with emails and profiles
      const { data: userDetails, error: rpcError } = await supabase
        .rpc('get_users_with_emails');

      console.log('RPC result:', { userDetails, rpcError });

      if (rpcError) {
        // Fallback to just loading roles if RPC fails (insufficient permissions)
        console.warn('RPC failed, falling back to roles only:', rpcError);
        setError(`Could not load user emails: ${rpcError.message}. Showing user IDs only.`);
        
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
        })) || [];

        setUsers(usersWithRoles);
        return;
      }

      if (!userDetails || userDetails.length === 0) {
        console.warn('RPC returned empty data');
        setError('No users found. Make sure you have admin permissions.');
        setUsers([]);
        return;
      }

      // Map RPC results to our interface
      const usersWithRoles: UserWithRole[] = (userDetails || []).map((u: any) => ({
        id: u.id,
        email: u.email || '(no email)',
        full_name: u.full_name,
        phone: u.phone,
        company: u.company,
        created_at: u.created_at,
        last_sign_in: u.last_sign_in,
        role: u.role as UserRole | null,
      }));

      console.log('Mapped users:', usersWithRoles);
      setUsers(usersWithRoles);
    } catch (err: any) {
      console.error('Error loading users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Assign or update role
  const handleRoleChange = async (userId: string, newRole: UserRole | 'none') => {
    setSaving(userId);
    
    try {
      if (newRole === 'none') {
        // Remove role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId);
        
        if (error) throw error;
      } else {
        // Check if user already has a role
        const existingUser = users.find(u => u.id === userId);
        
        if (existingUser?.role) {
          // Update existing role
          const { error } = await supabase
            .from('user_roles')
            .update({ role: newRole })
            .eq('user_id', userId);
          
          if (error) throw error;
        } else {
          // Insert new role
          const { error } = await supabase
            .from('user_roles')
            .insert({ user_id: userId, role: newRole });
          
          if (error) throw error;
        }
      }
      
      // Reload users
      await loadUsers();
    } catch (err: any) {
      console.error('Error updating role:', err);
      alert(`Failed to update role: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  // Edit user state
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', company: '' });

  // Update edit form when user changes
  useEffect(() => {
    if (editingUser) {
      setEditForm({
        full_name: editingUser.full_name || '',
        phone: editingUser.phone || '',
        company: editingUser.company || '',
      });
    }
  }, [editingUser]);

  // Save user profile
  const handleSaveProfile = async () => {
    if (!editingUser) return;
    setSaving(editingUser.id);

    try {
      console.log('Saving profile for user:', editingUser.id, editForm);
      
      // First try to update existing profile
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', editingUser.id)
        .single();

      let error;
      
      if (existingProfile) {
        // Update existing
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
        console.log('Update result:', result);
      } else {
        // Insert new
        const result = await supabase
          .from('user_profiles')
          .insert({
            id: editingUser.id,
            full_name: editForm.full_name || null,
            phone: editForm.phone || null,
            company: editForm.company || null,
          });
        error = result.error;
        console.log('Insert result:', result);
      }

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      await loadUsers();
      setEditingUser(null);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      alert(`Failed to save: ${err.message}\n\nCheck browser console for details.`);
    } finally {
      setSaving(null);
    }
  };

  // Add new user by email (invite)
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('viewer');
  const [inviting, setInviting] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setInviting(true);
    try {
      // Create user via Supabase Auth admin API (requires Edge Function)
      // For now, show instructions
      alert(
        `To add a new user:\n\n` +
        `1. Have them sign up at the configurator\n` +
        `2. Find their User ID in Supabase Dashboard > Authentication > Users\n` +
        `3. Run this SQL:\n\n` +
        `INSERT INTO user_roles (user_id, role)\n` +
        `VALUES ('<user-id>', '${inviteRole}');`
      );
      setInviteEmail('');
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
      <div>
        <h1 className="text-3xl font-bold mb-2">User Management</h1>
        <p className="text-zinc-400">Assign roles to control access levels across the platform.</p>
      </div>

      {/* Role Legend */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <h3 className="text-sm font-bold text-zinc-400 uppercase mb-3">Role Definitions</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
          <h3 className="font-bold text-white">Users ({users.length})</h3>
          <button
            onClick={loadUsers}
            className="text-xs text-zinc-400 hover:text-white px-3 py-1 bg-zinc-700 rounded"
          >
            Refresh
          </button>
        </div>

        {users.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            No users with roles assigned yet.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-zinc-950 text-xs text-zinc-500 uppercase">
              <tr>
                <th className="text-left px-6 py-3">Name</th>
                <th className="text-left px-6 py-3">Email</th>
                <th className="text-left px-6 py-3">Company</th>
                <th className="text-left px-6 py-3">Current Role</th>
                <th className="text-left px-6 py-3">Last Active</th>
                <th className="text-left px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-zinc-800/50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">
                      {user.full_name || <span className="text-zinc-500 italic">No name</span>}
                    </div>
                    {user.phone && (
                      <div className="text-xs text-zinc-500">{user.phone}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-white">{user.email}</div>
                    <div className="text-xs text-zinc-600 font-mono">{user.id.substring(0, 8)}...</div>
                  </td>
                  <td className="px-6 py-4">
                    {user.company ? (
                      <span className="text-zinc-300">{user.company}</span>
                    ) : (
                      <span className="text-zinc-600">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {user.role ? (
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-white ${ROLE_LABELS[user.role].color}`}>
                        {ROLE_LABELS[user.role].label}
                      </span>
                    ) : (
                      <span className="text-zinc-500 italic">No role</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {user.last_sign_in ? (
                      <div>
                        <div className="text-sm text-zinc-300">
                          {new Date(user.last_sign_in).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {new Date(user.last_sign_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ) : (
                      <span className="text-zinc-600">Never</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <select
                        value={user.role || 'none'}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole | 'none')}
                        disabled={saving === user.id}
                        className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded px-3 py-2 focus:border-amber-500 outline-none disabled:opacity-50"
                      >
                        <option value="none">Remove Role</option>
                        <option value="admin">Admin</option>
                        <option value="pricing_manager">Pricing Manager</option>
                        <option value="sales">Sales</option>
                        <option value="distributor">Distributor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      {saving === user.id && (
                        <span className="text-amber-500 text-xs">Saving...</span>
                      )}
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
        )}
      </div>

      {/* Add User Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h3 className="font-bold text-white mb-4">Add New User</h3>
        <form onSubmit={handleInvite} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-mono text-zinc-500 mb-2">EMAIL ADDRESS</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@company.com"
              className="w-full bg-zinc-800 border border-zinc-700 text-white p-3 rounded focus:border-amber-500 outline-none"
            />
          </div>
          <div className="w-48">
            <label className="block text-xs font-mono text-zinc-500 mb-2">INITIAL ROLE</label>
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
            </select>
          </div>
          <button
            type="submit"
            disabled={inviting || !inviteEmail}
            className="bg-amber-500 text-black font-bold px-6 py-3 rounded hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {inviting ? 'Adding...' : 'Add User'}
          </button>
        </form>
        <p className="text-xs text-zinc-500 mt-3">
          Note: Users must first create an account via the configurator sign-up flow.
        </p>
      </div>

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
              {/* Email - read only */}
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
                <div className="flex justify-between mb-1">
                  <span>Created:</span>
                  <span>{new Date(editingUser.created_at).toLocaleDateString()}</span>
                </div>
                {editingUser.last_sign_in && (
                  <div className="flex justify-between">
                    <span>Last Sign In:</span>
                    <span>{new Date(editingUser.last_sign_in).toLocaleDateString()}</span>
                  </div>
                )}
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
