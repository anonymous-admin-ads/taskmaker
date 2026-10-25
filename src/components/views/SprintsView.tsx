import React, { useState } from 'react';
import {
  Rocket, Calendar, CheckCircle2, AlertTriangle, TrendingUp,
  Clock, Play, ShieldAlert, PauseCircle, Ban, Plus
} from 'lucide-react';
import { Ticket, Project, User as UserType } from '../../types';
import { useUiControls } from '../../context/UiControlsContext';

interface SprintsViewProps {
  project: Project | null;
  tickets: Ticket[];
  users: UserType[];
  onTicketClick: (ticketId: number) => void;
  onOpenCreateTicket?: () => void;
}

export const SprintsView: React.FC<SprintsViewProps> = ({
  project,
  tickets,
  users,
  onTicketClick,
  onOpenCreateTicket,
}) => {
  const { isButtonEnabled } = useUiControls();
  const showCreateTicketBtn = isButtonEnabled('btn_create_ticket');

  const completedTickets = tickets.filter(t => t.status === 'Done');
  const inProgressTickets = tickets.filter(t => ['In Progress', 'Dev Review', 'Ready to Test', 'QA Testing'].includes(t.status));
  const holdTickets = tickets.filter(t => t.status === 'Hold Box');
  const blockedTickets = tickets.filter(t => t.status === 'Blocked Box');
  const todoTickets = tickets.filter(t => t.status === 'To Do');

  const total = tickets.length || 1;
  const completionPct = Math.round((completedTickets.length / total) * 100);

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-theme-bg">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-theme-text tracking-tight">Sprints & Agile Cycles</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-theme-surface border border-theme-border text-theme-primary font-mono font-semibold">
              {project?.key || 'TEXA'}
            </span>
          </div>
          <p className="text-xs text-theme-muted mt-0.5">
            Manage agile iterations, burndown velocity, and team commitments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {showCreateTicketBtn && onOpenCreateTicket && (
            <button
              onClick={onOpenCreateTicket}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Create Issue</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Sprint Banner Card */}
      <div className="rounded-2xl border border-theme-border bg-theme-surface p-6 space-y-5 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 font-bold text-xs border border-emerald-500/40 flex items-center gap-1.5">
                <Rocket className="w-3.5 h-3.5" />
                ACTIVE SPRINT
              </span>
              <h2 className="text-lg font-bold text-theme-text">
                Sprint 4 — Core Enterprise Packing & Hold/Blocked Routing
              </h2>
            </div>
            <p className="text-xs text-theme-muted">
              Oct 10, 2026 – Oct 24, 2026 • 14 days duration • 4 days remaining
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-2xl font-black text-theme-primary">{completionPct}%</div>
              <div className="text-[11px] text-theme-muted">Sprint Completion</div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-3 rounded-full bg-theme-border/60 overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${(completedTickets.length / total) * 100}%` }}
              title={`Done: ${completedTickets.length}`}
            />
            <div
              className="h-full bg-sky-500 transition-all duration-300"
              style={{ width: `${(inProgressTickets.length / total) * 100}%` }}
              title={`In Progress: ${inProgressTickets.length}`}
            />
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${(holdTickets.length / total) * 100}%` }}
              title={`Hold Box: ${holdTickets.length}`}
            />
            <div
              className="h-full bg-rose-500 transition-all duration-300"
              style={{ width: `${(blockedTickets.length / total) * 100}%` }}
              title={`Blocked Box: ${blockedTickets.length}`}
            />
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs font-semibold flex-wrap">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Done ({completedTickets.length})
            </span>
            <span className="flex items-center gap-1.5 text-sky-400">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              In Progress / Review ({inProgressTickets.length})
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Hold Box ({holdTickets.length})
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Blocked Box ({blockedTickets.length})
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
              To Do ({todoTickets.length})
            </span>
          </div>
        </div>
      </div>

      {/* SPRINT TICKETS BREAKDOWN */}
      <div className="rounded-2xl border border-theme-border bg-theme-surface overflow-hidden shadow-sm">
        <div className="p-4 border-b border-theme-border bg-theme-surface-hover/30 flex items-center justify-between">
          <h3 className="font-bold text-sm text-theme-text">Current Sprint Work Items</h3>
          <span className="text-xs text-theme-muted font-medium">{tickets.length} total tasks committed</span>
        </div>

        <div className="divide-y divide-theme-border/40">
          {tickets.map(t => (
            <div
              key={t.id}
              onClick={() => onTicketClick(t.id)}
              className="p-3.5 hover:bg-theme-surface-hover cursor-pointer transition flex items-center justify-between gap-4 text-xs group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono font-bold text-theme-primary shrink-0 w-20">
                  {t.key}
                </span>
                <span className="font-medium text-theme-text truncate group-hover:text-theme-primary transition">
                  {t.title}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    t.status === 'Hold Box'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : t.status === 'Blocked Box'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : t.status === 'Done'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {t.status}
                </span>
                <div
                  title={t.assignee_name || 'Unassigned'}
                  className="w-6 h-6 rounded-full bg-theme-primary/20 text-theme-primary font-bold text-[10px] flex items-center justify-center border border-theme-primary/30"
                >
                  {t.assignee_avatar || 'U'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

