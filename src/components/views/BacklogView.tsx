import React, { useState } from 'react';
import {
  Layers, Plus, Search, ChevronDown, ChevronRight, Play, CheckCircle2,
  Calendar, User, AlertCircle, ArrowUpRight, Flame, Sparkles
} from 'lucide-react';
import { Ticket, Project, User as UserType } from '../../types';
import { useUiControls } from '../../context/UiControlsContext';
import { DevAuthorityControl } from '../common/DevAuthorityControl';

interface BacklogViewProps {
  project: Project | null;
  tickets: Ticket[];
  users: UserType[];
  onTicketClick: (ticketId: number) => void;
  onOpenCreateTicket: () => void;
}

export const BacklogView: React.FC<BacklogViewProps> = ({
  project,
  tickets,
  users,
  onTicketClick,
  onOpenCreateTicket,
}) => {
  const { isButtonEnabled, isIconEnabled } = useUiControls();
  const showCreateTicketBtn = isButtonEnabled('btn_create_ticket');
  const showFilterControls = isButtonEnabled('btn_filter_controls');
  const showPriorityBadge = isIconEnabled('icon_priority_badges');
  const showAssigneeAvatar = isIconEnabled('icon_assignee_avatar');
  const showHoldBadge = isIconEnabled('icon_hold_badge');
  const showBlockedBadge = isIconEnabled('icon_blocked_badge');

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [sprintOpen, setSprintOpen] = useState(true);
  const [backlogOpen, setBacklogOpen] = useState(true);

  // Divide tickets into Active Sprint (in progress, review, QA, hold, blocked) vs Backlog (To Do / Backlog)
  const sprintTickets = tickets.filter(t => t.status !== 'To Do');
  const backlogTickets = tickets.filter(t => t.status === 'To Do');

  const filterList = (list: Ticket[]) => {
    return list.filter(t => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.key.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (typeFilter !== 'All' && t.type !== typeFilter) {
        return false;
      }
      return true;
    });
  };

  const filteredSprint = filterList(sprintTickets);
  const filteredBacklog = filterList(backlogTickets);

  const getPriorityBadge = (p: string) => {
    if (!showPriorityBadge) return null;
    const colors: Record<string, string> = {
      Critical: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      High: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      Medium: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
      Low: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
    };
    return (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${colors[p] || colors.Medium}`}>
        {p}
      </span>
    );
  };

  const getStatusBadge = (s: string) => {
    if (s === 'Hold Box' && !showHoldBadge) return null;
    if (s === 'Blocked Box' && !showBlockedBadge) return null;
    if (s === 'Hold Box') return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">Hold Box</span>;
    if (s === 'Blocked Box') return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">Blocked Box</span>;
    if (s === 'Done') return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">Done</span>;
    return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">{s}</span>;
  };

  if (!project) {
    return (
      <div className="flex-1 p-12 flex flex-col items-center justify-center text-center space-y-4 bg-theme-bg">
        <div className="w-16 h-16 rounded-2xl bg-theme-surface border border-theme-border flex items-center justify-center text-theme-muted shadow-sm">
          <Layers className="w-8 h-8 text-theme-primary" />
        </div>
        <div className="max-w-md">
          <h2 className="text-lg font-bold text-theme-text">No Project Active</h2>
          <p className="text-xs text-theme-muted mt-1 leading-relaxed">
            All demo projects have been cleaned up. Create or select a project to view and manage your product backlog and active sprints.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-theme-bg">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-theme-text tracking-tight">Backlog</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-theme-surface border border-theme-border text-theme-primary font-mono font-semibold">
              {project?.key || 'TEXA'}
            </span>
          </div>
          <p className="text-xs text-theme-muted mt-0.5">
            Plan sprints, groom work items and prioritize product deliverables.
          </p>
        </div>

        <DevAuthorityControl elementId="btn_backlog_create_issue" name="+ Create Issue Button" location="Backlog View" inline>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCreateTicket}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Create Issue</span>
            </button>
          </div>
        </DevAuthorityControl>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <DevAuthorityControl elementId="backlog_search" name="Backlog Search Field" location="Backlog View" inline>
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
              <input
                type="text"
                placeholder="Search backlog..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-theme-surface border border-theme-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-theme-text placeholder:text-theme-muted focus:outline-none focus:border-theme-primary transition"
              />
            </div>
          </DevAuthorityControl>

          <DevAuthorityControl elementId="backlog_type_filter" name="Backlog Type Filter Pills" location="Backlog View" inline>
            <div className="flex items-center gap-1 bg-theme-surface p-1 rounded-xl border border-theme-border">
              {['All', 'Task', 'Bug', 'Feature', 'Story'].map(type => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    typeFilter === type
                      ? 'bg-theme-primary text-theme-primary-text shadow-sm'
                      : 'text-theme-muted hover:text-theme-text'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </DevAuthorityControl>
        </div>

        <div className="text-xs text-theme-muted font-medium">
          Total: <span className="text-theme-text font-bold">{tickets.length}</span> issues
        </div>
      </div>

      {/* SECTION 1: ACTIVE SPRINT */}
      <DevAuthorityControl elementId="backlog_active_sprint_section" name="Active Sprint Section" location="Backlog View" block>
        <div className="rounded-2xl border border-theme-border bg-theme-surface overflow-hidden shadow-sm">
          <div className="p-4 border-b border-theme-border/60 bg-theme-surface-hover/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSprintOpen(!sprintOpen)}
                className="p-1 rounded text-theme-muted hover:text-theme-text transition cursor-pointer"
              >
                {sprintOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-theme-text">Active Sprint: 2026-Q4 Release Sprint</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-emerald-400" /> ACTIVE
                  </span>
                </div>
                <p className="text-[11px] text-theme-muted mt-0.5">
                  Goal: Complete Packing & QA gates for ERP core services • 14 days remaining
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs text-theme-muted">
                <span className="font-bold text-theme-text">{filteredSprint.length}</span> issues
              </div>
            </div>
          </div>

          {sprintOpen && (
            <div className="divide-y divide-theme-border/40">
              {filteredSprint.length === 0 ? (
                <div className="p-8 text-center text-xs text-theme-muted">
                  No tickets in current sprint matching criteria
                </div>
              ) : (
                filteredSprint.map(ticket => (
                  <div
                    key={ticket.id}
                    onClick={() => onTicketClick(ticket.id)}
                    className="p-3.5 hover:bg-theme-surface-hover cursor-pointer transition flex items-center justify-between gap-4 text-xs group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono font-bold text-theme-primary shrink-0 w-20">
                        {ticket.key}
                      </span>
                      <span className="font-medium text-theme-text truncate group-hover:text-theme-primary transition">
                        {ticket.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                      {showAssigneeAvatar && (
                        <div
                          title={ticket.assignee_name || 'Unassigned'}
                          className="w-6 h-6 rounded-full bg-theme-primary/20 text-theme-primary font-bold text-[10px] flex items-center justify-center border border-theme-primary/30"
                        >
                          {ticket.assignee_avatar || 'U'}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </DevAuthorityControl>

      {/* SECTION 2: PRODUCT BACKLOG */}
      <DevAuthorityControl elementId="backlog_product_backlog_section" name="Product Backlog Section" location="Backlog View" block>
        <div className="rounded-2xl border border-theme-border bg-theme-surface overflow-hidden shadow-sm">
          <div className="p-4 border-b border-theme-border/60 bg-theme-surface-hover/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setBacklogOpen(!backlogOpen)}
                className="p-1 rounded text-theme-muted hover:text-theme-text transition cursor-pointer"
              >
                {backlogOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              <div>
                <span className="font-bold text-sm text-theme-text">Product Backlog</span>
                <p className="text-[11px] text-theme-muted mt-0.5">
                  Future work items, unassigned tickets, and incoming feature requests
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-theme-muted">
                <span className="font-bold text-theme-text">{filteredBacklog.length}</span> issues
              </span>
            </div>
          </div>

          {backlogOpen && (
            <div className="divide-y divide-theme-border/40">
              {filteredBacklog.length === 0 ? (
                <div className="p-8 text-center text-xs text-theme-muted">
                  No items in backlog. Click "+ Create Issue" to add new tasks.
                </div>
              ) : (
                filteredBacklog.map(ticket => (
                  <div
                    key={ticket.id}
                    onClick={() => onTicketClick(ticket.id)}
                    className="p-3.5 hover:bg-theme-surface-hover cursor-pointer transition flex items-center justify-between gap-4 text-xs group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono font-bold text-theme-primary shrink-0 w-20">
                        {ticket.key}
                      </span>
                      <span className="font-medium text-theme-text truncate group-hover:text-theme-primary transition">
                        {ticket.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                      {showAssigneeAvatar && (
                        <div
                          title={ticket.assignee_name || 'Unassigned'}
                          className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-bold text-[10px] flex items-center justify-center border border-slate-700"
                        >
                          {ticket.assignee_avatar || 'U'}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </DevAuthorityControl>
    </div>
  );
};

