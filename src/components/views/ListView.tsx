import React, { useState, useMemo } from 'react';
import { Search, Filter, Plus, PauseCircle, Ban, Calendar } from 'lucide-react';
import { Ticket, User, Project } from '../../types';
import { useUiControls } from '../../context/UiControlsContext';

interface ListViewProps {
  tickets: Ticket[];
  projects: Project[];
  users: User[];
  onTicketClick: (ticketId: number) => void;
  onOpenCreateTicket: () => void;
}

export const ListView: React.FC<ListViewProps> = ({
  tickets,
  projects,
  users,
  onTicketClick,
  onOpenCreateTicket,
}) => {
  const { isButtonEnabled, isIconEnabled } = useUiControls();
  const showCreateTicketBtn = isButtonEnabled('btn_create_ticket');
  const showFilterControls = isButtonEnabled('btn_filter_controls');
  const showPriorityBadge = isIconEnabled('icon_priority_badges');
  const showAssigneeAvatar = isIconEnabled('icon_assignee_avatar');
  const showDueDate = isIconEnabled('icon_due_date');

  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  const filtered = useMemo(() => {
    return tickets.filter(t => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.key.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (projectFilter !== 'All' && String(t.project_id) !== projectFilter) return false;
      if (typeFilter !== 'All' && t.type !== typeFilter) return false;
      if (statusFilter !== 'All' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [tickets, search, projectFilter, typeFilter, statusFilter, priorityFilter]);

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-5 bg-theme-bg">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-theme-text tracking-tight">Issues & Work Items</h1>
          <p className="text-xs text-theme-muted mt-0.5">View, filter and manage all enterprise tickets.</p>
        </div>

        {showCreateTicketBtn && (
          <button
            onClick={onOpenCreateTicket}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-theme-primary text-slate-950 font-semibold text-xs shadow-md shadow-theme-primary/20 hover:brightness-110 transition active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Ticket</span>
          </button>
        )}
      </div>

      {/* Filter Bar (Matching screenshot) */}
      {showFilterControls && (
        <div className="flex items-center justify-between gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative w-52">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-muted" />
              <input
                type="text"
                placeholder="Search issues..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-theme-surface border border-theme-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
              />
            </div>

            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              className="bg-theme-surface border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
            >
              <option value="All">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="bg-theme-surface border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
            >
              <option value="All">All Types</option>
              <option value="Task">Task</option>
              <option value="Bug">Bug</option>
              <option value="Story">Story</option>
              <option value="Epic">Epic</option>
              <option value="New Feature">New Feature</option>
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-theme-surface border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
            >
              <option value="All">All States</option>
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="Dev Review">Dev Review</option>
              <option value="Ready to Test">Ready to Test</option>
              <option value="Hold Box">Hold Box</option>
              <option value="Pending QA">Pending QA</option>
              <option value="QA Testing">QA Testing</option>
              <option value="QA Review">QA Review</option>
              <option value="Done">Done</option>
              <option value="Blocked Box">Blocked Box</option>
            </select>

            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="bg-theme-surface border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
            >
              <option value="All">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div className="text-[11px] text-theme-muted font-mono">
            Showing {filtered.length} issues
          </div>
        </div>
      )}

      {/* Issues Table (Matching screenshot list view) */}
      <div className="rounded-2xl border border-theme-border bg-theme-surface overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-theme-border bg-theme-surface-hover/50 text-theme-muted text-[11px] uppercase tracking-wider font-semibold">
              <th className="py-3 px-4">Key</th>
              <th className="py-3 px-4">Title</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Priority</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Assignee</th>
              <th className="py-3 px-4 text-right">Due Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border/50">
            {filtered.map(t => (
              <tr
                key={t.id}
                onClick={() => onTicketClick(t.id)}
                className="hover:bg-theme-surface-hover cursor-pointer transition"
              >
                <td className="py-3 px-4 font-mono font-bold text-theme-primary">{t.key}</td>
                <td className="py-3 px-4 font-medium text-theme-text max-w-sm truncate">{t.title}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium text-[10px]">
                    {t.type}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {showPriorityBadge ? (
                    <span
                      className={`font-bold text-[10px] ${
                        t.priority === 'Critical'
                          ? 'text-rose-400'
                          : t.priority === 'High'
                          ? 'text-amber-400'
                          : 'text-sky-400'
                      }`}
                    >
                      {t.priority}
                    </span>
                  ) : (
                    <span className="text-theme-muted text-[10px]">—</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      t.status === 'Hold Box'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : t.status === 'Blocked Box'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : t.status === 'In Progress'
                        ? 'bg-sky-500/20 text-sky-300'
                        : t.status === 'Done'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {t.status}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5 text-theme-text">
                    {showAssigneeAvatar && (
                      <div className="w-5 h-5 rounded-full bg-theme-primary/20 text-theme-primary font-bold text-[9px] flex items-center justify-center">
                        {t.assignee_avatar || (t.assignee_name ? t.assignee_name[0] : 'U')}
                      </div>
                    )}
                    <span>{t.assignee_name || 'Unassigned'}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-right text-theme-muted font-medium">
                  {showDueDate ? (t.due_date || '—') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

