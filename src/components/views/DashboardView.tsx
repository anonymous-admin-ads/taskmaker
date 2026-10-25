import React, { useState, useEffect } from 'react';
import {
  Calendar, CheckCircle2, Clock, AlertTriangle, PlayCircle,
  PauseCircle, Ban, TrendingUp, ArrowUpRight, ArrowDownRight, Layers,
  Plus, FolderPlus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUiControls } from '../../context/UiControlsContext';
import { DevAuthorityControl } from '../common/DevAuthorityControl';
import { api } from '../../api/client';
import { Ticket } from '../../types';

interface DashboardViewProps {
  onNavigate: (view: string) => void;
  onTicketClick: (ticketId: number) => void;
  onOpenCreateProject?: () => void;
  onOpenCreateTicket?: () => void;
}

// In-memory cache for instantaneous rendering without loading screen
let cachedDashboardData: any = null;
let cachedHoldBlockedMetrics: any = null;

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onTicketClick,
  onOpenCreateProject,
  onOpenCreateTicket,
}) => {
  const { user } = useAuth();
  const { isIconEnabled } = useUiControls();

  const showHoldBox = isIconEnabled('icon_hold_badge');
  const showBlockedBox = isIconEnabled('icon_blocked_badge');

  const [loading, setLoading] = useState(!cachedDashboardData);
  const [data, setData] = useState<any>(cachedDashboardData);
  const [holdBlockedMetrics, setHoldBlockedMetrics] = useState<any>(cachedHoldBlockedMetrics);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [dashRes, hbRes] = await Promise.all([
          api.getDashboardMetrics(),
          api.getHoldBlockedMetrics(),
        ]);
        cachedDashboardData = dashRes;
        cachedHoldBlockedMetrics = hbRes;
        setData(dashRes);
        setHoldBlockedMetrics(hbRes);
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();

    const handleSync = () => {
      loadDashboard();
    };
    window.addEventListener('taskflow:sync', handleSync);
    return () => window.removeEventListener('taskflow:sync', handleSync);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex-1 p-8 text-xs text-theme-muted flex items-center justify-center animate-pulse">
        Loading personalized dashboard metrics...
      </div>
    );
  }

  const { metrics, tasksByStatus, myTasks, recentActivity } = data || {
    metrics: { assigned: 0, inProgress: 0, inReview: 0, overdue: 0, completed: 0, onTimeRate: 100 },
    tasksByStatus: {},
    myTasks: [],
    recentActivity: []
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-theme-bg">
      {/* Top Greeting & Action Buttons */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-theme-text tracking-tight">
            Good morning, {user?.name || 'Hyagreenan'}!
          </h1>
          <p className="text-xs text-theme-muted mt-0.5">
            Here's your work overview for today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Prominent + New Project Button */}
          {onOpenCreateProject && (
            <DevAuthorityControl elementId="btn_create_project" name="+ New Project Button" location="Dashboard View" inline>
              <button
                onClick={onOpenCreateProject}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-theme-surface border border-theme-border hover:border-theme-primary text-theme-text font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer"
              >
                <FolderPlus className="w-4 h-4 text-theme-primary stroke-[2.5]" />
                <span>+ New Project</span>
              </button>
            </DevAuthorityControl>
          )}

          {/* Prominent + Create Ticket Button */}
          {onOpenCreateTicket && (
            <DevAuthorityControl elementId="btn_create_ticket" name="+ Create Ticket Button" location="Dashboard View" inline>
              <button
                onClick={onOpenCreateTicket}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Create Ticket</span>
              </button>
            </DevAuthorityControl>
          )}

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-theme-border bg-theme-surface text-xs font-semibold text-theme-text shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-theme-primary" />
            <span>October 2026</span>
          </div>
        </div>
      </div>

      {/* Primary Stat Metric Cards */}
      <DevAuthorityControl elementId="widget_stats_cards" name="Metric Summary Stat Cards" location="Dashboard View" block>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {/* Assigned to me */}
          <div
            onClick={() => onNavigate('my_work')}
            className="p-4 rounded-xl border border-theme-border bg-theme-surface hover:border-theme-primary/40 cursor-pointer transition shadow-sm"
          >
            <div className="text-2xl font-bold text-theme-text">{metrics.assigned}</div>
            <div className="text-xs text-theme-muted mt-1 font-medium">Assigned to me</div>
            <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-semibold">
              <ArrowUpRight className="w-3 h-3" />
              <span>+2 from last week</span>
            </div>
          </div>

          {/* In progress */}
          <div
            onClick={() => onNavigate('board')}
            className="p-4 rounded-xl border border-theme-border bg-theme-surface hover:border-theme-primary/40 cursor-pointer transition shadow-sm"
          >
            <div className="text-2xl font-bold text-theme-text">{metrics.inProgress}</div>
            <div className="text-xs text-theme-muted mt-1 font-medium">In progress</div>
            <div className="text-[11px] text-sky-400 flex items-center gap-1 mt-1 font-semibold">
              <ArrowUpRight className="w-3 h-3" />
              <span>Active branch</span>
            </div>
          </div>

          {/* In review */}
          <div
            onClick={() => onNavigate('board')}
            className="p-4 rounded-xl border border-theme-border bg-theme-surface hover:border-theme-primary/40 cursor-pointer transition shadow-sm"
          >
            <div className="text-2xl font-bold text-theme-text">{metrics.inReview}</div>
            <div className="text-xs text-theme-muted mt-1 font-medium">In review</div>
            <div className="text-[11px] text-amber-400 flex items-center gap-1 mt-1 font-semibold">
              <span>Dev & QA gate</span>
            </div>
          </div>

          {/* Overdue */}
          <div
            onClick={() => onNavigate('my_work')}
            className="p-4 rounded-xl border border-theme-border bg-theme-surface hover:border-rose-500/40 cursor-pointer transition shadow-sm"
          >
            <div className="text-2xl font-bold text-rose-400">{metrics.overdue}</div>
            <div className="text-xs text-theme-muted mt-1 font-medium">Overdue</div>
            <div className="text-[11px] text-rose-400 flex items-center gap-1 mt-1 font-semibold">
              <AlertTriangle className="w-3 h-3" />
              <span>Action required</span>
            </div>
          </div>

          {/* Completed */}
          <div
            onClick={() => onNavigate('reports')}
            className="p-4 rounded-xl border border-theme-border bg-theme-surface hover:border-emerald-500/40 cursor-pointer transition shadow-sm"
          >
            <div className="text-2xl font-bold text-emerald-400">{metrics.completed}</div>
            <div className="text-xs text-theme-muted mt-1 font-medium">Completed</div>
            <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-semibold">
              <CheckCircle2 className="w-3 h-3" />
              <span>Sprint goals</span>
            </div>
          </div>

          {/* On-time rate */}
          <div className="p-4 rounded-xl border border-theme-border bg-theme-surface shadow-sm">
            <div className="text-2xl font-bold text-theme-primary">{metrics.onTimeRate}%</div>
            <div className="text-xs text-theme-muted mt-1 font-medium">On-time rate</div>
            <div className="text-[11px] text-theme-primary flex items-center gap-1 mt-1 font-semibold">
              <TrendingUp className="w-3 h-3" />
              <span>High velocity</span>
            </div>
          </div>
        </div>
      </DevAuthorityControl>

      {/* HOLD BOX & BLOCKED BOX SUMMARY TILES (Controlled by Developer Console) */}
      {holdBlockedMetrics && (showHoldBox || showBlockedBox) && (
        <div className={`grid gap-4 ${showHoldBox && showBlockedBox ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Hold Box Metric Tile */}
          {showHoldBox && (
            <div
              onClick={() => onNavigate('board')}
              className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/10 hover:bg-amber-950/20 cursor-pointer transition flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <PauseCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Tickets on Hold (Hold Box)</div>
                  <div className="text-xs text-theme-muted mt-0.5">
                    Avg duration: <span className="font-mono text-amber-200">{holdBlockedMetrics.avgHoldHours} hrs</span> • Past release: <span className="text-amber-400 font-bold">{holdBlockedMetrics.overdueHoldCount}</span>
                  </div>
                </div>
              </div>
              <div className="text-3xl font-extrabold text-amber-400 font-mono">
                {holdBlockedMetrics.activeHoldCount}
              </div>
            </div>
          )}

          {/* Blocked Box Metric Tile */}
          {showBlockedBox && (
            <div
              onClick={() => onNavigate('board')}
              className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/10 hover:bg-rose-950/20 cursor-pointer transition flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                  <Ban className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-rose-300 uppercase tracking-wider">Blocked Tickets (Blocked Box)</div>
                  <div className="text-xs text-theme-muted mt-0.5">
                    Avg blocked: <span className="font-mono text-rose-200">{holdBlockedMetrics.avgBlockedHours} hrs</span> • Past expected: <span className="text-rose-400 font-bold">{holdBlockedMetrics.overdueBlockedCount}</span>
                  </div>
                </div>
              </div>
              <div className="text-3xl font-extrabold text-rose-400 font-mono">
                {holdBlockedMetrics.activeBlockedCount}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Grid: My Tasks (Left) & Status Donut / Activity (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: My Tasks Table */}
        <div className="lg:col-span-2 rounded-2xl border border-theme-border bg-theme-surface p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-theme-text">My Tasks</h3>
            <button
              onClick={() => onNavigate('my_work')}
              className="text-xs text-theme-primary font-semibold hover:underline"
            >
              View all →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-theme-border/60 text-theme-muted text-[11px] uppercase tracking-wider">
                  <th className="pb-2 font-semibold">Key</th>
                  <th className="pb-2 font-semibold">Title</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Priority</th>
                  <th className="pb-2 font-semibold text-right">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border/40">
                {myTasks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-theme-muted">
                      No assigned tasks
                    </td>
                  </tr>
                ) : (
                  myTasks.map((t: any) => (
                    <tr
                      key={t.id}
                      onClick={() => onTicketClick(t.id)}
                      className="hover:bg-theme-surface-hover/70 cursor-pointer transition"
                    >
                      <td className="py-3 font-mono font-bold text-theme-primary">{t.key}</td>
                      <td className="py-3 font-medium text-theme-text max-w-xs truncate">{t.title}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            t.status === 'Hold Box'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : t.status === 'Blocked Box'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : t.status === 'In Progress'
                              ? 'bg-sky-500/20 text-sky-300'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className={`text-[10px] font-bold ${
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
                      <td className="py-3 text-right font-medium text-theme-muted">
                        {t.due_date || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Tasks by Status & Recent Activity */}
        <div className="space-y-6">
          {/* Tasks by Status Breakdown */}
          <div className="rounded-2xl border border-theme-border bg-theme-surface p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-theme-text">Tasks by Status</h3>
              <span className="text-xs font-mono font-bold text-theme-muted">
                Total: {tasksByStatus.total}
              </span>
            </div>

            {/* Donut representation & list */}
            <div className="space-y-2 text-xs">
              {tasksByStatus.breakdown.map((s: any) => {
                const pct = tasksByStatus.total > 0 ? Math.round((s.count / tasksByStatus.total) * 100) : 0;
                return (
                  <div key={s.status} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-theme-text">{s.status}</span>
                      <span className="font-mono text-theme-muted">{s.count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          s.status === 'Done'
                            ? 'bg-emerald-400'
                            : s.status === 'Hold Box'
                            ? 'bg-amber-400'
                            : s.status === 'Blocked Box'
                            ? 'bg-rose-500'
                            : s.status === 'In Progress'
                            ? 'bg-sky-400'
                            : 'bg-theme-primary'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Activity Feed */}
          <DevAuthorityControl elementId="widget_recent_activity" name="Recent Activity Feed Widget" location="Dashboard View" block>
            <div className="rounded-2xl border border-theme-border bg-theme-surface p-5 space-y-3.5 shadow-sm">
              <h3 className="font-bold text-sm text-theme-text">Recent Activity</h3>
              <div className="space-y-3">
                {recentActivity.map((a: any) => (
                  <div key={a.id} className="flex items-start gap-2.5 text-xs">
                    <div className="w-6 h-6 rounded-full bg-theme-primary/15 text-theme-primary font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                      {a.actor_avatar || a.actor_name?.[0] || 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-theme-text leading-tight">
                        <span className="font-semibold">{a.actor_name}</span>{' '}
                        <span className="text-theme-muted">{a.action.toLowerCase().replace(/_/g, ' ')}</span>{' '}
                        {a.target_id && <span className="font-mono text-theme-primary font-semibold">{a.target_id}</span>}
                      </div>
                      <div className="text-[10px] text-theme-muted mt-0.5">
                        {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DevAuthorityControl>
        </div>
      </div>
    </div>
  );
};
