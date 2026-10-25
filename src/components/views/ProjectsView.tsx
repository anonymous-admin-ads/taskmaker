import React, { useState } from 'react';
import { Plus, Search, FolderKanban, Calendar, Users, ExternalLink, Edit3, Trash2, AlertTriangle, X } from 'lucide-react';
import { Project } from '../../types';
import { useUiControls } from '../../context/UiControlsContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { EditProjectModal } from '../modals/EditProjectModal';
import { DevAuthorityControl } from '../common/DevAuthorityControl';

interface ProjectsViewProps {
  projects: Project[];
  onSelectProject: (p: Project) => void;
  onOpenCreateProject: () => void;
  onNavigate: (view: string) => void;
  onRefreshProjects?: () => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  onSelectProject,
  onOpenCreateProject,
  onNavigate,
  onRefreshProjects,
}) => {
  const { isButtonEnabled } = useUiControls();
  const { success, error } = useToast();

  const showCreateProjectBtn = isButtonEnabled('btn_create_project');
  const showEditProjectBtn = isButtonEnabled('btn_edit_project');
  const showDeleteProjectBtn = isButtonEnabled('btn_delete_project');

  const [filter, setFilter] = useState<'All' | 'Active' | 'Archived'>('All');
  const [search, setSearch] = useState('');

  // Modals state
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deletePermanent, setDeletePermanent] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = projects.filter(p => {
    if (filter !== 'All' && p.status !== filter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.key.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const handleUpdateProject = async (data: any) => {
    if (!projectToEdit) return;
    try {
      await api.updateProject(projectToEdit.id, data);
      success('Project Updated', `Saved changes to ${data.name}`);
      setProjectToEdit(null);
      onRefreshProjects?.();
    } catch (err: any) {
      error('Update Failed', err.message);
      throw err;
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      setIsDeleting(true);
      await api.deleteProject(projectToDelete.id, deletePermanent);
      success(
        deletePermanent ? 'Project Deleted Permanently' : 'Project Archived',
        `Successfully processed project ${projectToDelete.name}`
      );
      setProjectToDelete(null);
      setDeletePermanent(false);
      onRefreshProjects?.();
    } catch (err: any) {
      error('Deletion Failed', err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-5 bg-theme-bg">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-theme-text tracking-tight">Projects</h1>
          <p className="text-xs text-theme-muted mt-0.5">Manage your projects, repositories and team spaces.</p>
        </div>

        <DevAuthorityControl elementId="btn_create_project" name="+ New Project" location="Projects" inline>
          <button
            onClick={onOpenCreateProject}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ New Project</span>
          </button>
        </DevAuthorityControl>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <DevAuthorityControl elementId="projects_filter_tabs" name="Filter Tabs" location="Projects" inline>
          <div className="flex items-center gap-1 bg-theme-surface p-1 rounded-xl border border-theme-border">
            {(['All', 'Active', 'Archived'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  filter === tab ? 'bg-theme-primary text-slate-950 shadow-sm' : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </DevAuthorityControl>

        <DevAuthorityControl elementId="projects_search" name="Projects Search Bar" location="Projects" inline>
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-theme-surface border border-theme-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-theme-text placeholder:text-theme-muted focus:outline-none focus:border-theme-primary transition"
            />
          </div>
        </DevAuthorityControl>
      </div>

      {/* Projects Table */}
      <div className="rounded-2xl border border-theme-border bg-theme-surface overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-theme-border bg-theme-surface-hover/50 text-theme-muted text-[11px] uppercase tracking-wider font-semibold">
              <th className="py-3 px-4">Key / Project</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4">Members</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Target Date</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border/50">
            {filtered.map(p => (
              <tr
                key={p.id}
                onClick={() => {
                  onSelectProject(p);
                  onNavigate('project_detail');
                }}
                className="hover:bg-theme-surface-hover cursor-pointer transition"
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-theme-primary/15 border border-theme-primary/30 text-theme-primary font-bold text-xs flex items-center justify-center shrink-0">
                      {p.key.substring(0, 2)}
                    </div>
                    <div>
                      <div className="font-bold text-theme-text">{p.name}</div>
                      <div className="text-[11px] font-mono text-theme-muted">{p.key}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-theme-muted max-w-sm truncate">
                  {p.description || 'Enterprise planning and task management'}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center -space-x-1.5">
                    {p.members?.slice(0, 4).map((m, idx) => (
                      <div
                        key={idx}
                        title={m.name}
                        className="w-6 h-6 rounded-full bg-slate-800 border-2 border-theme-surface text-[10px] font-bold text-theme-primary flex items-center justify-center"
                      >
                        {m.avatar || m.name[0]}
                      </div>
                    ))}
                    {(p.members?.length || 0) > 4 && (
                      <span className="text-[10px] text-theme-muted pl-2">+{p.members!.length - 4}</span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      p.status === 'Active'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-theme-muted font-medium">
                  {p.target_date || 'Ongoing'}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                    {/* Edit Project Button (Guarded by Developer Console UI element control) */}
                    <DevAuthorityControl elementId="btn_edit_project" name="Edit Project" location="Projects" inline>
                      <button
                        onClick={() => setProjectToEdit(p)}
                        className="p-1.5 rounded-lg bg-theme-bg border border-theme-border text-theme-muted hover:text-theme-primary hover:border-theme-primary transition"
                        title="Edit Project"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </DevAuthorityControl>

                    {/* Delete Project Button (Guarded by Developer Console UI element control) */}
                    <DevAuthorityControl elementId="btn_delete_project" name="Delete Project" location="Projects" inline>
                      <button
                        onClick={() => setProjectToDelete(p)}
                        className="p-1.5 rounded-lg bg-theme-bg border border-theme-border text-theme-muted hover:text-rose-400 hover:border-rose-400 transition"
                        title="Delete / Archive Project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </DevAuthorityControl>

                    <button
                      onClick={() => {
                        onSelectProject(p);
                        onNavigate('board');
                      }}
                      className="px-3 py-1 rounded-lg bg-theme-bg border border-theme-border text-xs font-semibold text-theme-text hover:text-theme-primary hover:border-theme-primary transition"
                    >
                      Open Board →
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-theme-muted text-xs">
                  No projects found matching the criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Project Modal */}
      {projectToEdit && (
        <EditProjectModal
          project={projectToEdit}
          onConfirm={handleUpdateProject}
          onClose={() => setProjectToEdit(null)}
        />
      )}

      {/* Delete / Archive Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-theme-surface shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-theme-border">
              <div className="flex items-center gap-2.5 text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="font-bold text-sm text-theme-text">Delete / Archive Project</h3>
              </div>
              <button
                onClick={() => setProjectToDelete(null)}
                className="p-1 rounded-lg text-theme-muted hover:text-theme-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-theme-muted leading-relaxed">
              Are you sure you want to remove project{' '}
              <span className="font-bold text-theme-text">{projectToDelete.name} ({projectToDelete.key})</span>?
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
                onClick={() => setProjectToDelete(null)}
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
    </div>
  );
};
