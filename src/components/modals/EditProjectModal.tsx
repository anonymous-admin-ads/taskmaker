import React, { useState } from 'react';
import { X, Edit3, AlertCircle } from 'lucide-react';
import { Project } from '../../types';

interface EditProjectModalProps {
  project: Project;
  onConfirm: (data: {
    name: string;
    key: string;
    description?: string;
    status: string;
    startDate?: string;
    targetDate?: string;
  }) => Promise<void>;
  onClose: () => void;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({
  project,
  onConfirm,
  onClose,
}) => {
  const [name, setName] = useState(project.name);
  const [key, setKey] = useState(project.key);
  const [description, setDescription] = useState(project.description || '');
  const [status, setStatus] = useState(project.status || 'Active');
  const [startDate, setStartDate] = useState(project.start_date || '');
  const [targetDate, setTargetDate] = useState(project.target_date || '');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !key.trim()) {
      setErrorMsg('Project Name and Key are required');
      return;
    }

    try {
      setSubmitting(true);
      await onConfirm({
        name: name.trim(),
        key: key.trim().toUpperCase(),
        description: description.trim(),
        status,
        startDate: startDate || undefined,
        targetDate: targetDate || undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-theme-border bg-theme-surface shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-theme-border">
          <div className="flex items-center gap-2.5">
            <Edit3 className="w-5 h-5 text-theme-primary" />
            <h3 className="font-semibold text-sm text-theme-text">Edit Project Details</h3>
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

          <div>
            <label className="block text-xs font-semibold text-theme-text mb-1">
              Project Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-theme-text mb-1">
                Project Key <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={8}
                value={key}
                onChange={e => setKey(e.target.value.toUpperCase())}
                className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text font-mono uppercase focus:outline-none focus:border-theme-primary transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-theme-text mb-1">
                Workflow Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as 'Active' | 'Archived')}
                className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary transition"
              >
                <option value="Active">Active</option>
                <option value="On Hold">On Hold</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-theme-text mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Enterprise planning and deliverables scope"
              className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-theme-text mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-theme-text mb-1">Target Delivery</label>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary transition"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-theme-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-xs font-medium text-theme-muted hover:text-theme-text transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-theme-primary text-slate-950 font-bold text-xs shadow-md shadow-theme-primary/20 hover:brightness-110 active:scale-95 transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

