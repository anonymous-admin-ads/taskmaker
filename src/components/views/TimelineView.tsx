import React, { useState } from 'react';
import {
  Calendar as CalendarIcon, Clock, Filter, ChevronLeft, ChevronRight,
  PauseCircle, Ban, CheckCircle2, PlayCircle, Plus
} from 'lucide-react';
import { Ticket, Project, User as UserType } from '../../types';
import { useUiControls } from '../../context/UiControlsContext';

interface TimelineViewProps {
  project: Project | null;
  tickets: Ticket[];
  users: UserType[];
  onTicketClick: (ticketId: number) => void;
  onOpenCreateTicket?: () => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  project,
  tickets,
  users,
  onTicketClick,
  onOpenCreateTicket,
}) => {
  const { isButtonEnabled } = useUiControls();
  const showCreateTicketBtn = isButtonEnabled('btn_create_ticket');
  const showFilterControls = isButtonEnabled('btn_filter_controls');

  const [zoom, setZoom] = useState<'weeks' | 'months'>('weeks');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  const filteredTickets = tickets.filter(t => {
    if (filterStatus !== 'All' && t.status !== filterStatus) return false;
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Hold Box':
        return 'bg-amber-500 border-amber-400 text-slate-950';
      case 'Blocked Box':
        return 'bg-rose-500 border-rose-400 text-white';
      case 'Done':
        return 'bg-emerald-500 border-emerald-400 text-slate-950';
      case 'In Progress':
        return 'bg-sky-500 border-sky-400 text-white';
      case 'Dev Review':
      case 'QA Review':
        return 'bg-indigo-500 border-indigo-400 text-white';
      default:
        return 'bg-slate-600 border-slate-500 text-white';
    }
  };

  // 4 Weeks representation for the current sprint / month
  const weeks = [
    { label: 'Week 41 (Oct 5 - Oct 11)', days: 7 },
    { label: 'Week 42 (Oct 12 - Oct 18)', days: 7 },
    { label: 'Week 43 (Oct 19 - Oct 25)', days: 7 },
    { label: 'Week 44 (Oct 26 - Nov 1)', days: 7 },
  ];

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-theme-bg">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-theme-text tracking-tight">Timeline & Roadmap</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-theme-surface border border-theme-border text-theme-primary font-mono font-semibold">
              {project?.key || 'TEXA'}
            </span>
          </div>
          <p className="text-xs text-theme-muted mt-0.5">
            Visualize project schedule, milestones and delivery targets over time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {showCreateTicketBtn && onOpenCreateTicket && (
            <button
              onClick={onOpenCreateTicket}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Create Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Controls Bar */}
      {showFilterControls && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-theme-surface p-1 rounded-xl border border-theme-border">
              {['All', 'In Progress', 'Hold Box', 'Blocked Box', 'Done'].map(st => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    filterStatus === st
                      ? 'bg-theme-primary text-theme-primary-text shadow-sm'
                      : 'text-theme-muted hover:text-theme-text'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-theme-muted font-medium">October 2026 - Q4 Sprint</span>
          </div>
        </div>
      )}

      {/* Gantt Timeline Container */}
      <div className="rounded-2xl border border-theme-border bg-theme-surface overflow-hidden shadow-sm">
        {/* Timeline Header Row */}
        <div className="grid grid-cols-12 border-b border-theme-border bg-theme-surface-hover/50 text-xs font-bold text-theme-muted uppercase tracking-wider">
          <div className="col-span-4 p-3.5 border-r border-theme-border">
            Work Item / Key
          </div>
          <div className="col-span-8 grid grid-cols-4 divide-x divide-theme-border text-center">
            {weeks.map((w, idx) => (
              <div key={idx} className="p-3.5">
                {w.label}
              </div>
            ))}
          </div>
        </div>

        {/* Tickets Gantt Rows */}
        <div className="divide-y divide-theme-border/40">
          {filteredTickets.map((t, idx) => {
            // Assign a visual offset/width based on ticket id for realistic roadmap representation
            const startCol = (idx % 3) + 1; // 1, 2, or 3
            const span = ((idx + 1) % 2) + 2; // 2 or 3

            return (
              <div
                key={t.id}
                onClick={() => onTicketClick(t.id)}
                className="grid grid-cols-12 hover:bg-theme-surface-hover/50 cursor-pointer transition items-center"
              >
                {/* Left: Work Item Meta */}
                <div className="col-span-4 p-3 border-r border-theme-border flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-xs font-bold text-theme-primary shrink-0">
                    {t.key}
                  </span>
                  <span className="text-xs font-semibold text-theme-text truncate">
                    {t.title}
                  </span>
                </div>

                {/* Right: Gantt Bar */}
                <div className="col-span-8 p-3 relative h-12 flex items-center">
                  <div
                    className={`h-7 rounded-lg px-3 py-1 flex items-center justify-between text-[11px] font-bold shadow-md border ${getStatusColor(
                      t.status
                    )}`}
                    style={{
                      marginLeft: `${(startCol - 1) * 25}%`,
                      width: `${span * 25}%`,
                    }}
                  >
                    <span className="truncate">{t.status}</span>
                    <span className="text-[10px] opacity-80 shrink-0 ml-1">
                      {t.due_date ? t.due_date.substring(5) : 'Target'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

