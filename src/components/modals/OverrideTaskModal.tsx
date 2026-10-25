import React, { useState } from 'react';
import { X, ShieldAlert, ArrowRight, AlertCircle } from 'lucide-react';
import { Ticket, User as UserType, Priority, WorkflowStatus } from '../../types';

interface OverrideTaskModalProps {
  ticket: Ticket;
  users: UserType[];
  onConfirm: (data: {
    targetStatus?: WorkflowStatus;
    assigneeId?: number;
    priority?: Priority;
    overrideReason: string;
    expectedVersion: number;
  }) => Promise<void>;
  onClose: () => void;
}

export const OverrideTaskModal: React.FC<OverrideTaskModalProps> = ({
  ticket,
  users,
  onConfirm,
  onClose,
}) => {
  const [proposedStatus, setProposedStatus] = useState<WorkflowStatus>(ticket.status);
  const [proposedAssigneeId, setProposedAssigneeId] = useState<number | undefined>(ticket.assignee_id);
  const [proposedPriority, setProposedPriority] = useState<Priority>(ticket.priority);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const statuses: WorkflowStatus[] = [
    'To Do', 'In Progress', 'Dev Review', 'Ready to Test',
    'Hold Box', 'Pending QA', 'QA Testing', 'QA Review', 'Done', 'Blocked Box', 'Cancelled'
  ];

  const priorities: Priority[] = ['Critical', 'High', 'Medium', 'Low'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) {
      setErrorMsg('An explicit reason (at least 5 characters) is required for audit compliance');
      return;
    }

    try {
      setSubmitting(true);
      await onConfirm({
        targetStatus: proposedStatus,
        assigneeId: proposedAssigneeId,
        priority: proposedPriority,
        overrideReason: reason.trim(),
        expectedVersion: ticket.version,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Task override rejected');
    } finally {
      setSubmitting(false);
    }
  };

  const currentAssigneeName = ticket.assignee_name || 'Unassigned';
  const proposedAssigneeName = users.find(u => u.id === proposedAssigneeId)?.name || 'Unassigned';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-rose-500/40 bg-theme-surface shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-theme-border bg-rose-500/10">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="font-semibold text-sm text-theme-text">Administrative Task Override</h3>
              <p className="text-[11px] text-theme-muted">
                Override ownership, stage, or priority on <span className="font-mono font-bold text-rose-400">{ticket.key}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-theme-muted hover:text-theme-text transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Current vs Proposed Matrix */}
          <div className="p-3 rounded-xl bg-theme-bg/80 border border-theme-border space-y-2 text-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">Proposed Changes Diff:</div>

            {/* Status Diff */}
            <div className="flex items-center justify-between py-1 border-b border-theme-border/40">
              <span className="text-theme-muted">Status:</span>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">{ticket.status}</span>
                <ArrowRight className="w-3.5 h-3.5 text-theme-muted" />
                <span className="px-2 py-0.5 rounded bg-theme-primary/20 text-theme-primary font-mono text-[11px] font-bold">
                  {proposedStatus}
                </span>
              </div>
            </div>

            {/* Assignee Diff */}
            <div className="flex items-center justify-between py-1 border-b border-theme-border/40">
              <span className="text-theme-muted">Assignee:</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">{currentAssigneeName}</span>
                <ArrowRight className="w-3.5 h-3.5 text-theme-muted" />
                <span className="text-theme-text font-bold">{proposedAssigneeName}</span>
              </div>
            </div>

            {/* Priority Diff */}
            <div className="flex items-center justify-between py-1">
              <span className="text-theme-muted">Priority:</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">{ticket.priority}</span>
                <ArrowRight className="w-3.5 h-3.5 text-theme-muted" />
                <span className="text-theme-text font-bold">{proposedPriority}</span>
              </div>
            </div>
          </div>

          {/* Override Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-theme-text mb-1">Target Status</label>
              <select
                value={proposedStatus}
                onChange={e => setProposedStatus(e.target.value as WorkflowStatus)}
                className="w-full bg-theme-bg border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
              >
                {statuses.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-theme-text mb-1">Reassign Owner</label>
              <select
                value={proposedAssigneeId || ''}
                onChange={e => setProposedAssigneeId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full bg-theme-bg border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
              >
                <option value="">Unassigned</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-theme-text mb-1">Priority</label>
              <select
                value={proposedPriority}
                onChange={e => setProposedPriority(e.target.value as Priority)}
                className="w-full bg-theme-bg border border-theme-border rounded-lg px-2.5 py-1.5 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
              >
                {priorities.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mandatory Override Justification */}
          <div>
            <label className="block text-xs font-semibold text-theme-text mb-1">
              Override Justification (Audit Recorded) <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="State the operational reason for this administrative override (e.g. Unblocking release pipeline, reassigned due to PTO)..."
              className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text placeholder:text-theme-muted focus:outline-none focus:border-rose-400 transition resize-none"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-theme-border">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-xs font-medium text-theme-muted hover:text-theme-text hover:bg-theme-surface-hover transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs transition shadow-lg shadow-rose-500/20 disabled:opacity-50"
            >
              {submitting ? 'Applying Override...' : 'Confirm Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

