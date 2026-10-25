import React, { useState } from 'react';
import { X, Ban, AlertCircle, Link2, AlertTriangle } from 'lucide-react';
import { Ticket } from '../../types';

interface BlockedBoxModalProps {
  ticket: Ticket;
  projectTickets: Ticket[];
  onConfirm: (data: {
    blocker_description: string;
    category: string;
    responsible_name: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    linked_ticket_id?: number;
    expected_resolution_date?: string;
  }) => Promise<void>;
  onClose: () => void;
}

export const BlockedBoxModal: React.FC<BlockedBoxModalProps> = ({
  ticket,
  projectTickets,
  onConfirm,
  onClose,
}) => {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Dependent Ticket Unfinished');
  const [responsibleName, setResponsibleName] = useState('');
  const [severity, setSeverity] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('High');
  const [linkedTicketId, setLinkedTicketId] = useState<number | undefined>(undefined);
  const [expectedResolutionDate, setExpectedResolutionDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const blockerCategories = [
    'Dependent Ticket Unfinished',
    'Required Approval Rejected',
    'Critical Defect Identified',
    'Required Components / Access Unavailable',
    'QA / Mandatory Prerequisite Failed',
    'External Vendor / API Dependency',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!description.trim()) {
      setErrorMsg('Blocker description is mandatory when moving a ticket to Blocked Box');
      return;
    }
    if (!responsibleName.trim()) {
      setErrorMsg('Responsible person or team is mandatory');
      return;
    }

    try {
      setSubmitting(true);
      await onConfirm({
        blocker_description: description.trim(),
        category,
        responsible_name: responsibleName.trim(),
        severity,
        linked_ticket_id: linkedTicketId,
        expected_resolution_date: expectedResolutionDate || undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to move ticket to Blocked Box');
    } finally {
      setSubmitting(false);
    }
  };

  const eligibleLinkedTickets = projectTickets.filter(t => t.id !== ticket.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-rose-500/40 bg-theme-surface shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-theme-border bg-rose-500/10">
          <div className="flex items-center gap-2.5">
            <Ban className="w-5 h-5 text-rose-500" />
            <div>
              <h3 className="font-semibold text-sm text-theme-text">Route to Blocked Box</h3>
              <p className="text-[11px] text-theme-muted">
                Work cannot proceed on <span className="font-mono font-bold text-rose-400">{ticket.key}</span> due to an active blocker
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-theme-muted hover:text-theme-text transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Blocker Description (Mandatory) */}
          <div>
            <label className="block text-xs font-semibold text-theme-text mb-1">
              Blocker Description <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={2}
              required
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the blocker preventing this ticket from proceeding..."
              className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text placeholder:text-theme-muted focus:outline-none focus:border-rose-400 transition resize-none"
            />
          </div>

          {/* Category & Severity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-theme-text mb-1">
                Blocking Category <span className="text-rose-400">*</span>
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-rose-400 transition"
              >
                {blockerCategories.map((c, i) => (
                  <option key={i} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-theme-text mb-1">
                Severity / Impact <span className="text-rose-400">*</span>
              </label>
              <select
                value={severity}
                onChange={e => setSeverity(e.target.value as any)}
                className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-rose-400 transition font-semibold"
              >
                <option value="Critical" className="text-rose-400">Critical (Complete Stop)</option>
                <option value="High" className="text-amber-400">High (Major Dependency)</option>
                <option value="Medium" className="text-sky-400">Medium (Partial Delay)</option>
                <option value="Low" className="text-emerald-400">Low (Minor Notice)</option>
              </select>
            </div>
          </div>

          {/* Responsible Person or Team (Mandatory) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-theme-text mb-1">
                Responsible Person / Team <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={responsibleName}
                onChange={e => setResponsibleName(e.target.value)}
                placeholder="e.g. Backend Team, Dhanush, DevOps"
                className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text placeholder:text-theme-muted focus:outline-none focus:border-rose-400 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-theme-text mb-1">
                Expected Resolution Date
              </label>
              <input
                type="date"
                value={expectedResolutionDate}
                onChange={e => setExpectedResolutionDate(e.target.value)}
                className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-rose-400 transition"
              />
            </div>
          </div>

          {/* Linked Dependency / Defect */}
          <div>
            <label className="block text-xs font-semibold text-theme-text mb-1 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-theme-muted" />
              <span>Linked Dependency or Defect Ticket (Optional)</span>
            </label>
            <select
              value={linkedTicketId || ''}
              onChange={e => setLinkedTicketId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-rose-400 transition"
            >
              <option value="">No linked ticket...</option>
              {eligibleLinkedTickets.map(t => (
                <option key={t.id} value={t.id}>
                  {t.key} — {t.title} ({t.status})
                </option>
              ))}
            </select>
          </div>

          {/* Footer Actions */}
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
              {submitting ? 'Placing in Blocked Box...' : 'Confirm Blocker'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

