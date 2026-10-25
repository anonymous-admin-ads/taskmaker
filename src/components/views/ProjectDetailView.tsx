import React, { useState, useEffect } from 'react';
import {
  FolderKanban, GitBranch, Users, Sliders, History, Plus, Trash2, ExternalLink, ShieldCheck, Check,
  Edit3, AlertTriangle, X, Settings
} from 'lucide-react';
import { Project, Repository } from '../../types';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useUiControls } from '../../context/UiControlsContext';
import { EditProjectModal } from '../modals/EditProjectModal';
import { DevAuthorityControl } from '../common/DevAuthorityControl';

interface ProjectDetailViewProps {
  project: Project | null;
  onNavigate: (view: string) => void;
  onRefreshProjects?: () => void;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  project,
  onNavigate,
  onRefreshProjects,
}) => {
  const { success, error } = useToast();
  const { isButtonEnabled } = useUiControls();

  const showEditProjectBtn = isButtonEnabled('btn_edit_project');
  const showDeleteProjectBtn = isButtonEnabled('btn_delete_project');

  const [activeTab, setActiveTab] = useState<'overview' | 'repositories' | 'members' | 'settings'>('overview');
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Edit / Delete modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePermanent, setDeletePermanent] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Add repo modal state
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [repoName, setRepoName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [repoDesc, setRepoDesc] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [submittingRepo, setSubmittingRepo] = useState(false);

  // Member management state
  const [workspaceUsers, setWorkspaceUsers] = useState<any[]>([]);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | string>('');
  const [selectedMemberRole, setSelectedMemberRole] = useState('Member');
  const [submittingMember, setSubmittingMember] = useState(false);

  const loadWorkspaceUsers = async () => {
    try {
      const res = await api.getAdminUsers();
      setWorkspaceUsers(res.users || []);
    } catch (e) {
      // fallback
    }
  };

  const loadProjectDetails = async () => {
    if (!project) return;
    try {
      setLoading(true);
      const res = await api.getProject(project.id);
      setDetails(res.project);
    } catch (e: any) {
      error('Failed to load project details', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjectDetails();
    loadWorkspaceUsers();
  }, [project?.id]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !selectedUserId) return;
    try {
      setSubmittingMember(true);
      await api.addProjectMember(project.id, selectedUserId, selectedMemberRole);
      success('Project Member Added', 'User added to project with designated role');
      setShowAddMemberModal(false);
      setSelectedUserId('');
      setSelectedMemberRole('Member');
      loadProjectDetails();
      onRefreshProjects?.();
    } catch (err: any) {
      error('Failed to add member', err.message);
    } finally {
      setSubmittingMember(false);
    }
  };

  const handleUpdateMemberRole = async (userId: number, role: string) => {
    if (!project) return;
    try {
      await api.updateProjectMember(project.id, userId, role);
      success('Role Updated', `Member role changed to ${role}`);
      loadProjectDetails();
      onRefreshProjects?.();
    } catch (err: any) {
      error('Failed to update member role', err.message);
    }
  };

  const handleRemoveMember = async (userId: number, memberName: string) => {
    if (!project) return;
    if (!window.confirm(`Are you sure you want to remove ${memberName} from this project?`)) return;
    try {
      await api.removeProjectMember(project.id, userId);
      success('Member Removed', `${memberName} removed from project`);
      loadProjectDetails();
      onRefreshProjects?.();
    } catch (err: any) {
      error('Failed to remove member', err.message);
    }
  };

  const handleUpdateProject = async (data: any) => {
    if (!project) return;
    try {
      await api.updateProject(project.id, data);
      success('Project Updated', `Saved changes to ${data.name}`);
      setShowEditModal(false);
      loadProjectDetails();
      onRefreshProjects?.();
    } catch (err: any) {
      error('Update Failed', err.message);
      throw err;
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    try {
      setIsDeleting(true);
      await api.deleteProject(project.id, deletePermanent);
      success(
        deletePermanent ? 'Project Permanently Deleted' : 'Project Archived',
        `Successfully removed ${project.name}`
      );
      setShowDeleteModal(false);
      onRefreshProjects?.();
      onNavigate('projects');
    } catch (err: any) {
      error('Deletion Failed', err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    try {
      setSubmittingRepo(true);
      await api.addRepository(project.id, {
        name: repoName.trim(),
        url: repoUrl.trim(),
        description: repoDesc.trim(),
        isPrimary,
      });
      success('Repository Added', 'HTTPS repository URL validated and linked');
      setRepoName('');
      setRepoUrl('');
      setRepoDesc('');
      setIsPrimary(false);
      setShowAddRepo(false);
      loadProjectDetails();
    } catch (err: any) {
      error('Repository Error', err.message);
    } finally {
      setSubmittingRepo(false);
    }
  };

  const handleDeleteRepo = async (repoId: number) => {
    if (!project) return;
    try {
      await api.deleteRepository(project.id, repoId);
      success('Repository Link Removed');
      loadProjectDetails();
    } catch (err: any) {
      error('Failed to remove repository', err.message);
    }
  };

  if (!project) {
    return (
      <div className="flex-1 p-12 flex flex-col items-center justify-center text-center space-y-4 bg-theme-bg">
        <div className="w-16 h-16 rounded-2xl bg-theme-surface border border-theme-border flex items-center justify-center text-theme-muted shadow-sm">
          <FolderKanban className="w-8 h-8 text-theme-primary" />
        </div>
        <div className="max-w-md">
          <h2 className="text-lg font-bold text-theme-text">No Project Selected</h2>
          <p className="text-xs text-theme-muted mt-1 leading-relaxed">
            All demo projects and demo tasks have been cleaned up. Create or select a project to start managing team members and agile workflows.
          </p>
        </div>
        <button
          onClick={() => onNavigate('projects')}
          className="px-4 py-2 rounded-xl bg-theme-primary text-slate-950 font-bold text-xs shadow-md shadow-theme-primary/20 hover:brightness-110 transition cursor-pointer"
        >
          View Projects Page →
        </button>
      </div>
    );
  }

  if (loading || !details) {
    return (
      <div className="flex-1 p-8 text-xs text-theme-muted flex items-center justify-center animate-pulse">
        Loading project workspace...
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-theme-bg">
      {/* Project Header */}
      <div className="p-5 rounded-2xl border border-theme-border bg-theme-surface flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-theme-primary/15 border border-theme-primary/30 text-theme-primary font-bold text-sm flex items-center justify-center shadow-md">
            {project.key}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-theme-text">{project.name}</h1>
              <span className="font-mono text-xs text-theme-muted">({project.key})</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {project.status}
              </span>
            </div>
            <p className="text-xs text-theme-muted mt-0.5 max-w-xl">
              {project.description || 'Enterprise planning system for modern agile development.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Edit Project Button (Guarded by UI element control) */}
          <DevAuthorityControl elementId="btn_edit_project" name="Edit Project" location="Project Details" inline>
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-theme-bg border border-theme-border text-xs font-semibold text-theme-text hover:text-theme-primary hover:border-theme-primary transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Project</span>
            </button>
          </DevAuthorityControl>

          {/* Delete Project Button (Guarded by UI element control) */}
          <DevAuthorityControl elementId="btn_delete_project" name="Delete Project" location="Project Details" inline>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-theme-bg border border-theme-border text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:border-rose-400 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Project</span>
            </button>
          </DevAuthorityControl>

          <button
            onClick={() => onNavigate('board')}
            className="px-4 py-2 rounded-xl bg-theme-primary text-slate-950 font-bold text-xs shadow-md shadow-theme-primary/20 hover:brightness-110 transition cursor-pointer"
          >
            Open Kanban Board →
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-6 border-b border-theme-border text-xs font-semibold text-theme-muted">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 border-b-2 transition ${
            activeTab === 'overview' ? 'border-theme-primary text-theme-primary font-bold' : 'border-transparent hover:text-theme-text'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('repositories')}
          className={`pb-3 border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'repositories' ? 'border-theme-primary text-theme-primary font-bold' : 'border-transparent hover:text-theme-text'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span>Repositories ({details.repositories?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`pb-3 border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'members' ? 'border-theme-primary text-theme-primary font-bold' : 'border-transparent hover:text-theme-text'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Members ({details.members?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'settings' ? 'border-theme-primary text-theme-primary font-bold' : 'border-transparent hover:text-theme-text'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Project Settings</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Tab Content */}
        <div className="lg:col-span-2 space-y-4">
          {activeTab === 'repositories' && (
            <div className="rounded-2xl border border-theme-border bg-theme-surface p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-theme-text">GitHub Repositories</h3>
                  <p className="text-xs text-theme-muted mt-0.5">Secure HTTPS repository links connected to {project.key}.</p>
                </div>
                <button
                  onClick={() => setShowAddRepo(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-surface-hover border border-theme-border text-xs font-semibold text-theme-text hover:border-theme-primary transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-theme-primary" />
                  <span>Add Repository</span>
                </button>
              </div>

              {/* Repositories List */}
              <div className="space-y-3">
                {details.repositories?.map((r: Repository) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-xl bg-theme-bg/60 border border-theme-border flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-theme-primary shrink-0" />
                        <span className="font-semibold text-xs text-theme-text">{r.name}</span>
                        {r.is_primary === 1 && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-theme-primary/10 text-theme-primary border border-theme-primary/20">
                            Primary
                          </span>
                        )}
                      </div>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-theme-muted hover:text-theme-primary truncate block mt-1 flex items-center gap-1"
                      >
                        <span>{r.url}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>

                    <button
                      onClick={() => handleDeleteRepo(r.id)}
                      className="p-1.5 rounded-lg text-theme-muted hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {(!details.repositories || details.repositories.length === 0) && (
                  <div className="py-8 text-center text-xs text-theme-muted border border-dashed border-theme-border rounded-xl">
                    No repositories linked to this project yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="rounded-2xl border border-theme-border bg-theme-surface p-5 space-y-4">
              <h3 className="font-bold text-sm text-theme-text">Project Overview & Milestones</h3>
              <p className="text-xs text-theme-muted leading-relaxed">
                {details.description || 'Enterprise project workspace configured with agile workflow pipelines and quality controls.'}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-theme-border">
                <div className="p-3 rounded-xl bg-theme-bg/60 border border-theme-border">
                  <div className="text-[11px] text-theme-muted">Total Tickets</div>
                  <div className="text-lg font-bold text-theme-text mt-1">{details.stats?.total_tickets || 0}</div>
                </div>
                <div className="p-3 rounded-xl bg-theme-bg/60 border border-theme-border">
                  <div className="text-[11px] text-theme-muted">Completed</div>
                  <div className="text-lg font-bold text-emerald-400 mt-1">{details.stats?.done_tickets || 0}</div>
                </div>
                <div className="p-3 rounded-xl bg-theme-bg/60 border border-theme-border">
                  <div className="text-[11px] text-theme-muted">Hold Box</div>
                  <div className="text-lg font-bold text-amber-400 mt-1">{details.stats?.hold_tickets || 0}</div>
                </div>
                <div className="p-3 rounded-xl bg-theme-bg/60 border border-theme-border">
                  <div className="text-[11px] text-theme-muted">Blocked Box</div>
                  <div className="text-lg font-bold text-rose-400 mt-1">{details.stats?.blocked_tickets || 0}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="rounded-2xl border border-theme-border bg-theme-surface p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-theme-border">
                <div>
                  <h3 className="font-bold text-sm text-theme-text flex items-center gap-2">
                    <Users className="w-4 h-4 text-theme-primary" />
                    <span>Authorized Project Members</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {details.members?.length || 0}
                    </span>
                  </h3>
                  <p className="text-xs text-theme-muted mt-0.5">
                    Assign and manage workspace members, configure project roles, and grant permissions.
                  </p>
                </div>

                <DevAuthorityControl elementId="btn_project_add_member" name="+ Add Member to Project" location="Project Details" inline>
                  <button
                    onClick={() => {
                      loadWorkspaceUsers();
                      setShowAddMemberModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-theme-primary text-slate-950 font-bold text-xs shadow-md shadow-theme-primary/20 hover:brightness-110 active:scale-95 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>+ Add Member</span>
                  </button>
                </DevAuthorityControl>
              </div>

              <div className="divide-y divide-theme-border/60">
                {details.members?.map((m: any) => (
                  <div key={m.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-theme-primary/15 border border-theme-primary/30 text-theme-primary font-bold text-xs flex items-center justify-center shrink-0">
                        {m.avatar || m.name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-theme-text flex items-center gap-2">
                          <span className="truncate">{m.name}</span>
                          {m.workspace_role && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                              {m.workspace_role}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-theme-muted truncate">{m.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <DevAuthorityControl elementId="btn_project_manage_members" name="Modify Member Role & Remove" location="Project Details" inline>
                        <div className="flex items-center gap-2">
                          <select
                            value={m.project_role || 'Member'}
                            onChange={e => handleUpdateMemberRole(m.id, e.target.value)}
                            className="bg-theme-bg border border-theme-border rounded-lg px-2.5 py-1 text-xs font-semibold text-theme-text focus:outline-none focus:border-theme-primary transition cursor-pointer"
                            title="Change project-specific role"
                          >
                            <option value="Lead">Lead</option>
                            <option value="Member">Member</option>
                            <option value="Contributor">Contributor</option>
                            <option value="Viewer">Viewer</option>
                          </select>

                          <button
                            onClick={() => handleRemoveMember(m.id, m.name)}
                            className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/40 transition cursor-pointer"
                            title="Remove member from this project"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </DevAuthorityControl>
                    </div>
                  </div>
                ))}

                {(!details.members || details.members.length === 0) && (
                  <div className="py-8 text-center text-xs text-theme-muted border border-dashed border-theme-border rounded-xl">
                    No members assigned to this project yet. Click &quot;+ Add Member&quot; to assign workspace users.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="rounded-2xl border border-theme-border bg-theme-surface p-5 space-y-6 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-theme-border">
                <div>
                  <h3 className="font-bold text-sm text-theme-text flex items-center gap-2">
                    <Settings className="w-4 h-4 text-theme-primary" />
                    <span>Project Settings & Metadata</span>
                  </h3>
                  <p className="text-xs text-theme-muted mt-0.5">Manage project metadata, lifecycle status, and project deletion.</p>
                </div>

                {showEditProjectBtn && (
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-theme-primary text-slate-950 font-bold text-xs shadow-md shadow-theme-primary/20 hover:brightness-110 active:scale-95 transition cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Name, Key & Dates</span>
                  </button>
                )}
              </div>

              {/* Danger Zone */}
              {showDeleteProjectBtn && (
                <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-3">
                  <h4 className="font-bold text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Danger Zone</span>
                  </h4>
                  <p className="text-xs text-theme-muted">
                    Archive or permanently delete this project and all associated tickets, sprints, attachments, and members.
                  </p>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition cursor-pointer shadow-md shadow-rose-600/20"
                  >
                    Delete / Archive Project
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right 1 Col: Project Information Sidebar */}
        <div className="p-5 rounded-2xl border border-theme-border bg-theme-surface space-y-4 text-xs h-fit shadow-sm">
          <h3 className="font-bold text-sm text-theme-text pb-2 border-b border-theme-border">
            Project Information
          </h3>

          <div>
            <span className="text-theme-muted block text-[11px] mb-1">Start Date</span>
            <span className="font-medium text-theme-text">{details.start_date || 'Sep 21, 2026'}</span>
          </div>

          <div>
            <span className="text-theme-muted block text-[11px] mb-1">Target Delivery</span>
            <span className="font-medium text-theme-text">{details.target_date || 'Oct 21, 2026'}</span>
          </div>

          <div>
            <span className="text-theme-muted block text-[11px] mb-1">Project Owner</span>
            <div className="flex items-center gap-2 font-medium text-theme-text">
              <div className="w-6 h-6 rounded-full bg-theme-primary/20 text-theme-primary font-bold text-[10px] flex items-center justify-center">
                {details.owner_avatar || details.owner_name?.[0] || 'O'}
              </div>
              <span>{details.owner_name || 'Kamalesh'}</span>
            </div>
          </div>

          <div>
            <span className="text-theme-muted block text-[11px] mb-1">Workflow Status</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {details.status}
            </span>
          </div>
        </div>
      </div>

      {/* Edit Project Modal */}
      {showEditModal && (
        <EditProjectModal
          project={project}
          onConfirm={handleUpdateProject}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {/* Delete / Archive Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-theme-surface shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-theme-border">
              <div className="flex items-center gap-2.5 text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="font-bold text-sm text-theme-text">Delete / Archive Project</h3>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="p-1 rounded-lg text-theme-muted hover:text-theme-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-theme-muted leading-relaxed">
              Are you sure you want to remove project{' '}
              <span className="font-bold text-theme-text">{project.name} ({project.key})</span>?
            </p>

            <div className="p-3 rounded-xl bg-theme-bg border border-theme-border space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={deletePermanent}
                  onChange={e => setDeletePermanent(e.target.checked)}
                  className="rounded text-rose-500 mt-0.5"
                />
                <div>
                  <span className="font-bold text-rose-300 block">Permanent Cascade Deletion</span>
                  <span className="text-[11px] text-theme-muted leading-tight block">
                    If checked, permanently deletes the project and all its tickets, sprints, attachments, comments, and members. If unchecked, the project is safely archived.
                  </span>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-theme-border">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-theme-muted hover:text-theme-text"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteProject}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition disabled:opacity-50"
              >
                {isDeleting ? 'Processing...' : deletePermanent ? 'Delete Permanently' : 'Archive Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Repository Modal */}
      {showAddRepo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-theme-border bg-theme-surface shadow-2xl p-5 space-y-4">
            <h3 className="font-bold text-sm text-theme-text">Link GitHub Repository</h3>
            <form onSubmit={handleAddRepo} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-theme-text mb-1">Repository Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Frontend"
                  value={repoName}
                  onChange={e => setRepoName(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text mb-1">Repository HTTPS URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://github.com/texawave/erp-frontend"
                  value={repoUrl}
                  onChange={e => setRepoUrl(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="primaryRepo"
                  checked={isPrimary}
                  onChange={e => setIsPrimary(e.target.checked)}
                  className="rounded text-theme-primary"
                />
                <label htmlFor="primaryRepo" className="text-xs text-theme-text">Mark as Primary Repository</label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-theme-border">
                <button
                  type="button"
                  onClick={() => setShowAddRepo(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-theme-muted hover:text-theme-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRepo}
                  className="px-4 py-1.5 rounded-lg bg-theme-primary text-slate-950 font-bold text-xs"
                >
                  {submittingRepo ? 'Adding...' : 'Add Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-theme-border bg-theme-surface shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-theme-border">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-theme-primary" />
                <h3 className="font-bold text-sm text-theme-text">Add Member to {project.name}</h3>
              </div>
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="p-1 rounded-lg text-theme-muted hover:text-theme-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-theme-text mb-1">Select Workspace User</label>
                <select
                  required
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary transition cursor-pointer"
                >
                  <option value="">-- Choose User --</option>
                  {workspaceUsers
                    .filter(u => u.user_id !== 'DEV-CONSOLE-ROOT' && !details.members?.some((m: any) => m.id === u.id))
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email}) - {u.role}
                      </option>
                    ))}
                </select>
                {workspaceUsers.filter(u => u.user_id !== 'DEV-CONSOLE-ROOT' && !details.members?.some((m: any) => m.id === u.id)).length === 0 && (
                  <p className="text-[11px] text-amber-400 mt-1">All available workspace users are already members of this project.</p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-theme-text mb-1">Project Role</label>
                <select
                  value={selectedMemberRole}
                  onChange={e => setSelectedMemberRole(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary transition cursor-pointer"
                >
                  <option value="Lead">Lead - Project Leadership & Reviews</option>
                  <option value="Member">Member - Standard Project Contributor</option>
                  <option value="Contributor">Contributor - Task Execution</option>
                  <option value="Viewer">Viewer - Read-Only Access</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-theme-border">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-theme-muted hover:text-theme-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingMember || !selectedUserId}
                  className="px-4 py-2 rounded-xl bg-theme-primary text-slate-950 font-bold text-xs shadow-md shadow-theme-primary/20 hover:brightness-110 active:scale-95 transition disabled:opacity-50 cursor-pointer"
                >
                  {submittingMember ? 'Adding...' : 'Add to Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
