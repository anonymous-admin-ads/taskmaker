import React from 'react';
import { PauseCircle, Ban, AlertCircle } from 'lucide-react';
import { Ticket } from '../../types';
import { useUiControls } from '../../context/UiControlsContext';

interface TicketCardProps {
  ticket: Ticket;
  onClick: () => void;
  onDragStart: (e: React.DragEvent, ticket: Ticket) => void;
}

export const TicketCard: React.FC<TicketCardProps> = ({
  ticket,
  onClick,
  onDragStart,
}) => {
  const { isIconEnabled } = useUiControls();
  const showHoldBadge = isIconEnabled('icon_hold_badge');
  const showBlockedBadge = isIconEnabled('icon_blocked_badge');
  const showAssigneeAvatar = isIconEnabled('icon_assignee_avatar');
  const showPriorityBadge = isIconEnabled('icon_priority_badges');
  const showDueDate = isIconEnabled('icon_due_date');

  const isHold = ticket.status === 'Hold Box';
  const isBlocked = ticket.status === 'Blocked Box';

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, ticket)}
      onClick={onClick}
      className={`p-3 rounded-xl border cursor-pointer select-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-98 ${
        isHold && showHoldBadge
          ? 'bg-amber-950/20 border-amber-500/50 hover:border-amber-400 shadow-amber-500/5'
          : isBlocked && showBlockedBadge
          ? 'bg-rose-950/20 border-rose-500/60 hover:border-rose-400 shadow-rose-500/5'
          : 'bg-theme-surface border-theme-border hover:border-theme-primary/50'
      }`}
    >
      {/* HOLD BOX INDICATOR BANNER */}
      {isHold && showHoldBadge && (
        <div className="mb-2 p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-start gap-1.5 text-[11px] text-amber-200">
          <PauseCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="font-bold text-amber-300 block text-[10px] uppercase tracking-wider">ON HOLD</span>
            <span className="truncate block font-medium opacity-90">{ticket.hold_reason || 'Temporary Hold'}</span>
            {ticket.hold_release_date && (
              <span className="text-[10px] text-amber-300/80 block mt-0.5">Exp. Release: {ticket.hold_release_date}</span>
            )}
          </div>
        </div>
      )}

      {/* BLOCKED BOX INDICATOR BANNER */}
      {isBlocked && showBlockedBadge && (
        <div className="mb-2 p-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-start gap-1.5 text-[11px] text-rose-200">
          <Ban className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-rose-300 text-[10px] uppercase tracking-wider">BLOCKED</span>
              {ticket.blocker_severity && (
                <span className="text-[9px] px-1 rounded bg-rose-500/40 font-bold uppercase">{ticket.blocker_severity}</span>
              )}
            </div>
            <span className="truncate block font-medium opacity-90">{ticket.blocker_description || 'Active Blocker'}</span>
            {ticket.blocker_responsible && (
              <span className="text-[10px] text-rose-300/80 block mt-0.5">Resp: {ticket.blocker_responsible}</span>
            )}
          </div>
        </div>
      )}

      {/* Ticket Key & Type */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="font-mono text-xs font-bold text-theme-primary tracking-tight">
          {ticket.key}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-800 text-slate-300 border border-slate-700">
          {ticket.type}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-xs font-semibold text-theme-text line-clamp-2 leading-relaxed mb-3">
        {ticket.title}
      </h4>

      {/* Card Footer: Priority, Due Date, Assignee Avatar */}
      <div className="flex items-center justify-between text-xs pt-1 border-t border-theme-border/50">
        <div className="flex items-center gap-2">
          {/* Priority Badge */}
          {showPriorityBadge && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                ticket.priority === 'Critical'
                  ? 'bg-rose-500/20 text-rose-400'
                  : ticket.priority === 'High'
                  ? 'bg-amber-500/20 text-amber-400'
                  : ticket.priority === 'Medium'
                  ? 'bg-sky-500/20 text-sky-400'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              {ticket.priority}
            </span>
          )}
        </div>

        {/* Assignee Avatar */}
        {showAssigneeAvatar && (
          <div
            title={ticket.assignee_name || 'Unassigned'}
            className="w-5 h-5 rounded-full bg-theme-primary/20 text-theme-primary font-bold text-[9px] flex items-center justify-center border border-theme-primary/30 shrink-0"
          >
            {ticket.assignee_avatar || (ticket.assignee_name ? ticket.assignee_name[0] : 'U')}
          </div>
        )}
      </div>
    </div>
  );
};

