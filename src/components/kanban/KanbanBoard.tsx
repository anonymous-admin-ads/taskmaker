import React, { useState, useMemo } from 'react';
import {
  Filter, Plus, Search, RotateCcw, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { Ticket, WorkflowStatus, Project, User } from '../../types';
import { KanbanColumn } from './KanbanColumn';
import { HoldBoxModal } from '../modals/HoldBoxModal';
import { BlockedBoxModal } from '../modals/BlockedBoxModal';
import { ReleaseHoldModal } from '../modals/ReleaseHoldModal';
import { ResolveBlockerModal } from '../modals/ResolveBlockerModal';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useUiControls } from '../../context/UiControlsContext';
import { DevAuthorityControl } from '../common/DevAuthorityControl';
import { api } from '../../api/client';

interface KanbanBoardProps {
  project: Project | null;
  tickets: Ticket[];
  users: User[];
  onTicketClick: (ticket: Ticket) => void;
  onOpenCreateTicket: () => void;
  onOpenCreateProject?: () => void;
  onRefreshTickets: () => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  project,
  tickets,
  users,
  onTicketClick,
  onOpenCreateTicket,
  onOpenCreateProject,
  onRefreshTickets,
}) => {
  const { success, error } = useToast();
  const { user } = useAuth();
  const { isIconEnabled, isButtonEnabled } = useUiControls();

  const isDevSession = Boolean(
    user && (user.isDevConsole || user.portalMode === 'developer_console' || user.sessionType === 'developer_console' || user.role === 'developer_console_admin')
  );

  // Developer Console UI Authority Controls
  const showHoldBox = isIconEnabled('icon_hold_badge');
  const showBlockedBox = isIconEnabled('icon_blocked_badge');
  const showAddProjectBtn = isButtonEnabled('btn_create_project');
  const showCreateTicketBtn = isButtonEnabled('btn_create_ticket');
  const showFilterControls = isButtonEnabled('btn_filter_controls');

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedPriority, setSelectedPriority] = useState('All');
  const [selectedAssignee, setSelectedAssignee] = useState('All');

  // Drag & drop state
  const [draggedTicket, setDraggedTicket] = useState<Ticket | null>(null);

  // Intercepting Modals state
  const [holdTargetTicket, setHoldTargetTicket] = useState<Ticket | null>(null);
  const [blockedTargetTicket, setBlockedTargetTicket] = useState<Ticket | null>(null);
  const [releaseTargetTicket, setReleaseTargetTicket] = useState<Ticket | null>(null);
  const [resolveTargetTicket, setResolveTargetTicket] = useState<Ticket | null>(null);

  // Workflow sequence matching the master prompt with Developer Console Authority toggles
  const allColumns: WorkflowStatus[] = [
    'To Do',
    'In Progress',
    'Dev Review',
    'Ready to Test',
    'Hold Box',
    'Pending QA',
    'QA Testing',
    'QA Review',
    'Done',
    'Blocked Box',
  ];

  // For normal users: only display enabled columns!
  // For developer console: display all columns so developer can view and manage them in place.
  const columns = useMemo(() => {
    return allColumns.filter(status => {
      const colId = 'col_' + status.toLowerCase().replace(/\s+/g, '_');
      const isColEnabled = isButtonEnabled(colId);
      if (status === 'Hold Box' && !isIconEnabled('icon_hold_badge')) return isDevSession;
      if (status === 'Blocked Box' && !isIconEnabled('icon_blocked_badge')) return isDevSession;
      return isColEnabled || isDevSession;
    });
  }, [allColumns, isButtonEnabled, isIconEnabled, isDevSession]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.key.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (selectedType !== 'All' && t.type !== selectedType) return false;
      if (selectedPriority !== 'All' && t.priority !== selectedPriority) return false;
      if (selectedAssignee !== 'All' && String(t.assignee_id) !== selectedAssignee) return false;
      return true;
    });
  }, [tickets, search, selectedType, selectedPriority, selectedAssignee]);

  const handleDragStart = (e: React.DragEvent, ticket: Ticket) => {
    setDraggedTicket(ticket);
    e.dataTransfer.setData('text/plain', String(ticket.id));
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: WorkflowStatus) => {
    if (!draggedTicket) return;
    const ticket = draggedTicket;
    setDraggedTicket(null);

    if (ticket.status === targetStatus) return;

    // 1. Moving to Hold Box requires Hold Modal
    if (targetStatus === 'Hold Box') {
      setHoldTargetTicket(ticket);
      return;
    }

    // 2. Moving to Blocked Box requires Blocked Modal
    if (targetStatus === 'Blocked Box') {
      setBlockedTargetTicket(ticket);
      return;
    }

    // 3. Moving out of Hold Box requires Release Modal
    if (ticket.status === 'Hold Box') {
      setReleaseTargetTicket(ticket);
      return;
    }

    // 4. Moving out of Blocked Box requires Resolve Modal
    if (ticket.status === 'Blocked Box') {
      setResolveTargetTicket(ticket);
      return;
    }

    // 5. Standard transition
    try {
      await api.transitionTicket(ticket.id, {
        targetStatus,
        expectedVersion: ticket.version,
      });
      success('Status Updated', `${ticket.key} moved to ${targetStatus}`);
      onRefreshTickets();
    } catch (err: any) {
      error('Transition Rejected', err.message);
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setSelectedType('All');
    setSelectedPriority('All');
    setSelectedAssignee('All');
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-theme-bg overflow-hidden">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="px-6 py-3 border-b border-theme-border flex items-center justify-between shrink-0 bg-theme-surface/40 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="text-xs text-theme-muted flex items-center gap-1.5">
            <span>Projects</span>
            <span>/</span>
            <span className="text-theme-text font-semibold">{project?.name || 'All Projects'}</span>
            <span>/</span>
            <span className="text-theme-primary font-bold">Board</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenCreateProject && (
            <DevAuthorityControl elementId="btn_create_project" name="+ Project Button" inline>
              <button
                onClick={onOpenCreateProject}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-surface border border-theme-border hover:border-theme-primary text-theme-text font-semibold text-xs transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5] text-theme-primary" />
                <span>+ Project</span>
              </button>
            </DevAuthorityControl>
          )}

          <DevAuthorityControl elementId="btn_create_ticket" name="Add Ticket Button" inline>
            <button
              onClick={onOpenCreateTicket}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-primary hover:bg-theme-primary-hover text-slate-950 font-semibold text-xs shadow-md shadow-theme-primary/20 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Ticket</span>
            </button>
          </DevAuthorityControl>
        </div>
      </div>

      {/* Filter Toolbar (Controlled by Developer Console UI element control) */}
      <DevAuthorityControl elementId="btn_filter_controls" name="Board Filter Bar" block className="w-full border-b border-theme-border">
        <div className="px-6 py-2.5 flex items-center justify-between gap-3 shrink-0 flex-wrap text-xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search Box */}
            {/* Search Box */}
            <DevAuthorityControl elementId="board_search" name="Board Search Bar" location="Kanban Board" inline>
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-muted" />
                <input
                  type="text"
                  placeholder="Search board..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-border rounded-lg pl-8 pr-3 py-1 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
                />
              </div>
            </DevAuthorityControl>

            {/* Type Filter */}
            <DevAuthorityControl elementId="board_type_filter" name="Board Type Filter" location="Kanban Board" inline>
              <select
                value={selectedType}
                onChange={e => setSelectedType(e.target.value)}
                className="bg-theme-bg border border-theme-border rounded-lg px-2.5 py-1 text-xs text-theme-text focus:outline-none focus:border-theme-primary cursor-pointer"
              >
                <option value="All">All Types</option>
                <option value="Task">Task</option>
                <option value="Bug">Bug</option>
                <option value="Story">Story</option>
                <option value="Epic">Epic</option>
                <option value="New Feature">New Feature</option>
              </select>
            </DevAuthorityControl>

            {/* Priority Filter */}
            <DevAuthorityControl elementId="board_priority_filter" name="Board Priority Filter" location="Kanban Board" inline>
              <select
                value={selectedPriority}
                onChange={e => setSelectedPriority(e.target.value)}
                className="bg-theme-bg border border-theme-border rounded-lg px-2.5 py-1 text-xs text-theme-text focus:outline-none focus:border-theme-primary cursor-pointer"
              >
                <option value="All">All Priorities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </DevAuthorityControl>

            {/* Assignee Filter */}
            <DevAuthorityControl elementId="board_assignee_filter" name="Board Assignee Filter" location="Kanban Board" inline>
              <select
                value={selectedAssignee}
                onChange={e => setSelectedAssignee(e.target.value)}
                className="bg-theme-bg border border-theme-border rounded-lg px-2.5 py-1 text-xs text-theme-text focus:outline-none focus:border-theme-primary cursor-pointer"
              >
                <option value="All">All Assignees</option>
                {users.map(u => (
                  <option key={u.id} value={String(u.id)}>{u.name}</option>
                ))}
              </select>
            </DevAuthorityControl>

            {(search || selectedType !== 'All' || selectedPriority !== 'All' || selectedAssignee !== 'All') && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1 text-[11px] text-theme-muted hover:text-theme-primary underline pl-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div className="text-[11px] text-theme-muted font-mono">
            Showing {filteredTickets.length} of {tickets.length} tickets
          </div>
        </div>
      </DevAuthorityControl>

      {/* Horizontally Scrollable Kanban Columns */}
      <div className="flex-1 p-6 overflow-x-auto overflow-y-hidden">
        {!project ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-theme-surface border border-theme-border flex items-center justify-center text-theme-muted shadow-sm">
              <Plus className="w-7 h-7 text-theme-primary" />
            </div>
            <div className="max-w-md">
              <h3 className="font-bold text-base text-theme-text">No Project Active</h3>
              <p className="text-xs text-theme-muted mt-1 leading-relaxed">
                All demo projects and demo tasks have been removed. Create a new workspace project to start building your Kanban board and tracking agile issues.
              </p>
            </div>
            {onOpenCreateProject && (
              <button
                onClick={onOpenCreateProject}
                className="px-5 py-2.5 rounded-xl bg-theme-primary text-slate-950 font-bold text-xs shadow-lg shadow-theme-primary/20 hover:brightness-110 active:scale-95 transition cursor-pointer"
              >
                + Create First Project
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-4 pb-4 h-full">
            {columns.map(status => {
              const columnTickets = filteredTickets.filter(t => t.status === status);
              return (
                <KanbanColumn
                  key={status}
                  status={status}
                  tickets={columnTickets}
                  onTicketClick={onTicketClick}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onAddTicket={showCreateTicketBtn ? onOpenCreateTicket : undefined}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Intercepting Modals */}
      {holdTargetTicket && (
        <HoldBoxModal
          ticket={holdTargetTicket}
          users={users}
          onConfirm={async data => {
            await api.transitionTicket(holdTargetTicket.id, {
              targetStatus: 'Hold Box',
              holdData: data,
              expectedVersion: holdTargetTicket.version,
            });
            success('Moved to Hold Box', `${holdTargetTicket.key} placed on hold`);
            setHoldTargetTicket(null);
            onRefreshTickets();
          }}
          onClose={() => setHoldTargetTicket(null)}
        />
      )}

      {blockedTargetTicket && (
        <BlockedBoxModal
          ticket={blockedTargetTicket}
          projectTickets={tickets}
          onConfirm={async data => {
            await api.transitionTicket(blockedTargetTicket.id, {
              targetStatus: 'Blocked Box',
              blockedData: data,
              expectedVersion: blockedTargetTicket.version,
            });
            success('Moved to Blocked Box', `Blocker recorded on ${blockedTargetTicket.key}`);
            setBlockedTargetTicket(null);
            onRefreshTickets();
          }}
          onClose={() => setBlockedTargetTicket(null)}
        />
      )}

      {releaseTargetTicket && (
        <ReleaseHoldModal
          ticket={releaseTargetTicket}
          onConfirm={async (targetStatus, releaseNotes) => {
            await api.transitionTicket(releaseTargetTicket.id, {
              targetStatus,
              releaseData: { release_notes: releaseNotes },
              expectedVersion: releaseTargetTicket.version,
            });
            success('Hold Released', `${releaseTargetTicket.key} moved to ${targetStatus}`);
            setReleaseTargetTicket(null);
            onRefreshTickets();
          }}
          onClose={() => setReleaseTargetTicket(null)}
        />
      )}

      {resolveTargetTicket && (
        <ResolveBlockerModal
          ticket={resolveTargetTicket}
          onConfirm={async (targetStatus, resolutionNotes) => {
            await api.transitionTicket(resolveTargetTicket.id, {
              targetStatus,
              releaseData: { resolution_notes: resolutionNotes },
              expectedVersion: resolveTargetTicket.version,
            });
            success('Blocker Resolved', `${resolveTargetTicket.key} resumed to ${targetStatus}`);
            setResolveTargetTicket(null);
            onRefreshTickets();
          }}
          onClose={() => setResolveTargetTicket(null)}
        />
      )}
    </div>
  );
};

