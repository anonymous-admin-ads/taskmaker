import React, { useState, useEffect } from 'react';
import { Plus, Users, Search, Mail, Shield, Check } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useUiControls } from '../../context/UiControlsContext';
import { DevAuthorityControl } from '../common/DevAuthorityControl';

export const TeamsView: React.FC = () => {
  const { success, error } = useToast();
  const { isButtonEnabled } = useUiControls();
  const isRoleEnforcementActive = isButtonEnabled('btn_role_enforcement');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add Member Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Developer');
  const [password, setPassword] = useState('Password@123');
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminUsers();
      setUsers(res.users || []);
    } catch (e: any) {
      error('Failed to load team members', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.createAdminUser({
        name: name.trim(),
        email: email.trim(),
        role,
        password,
      });
      success('Team Member Provisioned', `${name} can now sign in`);
      setName('');
      setEmail('');
      setShowAddModal(false);
      loadUsers();
    } catch (err: any) {
      error('Failed to create team member', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = users.filter(u => {
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-5 bg-theme-bg">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-theme-text tracking-tight">Teams & People</h1>
          <p className="text-xs text-theme-muted mt-0.5">Manage your team members, workspace roles and project access.</p>
        </div>

        <DevAuthorityControl elementId="btn_add_team_member" name="Add Team Member" location="Teams" inline>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-theme-primary text-slate-950 font-semibold text-xs shadow-md shadow-theme-primary/20 hover:brightness-110 transition active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Member</span>
          </button>
        </DevAuthorityControl>
      </div>

      {/* Search */}
      <div className="flex items-center justify-between gap-4">
        <DevAuthorityControl elementId="teams_search" name="Teams Search Bar" location="Teams" inline>
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
            <input
              type="text"
              placeholder="Search team members..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-theme-surface border border-theme-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
            />
          </div>
        </DevAuthorityControl>
      </div>

      {/* Team Table (Matching screenshot Team Management screen) */}
      <div className="rounded-2xl border border-theme-border bg-theme-surface overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-theme-border bg-theme-surface-hover/50 text-theme-muted text-[11px] uppercase tracking-wider font-semibold">
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Project Access</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Active Sessions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border/50">
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-theme-surface-hover transition">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-600 to-teal-400 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {u.avatar || u.name[0]}
                    </div>
                    <div>
                      <div className="font-bold text-theme-text">{u.name}</div>
                      <div className="text-[11px] text-theme-muted">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  {!isRoleEnforcementActive ? (
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      REGULAR USER
                    </span>
                  ) : (
                    <span
                      className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                        u.role === 'super_admin'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : u.role === 'project_manager'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : u.role === 'qa_engineer'
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {u.role.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-theme-text font-medium">
                  {u.role === 'super_admin' ? 'All projects' : `${u.project_count || 3} projects`}
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                    {u.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-mono text-theme-muted">
                  {u.active_sessions > 0 ? (
                    <span className="text-emerald-400 font-semibold">{u.active_sessions} live</span>
                  ) : (
                    '0'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-theme-border bg-theme-surface shadow-2xl p-5 space-y-4">
            <h3 className="font-bold text-sm text-theme-text">Add Team Member</h3>
            <form onSubmit={handleCreateMember} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-theme-text mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Karthik"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="karthik@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
                />
              </div>

              <DevAuthorityControl elementId="opt_workspace_role" name="Member Workspace Role Selection" location="Teams" inline>
                <div>
                  <label className="block text-xs font-semibold text-theme-text mb-1">Role Assignment</label>
                  {!isRoleEnforcementActive ? (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed">
                      <strong>Regular User Mode:</strong> Role enforcement is turned OFF by Developer Console. All users are provisioned with universal access to all projects, tasks, and workflows.
                    </div>
                  ) : (
                    <select
                      value={role}
                      onChange={e => setRole(e.target.value)}
                      className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary cursor-pointer"
                    >
                      <option value="developer">Developer</option>
                      <option value="project_manager">Project Manager</option>
                      <option value="qa_engineer">QA Engineer</option>
                      <option value="team_lead">Team Lead</option>
                      <option value="admin">Administrator</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  )}
                </div>
              </DevAuthorityControl>

              <div>
                <label className="block text-xs font-semibold text-theme-text mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-theme-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-theme-muted hover:text-theme-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-theme-primary text-slate-950 font-bold text-xs"
                >
                  {submitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

