import React, { useState } from 'react';
import { Plus, PauseCircle, Ban } from 'lucide-react';
import { Ticket, WorkflowStatus } from '../../types';
import { TicketCard } from './TicketCard';
import { useAuth } from '../../context/AuthContext';
import { useUiControls } from '../../context/UiControlsContext';
import { DevAuthorityControl } from '../common/DevAuthorityControl';

interface KanbanColumnProps {
  status: WorkflowStatus;
  tickets: Ticket[];
  onTicketClick: (ticket: Ticket) => void;
  onDragStart: (e: React.DragEvent, ticket: Ticket) => void;
  onDrop: (e: React.DragEvent, status: WorkflowStatus) => void;
  onAddTicket?: (status: WorkflowStatus) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status,
  tickets,
  onTicketClick,
  onDragStart,
  onDrop,
  onAddTicket,
}) => {
  const [isOver, setIsOver] = useState(false);
  const { user } = useAuth();
  const { isIconEnabled, isButtonEnabled } = useUiControls();

  const isDevSession = Boolean(
    user && (user.isDevConsole || user.portalMode === 'developer_console' || user.sessionType === 'developer_console' || user.role === 'developer_console_admin')
  );

  const colElementId = 'col_' + status.toLowerCase().replace(/\s+/g, '_');
  const isColEnabled = isButtonEnabled(colElementId);
  const showHoldBox = isIconEnabled('icon_hold_badge');
  const showBlockedBox = isIconEnabled('icon_blocked_badge');

  const isHold = status === 'Hold Box';
  const isBlocked = status === 'Blocked Box';
  const isColumnDisabled = !isColEnabled || (isHold && !showHoldBox) || (isBlocked && !showBlockedBox);

  const handleDragOver = (e: React.DragEvent) => {
    if (isColumnDisabled) return;
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (isColumnDisabled) return;
    e.preventDefault();
    setIsOver(false);
    onDrop(e, status);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-dev-id={colElementId}
      data-dev-name={`Kanban Column: ${status}`}
      data-dev-location="Kanban Board"
      className={`w-72 shrink-0 rounded-2xl flex flex-col max-h-[calc(100vh-140px)] transition-colors border ${
        isColumnDisabled
          ? 'bg-amber-950/10 border-amber-500/40 opacity-80'
          : isHold
          ? 'bg-amber-950/10 border-amber-500/30'
          : isBlocked
          ? 'bg-rose-950/10 border-rose-500/30'
          : 'bg-theme-surface/50 border-theme-border/60'
      } ${isOver ? 'ring-2 ring-theme-primary bg-theme-primary/5' : ''}`}
    >
      {/* Column Header */}
      <div className="p-3 border-b border-theme-border/60 flex items-center justify-between gap-1 flex-wrap">
        <DevAuthorityControl elementId={colElementId} name={`Column: ${status}`} location="Kanban Board" inline>
          <div className="flex items-center gap-1.5 flex-wrap">
            {isHold ? (
              <div className="flex items-center gap-1.5">
                <PauseCircle className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-xs tracking-tight text-amber-400 font-bold">
                  {status}
                </h3>
              </div>
            ) : isBlocked ? (
              <div className="flex items-center gap-1.5">
                <Ban className="w-4 h-4 text-rose-400" />
                <h3 className="font-semibold text-xs tracking-tight text-rose-400 font-bold">
                  {status}
                </h3>
              </div>
            ) : (
              <h3 className="font-semibold text-xs tracking-tight text-theme-text font-bold">
                {status}
              </h3>
            )}

            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isHold
                  ? 'bg-amber-500/20 text-amber-300'
                  : isBlocked
                  ? 'bg-rose-500/20 text-rose-300'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {tickets.length}
            </span>

            {isColumnDisabled && isDevSession && (
              <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 uppercase tracking-wider">
                DEV ONLY
              </span>
            )}
          </div>
        </DevAuthorityControl>

        {onAddTicket && !isColumnDisabled && (
          <DevAuthorityControl elementId={`btn_col_add_${status.toLowerCase().replace(/\s+/g, '_')}`} name={`Add in ${status}`} location="Kanban Column" inline>
            <button
              onClick={() => onAddTicket(status)}
              className="p-1 rounded text-theme-muted hover:text-theme-text hover:bg-theme-surface transition cursor-pointer"
              title={`Add ticket to ${status}`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </DevAuthorityControl>
        )}
      </div>

      {/* Cards Scrollable List */}
      <div className="p-2 space-y-2.5 overflow-y-auto flex-1 min-h-[140px]">
        {isColumnDisabled ? (
          <div className="py-10 px-3 text-center border-2 border-dashed border-amber-500/40 rounded-xl bg-amber-500/5 m-1 space-y-2">
            <div className="text-amber-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5">
              <span>⚡ Dev Console Only Column</span>
            </div>
            <p className="text-[11px] text-theme-muted leading-relaxed">
              Hidden from normal website users. Right-click header or click DEV ONLY badge to turn ON for all users.
            </p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-10 text-center text-xs text-theme-muted/60 border border-dashed border-theme-border/40 rounded-xl m-1">
            No tickets
          </div>
        ) : (
          tickets.map(ticket => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onClick={() => onTicketClick(ticket)}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </div>
  );
};

