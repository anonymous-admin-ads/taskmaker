import React, { useState } from 'react';
import { X, PauseCircle, Calendar, User, FileText, AlertCircle } from 'lucide-react';
import { Ticket, User as UserType } from '../../types';

interface HoldBoxModalProps {
  ticket: Ticket;
  users: UserType[];
  onConfirm: (data: {
    hold_reason: string;
    category: string;
    responsible_owner_id?: number;
    responsible_owner_name: string;
    expected_release_date?: string;
    notes?: string;
  }) => Promise<void>;
  onClose: () => void;
}

export const HoldBoxModal: React.FC<HoldBoxModalProps> = ({
  ticket,
  users,
  onConfirm,
  onClose,
}) => {
  const [holdReason, setHoldReason] = useState('');
  const [category, setCategory] = useState('Waiting for Materials or Required Information');
  const [responsibleOwnerName, setResponsibleOwnerName] = useState(ticket.assignee_name || '');
  const [responsibleOwnerId, setResponsibleOwnerId] = useState<number | undefined>(ticket.assignee_id);
  const [expectedReleaseDate, setExpectedReleaseDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const holdCategories = [
    'Waiting for Materials or Required Information',
    'Awaiting Customer or Manager Confirmation',
    'Waiting for Scheduled Packing Window',
    'Pending Required Document or Approval',
    'Business Dependency Hold',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!holdReason.trim()) {
      setErrorMsg('Hold reason is mandatory when routing a ticket to Hold Box');
      return;
    }
    if (!responsibleOwnerName.trim()) {
      setErrorMsg('A responsible owner is required');
      return;
    }

    try {
      setSubmitting(true);
      await onConfirm({
        hold_reason: holdReason.trim(),
        category,
        responsible_owner_id: responsibleOwnerId,
        responsible_owner_name: responsibleOwnerName.trim(),
        expected_release_date: expectedReleaseDate || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to move ticket to Hold Box');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-theme-surface shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-theme-border bg-amber-500/10">
          <div className="flex items-center gap-2.5">
            <PauseCircle className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-semibold text-sm text-theme-text">Route to Hold Box</h3>
              <p className="text-[11px] text-theme-muted">
                Placing ticket <span className="font-mono font-bold text-amber-400">{ticket.key}</span> on temporary hold
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
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Hold Reason (Mandatory) */}
          <div>
            <label className="block text-xs font-semibold text-theme-text mb-1">
              Hold Reason <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={holdReason}
              onChange={e => setHoldReason(e.target.value)}
              placeholder="e.g. Waiting for materials or customer packing window sign-off"
              className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text placeholder:text-theme-muted focus:outline-none focus:border-amber-400 transition"
            />
          </div>

          {/* Hold Category */}
          <div>
            <label className="block text-xs font-semibold text-theme-text mb-1">
              Hold Category <span className="text-rose-400">*</span>
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-amber-400 transition"
            >
              {holdCategories.map((c, i) => (
                <option key={i} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Responsible Owner (Mandatory) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-theme-text mb-1">
                Responsible Owner <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <select
                  value={responsibleOwnerId || ''}
                  onChange={e => {
                    const id = Number(e.target.value);
                    setResponsibleOwnerId(id || undefined);
                    const matched = users.find(u => u.id === id);
                    if (matched) setResponsibleOwnerName(matched.name);
                  }}
                  className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-amber-400 transition"
                >
                  <option value="">Select owner...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Optional Expected Release Date */}
            <div>
              <label className="block text-xs font-semibold text-theme-text mb-1">
                Expected Release Date
              </label>
              <input
                type="date"
                value={expectedReleaseDate}
                onChange={e => setExpectedReleaseDate(e.target.value)}
                className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-amber-400 transition"
              />
            </div>
          </div>

          {/* Notes or attachments meta */}
          <div>
            <label className="block text-xs font-semibold text-theme-text mb-1">
              Supporting Notes / Details
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Provide context regarding the hold condition, contacts, or prerequisite actions required..."
              className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text placeholder:text-theme-muted focus:outline-none focus:border-amber-400 transition resize-none"
            />
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
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {submitting ? 'Placing on Hold...' : 'Confirm Hold'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

