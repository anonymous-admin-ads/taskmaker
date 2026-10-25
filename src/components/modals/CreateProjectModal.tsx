import React, { useState } from 'react';
import { X, FolderPlus, AlertCircle } from 'lucide-react';

interface CreateProjectModalProps {
  onConfirm: (data: { name: string; key: string; description?: string; targetDate?: string }) => Promise<void>;
  onClose: () => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  onConfirm,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleNameChange = (val: string) => {
    setName(val);
    if (!key) {
      // Auto generate 3-4 letter prefix
      const generated = val.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 4);
      setKey(generated);
    }
  };

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
        description: description.trim() || undefined,
        targetDate: targetDate || undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-theme-border bg-theme-surface shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-theme-border">
          <div className="flex items-center gap-2.5">
            <FolderPlus className="w-5 h-5 text-theme-primary" />
            <h3 className="font-semibold text-sm text-theme-text">Create Project</h3>
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
              onChange={e => handleNameChange(e.target.value)}
              placeholder="e.g. Texawave Enterprise"
              className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-theme-text mb-1">
              Project Key <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={6}
              value={key}
              onChange={e => setKey(e.target.value.toUpperCase())}
              placeholder="e.g. TEXA"
              className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text font-mono uppercase focus:outline-none focus:border-theme-primary transition"
            />
            <p className="text-[10px] text-theme-muted mt-1">Used as prefix for all ticket keys (e.g. {key || 'PROJ'}-101)</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-theme-text mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief summary of project scope..."
              className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary transition resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-theme-text mb-1">Target Delivery Date</label>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary transition"
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
              data-dev-id="btn_modal_create_project"
              data-dev-name="Submit Create Project"
              data-dev-location="Modals"
              className="px-4 py-2 rounded-lg bg-theme-primary hover:bg-theme-primary-hover text-slate-950 font-semibold text-xs transition shadow-lg shadow-theme-primary/20 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

