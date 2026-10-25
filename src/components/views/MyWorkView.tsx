import React, { useState } from 'react';
import { UserCheck, Clock, CheckCircle2, AlertTriangle, Calendar } from 'lucide-react';
import { Ticket } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface MyWorkViewProps {
  tickets: Ticket[];
  onTicketClick: (ticketId: number) => void;
}

export const MyWorkView: React.FC<MyWorkViewProps> = ({ tickets, onTicketClick }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'assigned' | 'created' | 'overdue'>('assigned');

  const today = new Date().toISOString().split('T')[0];

  const assigned = tickets.filter(t => t.assignee_id === user?.id);
  const created = tickets.filter(t => t.creator_id === user?.id);
  const overdue = assigned.filter(t => t.due_date && t.due_date < today && t.status !== 'Done');

  const displayed = tab === 'assigned' ? assigned : tab === 'created' ? created : overdue;

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-theme-bg">
      <div>
        <h1 className="text-xl font-bold text-theme-text tracking-tight">Your Work</h1>
        <p className="text-xs text-theme-muted mt-0.5">Tasks and work items directly connected to your workspace profile.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-theme-border pb-2 text-xs font-semibold">
        <button
          onClick={() => setTab('assigned')}
          className={`px-3 py-1.5 rounded-lg transition ${
            tab === 'assigned' ? 'bg-theme-primary text-slate-950 font-bold' : 'text-theme-muted hover:text-theme-text'
          }`}
        >
          Assigned to me ({assigned.length})
        </button>
        <button
          onClick={() => setTab('created')}
          className={`px-3 py-1.5 rounded-lg transition ${
            tab === 'created' ? 'bg-theme-primary text-slate-950 font-bold' : 'text-theme-muted hover:text-theme-text'
          }`}
        >
          Created by me ({created.length})
        </button>
        <button
          onClick={() => setTab('overdue')}
          className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
            tab === 'overdue' ? 'bg-rose-500 text-white font-bold' : 'text-rose-400 hover:text-rose-300'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Overdue ({overdue.length})</span>
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-theme-border bg-theme-surface overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-theme-border bg-theme-surface-hover/50 text-theme-muted text-[11px] uppercase tracking-wider font-semibold">
              <th className="py-3 px-4">Key</th>
              <th className="py-3 px-4">Title</th>
              <th className="py-3 px-4">Project</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Priority</th>
              <th className="py-3 px-4 text-right">Due Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border/50">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-theme-muted">
                  No work items in this category
                </td>
              </tr>
            ) : (
              displayed.map(t => (
                <tr
                  key={t.id}
                  onClick={() => onTicketClick(t.id)}
                  className="hover:bg-theme-surface-hover cursor-pointer transition"
                >
                  <td className="py-3 px-4 font-mono font-bold text-theme-primary">{t.key}</td>
                  <td className="py-3 px-4 font-medium text-theme-text max-w-sm truncate">{t.title}</td>
                  <td className="py-3 px-4 text-theme-muted">{t.project_name || 'Project'}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.status === 'Hold Box'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : t.status === 'Blocked Box'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : t.status === 'In Progress'
                          ? 'bg-sky-500/20 text-sky-300'
                          : t.status === 'Done'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`font-bold text-[10px] ${
                        t.priority === 'Critical'
                          ? 'text-rose-400'
                          : t.priority === 'High'
                          ? 'text-amber-400'
                          : 'text-sky-400'
                      }`}
                    >
                      {t.priority}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-theme-muted">
                    {t.due_date || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

