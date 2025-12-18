import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { UserRole } from '../../types';

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
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
      // Get all users from auth.users (requires service role, so we use an RPC or Edge Function)
      // For now, we'll get users who have roles assigned
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Get user details for each role
      const userIds = [...new Set(rolesData?.map(r => r.user_id) || [])];
      
      // Since we can't query auth.users directly from client, we'll show what we have
      // In production, you'd create an Edge Function to list users
      const usersWithRoles: UserWithRole[] = rolesData?.map(r => ({
        id: r.user_id,
        email: `User ${r.user_id.substring(0, 8)}...`, // Placeholder
        created_at: new Date().toISOString(),
        role: r.role as UserRole,
      })) || [];

      // Try to get actual user emails from a users view if it exists
      const { data: userDetails } = await supabase
        .rpc('get_users_with_emails')
        .select('*');

      if (userDetails) {
        // Merge with actual user data
        userDetails.forEach((u: any) => {
          const existing = usersWithRoles.find(ur => ur.id === u.id);
          if (existing) {
            existing.email = u.email;
            existing.created_at = u.created_at;
          } else {
            usersWithRoles.push({
              id: u.id,
              email: u.email,
              created_at: u.created_at,
              role: null,
            });
          }
        });
      }

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
                <th className="text-left px-6 py-3">User</th>
                <th className="text-left px-6 py-3">Current Role</th>
                <th className="text-left px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-zinc-800/50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{user.email}</div>
                    <div className="text-xs text-zinc-500 font-mono">{user.id}</div>
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
                      <span className="ml-2 text-amber-500 text-xs">Saving...</span>
                    )}
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
    </div>
  );
};

export default UserManagement;
