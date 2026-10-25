import React, { useState } from 'react';
import { X, PlayCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Ticket, WorkflowStatus } from '../../types';

interface ReleaseHoldModalProps {
  ticket: Ticket;
  onConfirm: (targetStatus: WorkflowStatus, releaseNotes: string) => Promise<void>;
  onClose: () => void;
}

export const ReleaseHoldModal: React.FC<ReleaseHoldModalProps> = ({
  ticket,
  onConfirm,
  onClose,
}) => {
  const [targetStatus, setTargetStatus] = useState<WorkflowStatus>('Ready to Test');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const allowedReleaseStages: WorkflowStatus[] = [
    'Ready to Test',
    'Pending QA',
    'In Progress',
    'Dev Review',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!releaseNotes.trim()) {
      setErrorMsg('Resolution notes are required when releasing a ticket from hold');
      return;
    }

    try {
      setSubmitting(true);
      await onConfirm(targetStatus, releaseNotes.trim());
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to release ticket from hold');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-theme-surface shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-theme-border bg-emerald-500/10">
          <div className="flex items-center gap-2.5">
            <PlayCircle className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-semibold text-sm text-theme-text">Release from Hold Box</h3>
              <p className="text-[11px] text-theme-muted">
                Resume workflow for <span className="font-mono font-bold text-emerald-400">{ticket.key}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-theme-muted hover:text-theme-text transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {ticket.hold_reason && (
            <div className="p-3 rounded-lg bg-theme-bg/60 border border-theme-border text-xs">
              <span className="text-theme-muted block text-[10px] uppercase tracking-wider font-semibold">Active Hold Reason:</span>
              <span className="text-amber-400 font-medium">{ticket.hold_reason}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-theme-text mb-1">
              Resume to Workflow Stage <span className="text-rose-400">*</span>
            </label>
            <select
              value={targetStatus}
              onChange={e => setTargetStatus(e.target.value as WorkflowStatus)}
              className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-emerald-400 transition"
            >
              {allowedReleaseStages.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-theme-text mb-1">
              Release Notes / Resolution Justification <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={releaseNotes}
              onChange={e => setReleaseNotes(e.target.value)}
              placeholder="Explain how the hold condition was resolved (e.g. Packing window confirmed by warehouse, materials verified)..."
              className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text placeholder:text-theme-muted focus:outline-none focus:border-emerald-400 transition resize-none"
            />
          </div>

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
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Releasing...' : 'Release Ticket'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

