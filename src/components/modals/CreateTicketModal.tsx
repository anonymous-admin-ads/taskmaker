import React, { useState } from 'react';
import {
  X, Bold, Italic, Underline, List, Code, Link2, AlertCircle, Sparkles
} from 'lucide-react';
import { Project, User, TicketType, Priority, Ticket } from '../../types';

interface CreateTicketModalProps {
  projects: Project[];
  users: User[];
  defaultProjectId?: number;
  projectTickets?: Ticket[];
  onConfirm: (data: any) => Promise<void>;
  onClose: () => void;
}

export const CreateTicketModal: React.FC<CreateTicketModalProps> = ({
  projects,
  users,
  defaultProjectId,
  projectTickets = [],
  onConfirm,
  onClose,
}) => {
  const [projectId, setProjectId] = useState<number>(defaultProjectId || projects[0]?.id || 1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TicketType>('Task');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [assigneeId, setAssigneeId] = useState<number | undefined>(undefined);
  const [linkedTicketKey, setLinkedTicketKey] = useState<string>('');
  const [linkType, setLinkType] = useState<string>('relates_to');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const ticketTypes: TicketType[] = [
    'Task', 'Bug', 'Mission Critical', 'Story', 'Epic',
    'New Feature', 'Dev Task', 'Sub-task', 'Improvement', 'Incident'
  ];

  const priorities: Priority[] = ['Critical', 'High', 'Medium', 'Low'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!title.trim()) {
      setErrorMsg('Ticket title is required');
      return;
    }

    try {
      setSubmitting(true);
      await onConfirm({
        projectId,
        title: title.trim(),
        description: description.trim(),
        type,
        priority,
        assigneeId: assigneeId || undefined,
        assignmentType: 'Individual',
        linkedTicketKey: linkedTicketKey || undefined,
        linkType: linkedTicketKey ? linkType : undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-2xl rounded-2xl border border-theme-border bg-theme-surface shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-theme-border">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base text-theme-text">Create New Ticket</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-theme-primary/10 text-theme-primary border border-theme-primary/20">
              TaskFlow
            </span>
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

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-theme-text mb-1">
              Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter ticket title"
              className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text placeholder:text-theme-muted focus:outline-none focus:border-theme-primary transition"
            />
          </div>

          {/* Description with Markdown / Format bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-theme-text">Description</label>
              <div className="flex items-center gap-1 text-theme-muted">
                <button type="button" className="p-1 hover:text-theme-text hover:bg-theme-bg rounded"><Bold className="w-3.5 h-3.5" /></button>
                <button type="button" className="p-1 hover:text-theme-text hover:bg-theme-bg rounded"><Italic className="w-3.5 h-3.5" /></button>
                <button type="button" className="p-1 hover:text-theme-text hover:bg-theme-bg rounded"><Underline className="w-3.5 h-3.5" /></button>
                <button type="button" className="p-1 hover:text-theme-text hover:bg-theme-bg rounded"><List className="w-3.5 h-3.5" /></button>
                <button type="button" className="p-1 hover:text-theme-text hover:bg-theme-bg rounded"><Code className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the ticket... what to do, what to change..."
              className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text placeholder:text-theme-muted focus:outline-none focus:border-theme-primary transition resize-none font-mono"
            />
          </div>

          {/* Type & Priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-theme-text mb-1">
                Type <span className="text-rose-400">*</span>
              </label>
              <select
                value={type}
                onChange={e => setType(e.target.value as TicketType)}
                className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary transition"
              >
                {ticketTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-theme-text mb-1">
                Priority <span className="text-rose-400">*</span>
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as Priority)}
                className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary transition font-semibold"
              >
                {priorities.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Project, Sprint & Assignee */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-theme-text mb-1">
                Project <span className="text-rose-400">*</span>
              </label>
              <select
                value={projectId}
                onChange={e => setProjectId(Number(e.target.value))}
                className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary transition"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-theme-text mb-1">Sprint</label>
              <select
                className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary transition"
              >
                <option value="">Select sprint (Sprint 1)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-theme-text mb-1">Assignee</label>
              <select
                value={assigneeId || ''}
                onChange={e => setAssigneeId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary transition"
              >
                <option value="">Unassigned</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Link Work Items */}
          <div>
            <label className="block text-xs font-semibold text-theme-text mb-1 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-theme-muted" />
              <span>Link Work Items (Optional)</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={linkType}
                onChange={e => setLinkType(e.target.value)}
                className="bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary transition"
              >
                <option value="relates_to">Relates to</option>
                <option value="blocks">Blocks</option>
                <option value="is_blocked_by">Is blocked by</option>
                <option value="duplicates">Duplicates</option>
              </select>
              <input
                type="text"
                value={linkedTicketKey}
                onChange={e => setLinkedTicketKey(e.target.value.toUpperCase())}
                placeholder="Target Key e.g. FAS-8"
                className="bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text uppercase font-mono placeholder:normal-case placeholder:font-sans focus:outline-none focus:border-theme-primary transition"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-theme-border">
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
              data-dev-id="btn_modal_create_ticket"
              data-dev-name="Submit Create Ticket"
              data-dev-location="Modals"
              className="px-5 py-2 rounded-lg bg-theme-primary hover:bg-theme-primary-hover text-slate-950 font-semibold text-xs transition shadow-lg shadow-theme-primary/20 disabled:opacity-50"
            >
              {submitting ? 'Creating Ticket...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

