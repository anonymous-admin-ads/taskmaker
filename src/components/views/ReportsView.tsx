import React, { useState, useEffect } from 'react';
import {
  BarChart3, PauseCircle, Ban, Clock, AlertTriangle, CheckCircle2, TrendingUp, Filter, RefreshCw, Download
} from 'lucide-react';
import { api } from '../../api/client';
import { Project } from '../../types';
import { useUiControls } from '../../context/UiControlsContext';

interface ReportsViewProps {
  projects: Project[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ projects }) => {
  const { isButtonEnabled } = useUiControls();
  const showExportBtn = isButtonEnabled('btn_export_reports');

  const [selectedProject, setSelectedProject] = useState<string>('All');
  const [reportsData, setReportsData] = useState<any>(null);
  const [holdBlockedData, setHoldBlockedData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const projId = selectedProject !== 'All' ? Number(selectedProject) : undefined;
      const [rData, hbData] = await Promise.all([
        api.getReports(projId),
        api.getHoldBlockedMetrics({ projectId: projId }),
      ]);
      setReportsData(rData);
      setHoldBlockedData(hbData);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedProject]);

  if (loading || !reportsData || !holdBlockedData) {
    return (
      <div className="flex-1 p-8 text-xs text-theme-muted flex items-center justify-center animate-pulse">
        Calculating analytics metrics from database records...
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-theme-bg">
      {/* Header & Filter */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-theme-text tracking-tight">Reports & Analytics</h1>
          <p className="text-xs text-theme-muted mt-0.5">Database-backed velocity, QA defect rates and Hold/Blocked metrics.</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            className="bg-theme-surface border border-theme-border rounded-lg px-3 py-1.5 text-xs text-theme-text font-semibold focus:outline-none focus:border-theme-primary"
          >
            <option value="All">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
            ))}
          </select>

          {showExportBtn && (
            <button
              onClick={() => {
                const csvContent = "data:text/csv;charset=utf-8," +
                  "Metric,Value\n" +
                  `Total Issues,${reportsData.total}\n` +
                  `Completed,${reportsData.completed}\n` +
                  `In Progress,${reportsData.inProgress}\n` +
                  `Velocity,${reportsData.velocity} pts\n` +
                  `Hold Box Active,${holdBlockedData.holdCount}\n` +
                  `Blocked Box Active,${holdBlockedData.blockedCount}\n`;
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `taskflow_report_${selectedProject}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-xs font-semibold text-theme-text transition cursor-pointer"
              title="Export report metrics to CSV"
            >
              <Download className="w-3.5 h-3.5 text-theme-primary" />
              <span>Export CSV</span>
            </button>
          )}

          <button
            onClick={loadData}
            className="p-1.5 rounded-lg border border-theme-border bg-theme-surface text-theme-muted hover:text-theme-text transition cursor-pointer"
            title="Refresh analytics data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top 4 Summary Cards (Matching screenshot Reports & Analytics screen) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-theme-border bg-theme-surface">
          <span className="text-xs text-theme-muted font-medium">Total Issues</span>
          <div className="text-2xl font-bold text-theme-text mt-1">{reportsData.total}</div>
        </div>
        <div className="p-4 rounded-xl border border-theme-border bg-theme-surface">
          <span className="text-xs text-theme-muted font-medium">Completed</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{reportsData.completed}</div>
        </div>
        <div className="p-4 rounded-xl border border-theme-border bg-theme-surface">
          <span className="text-xs text-theme-muted font-medium">In Progress</span>
          <div className="text-2xl font-bold text-sky-400 mt-1">{reportsData.inProgress}</div>
        </div>
        <div className="p-4 rounded-xl border border-theme-border bg-theme-surface">
          <span className="text-xs text-theme-muted font-medium">Overdue</span>
          <div className="text-2xl font-bold text-rose-400 mt-1">{reportsData.overdue}</div>
        </div>
      </div>

      {/* HOLD BOX & BLOCKED BOX DEEP METRICS (Mandatory prompt requirements) */}
      <div className="rounded-2xl border border-theme-border bg-theme-surface p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-theme-text">Hold Box & Blocked Box Bottleneck Analysis</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Live DB Records
            </span>
          </div>
          <span className="text-xs text-theme-muted font-medium">
            (Hold & Blocked tickets are explicitly excluded from completed metrics)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
          <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-300">Tickets on Hold</span>
              <PauseCircle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400 font-mono mt-1">
              {holdBlockedData.activeHoldCount}
            </div>
            <span className="text-[11px] text-amber-200/70 block mt-1">Avg duration: {holdBlockedData.avgHoldHours} hrs</span>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-300">Blocked Tickets</span>
              <Ban className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400 font-mono mt-1">
              {holdBlockedData.activeBlockedCount}
            </div>
            <span className="text-[11px] text-rose-200/70 block mt-1">Avg blocked: {holdBlockedData.avgBlockedHours} hrs</span>
          </div>

          <div className="p-3.5 rounded-xl bg-theme-bg/60 border border-theme-border">
            <span className="text-xs font-semibold text-theme-muted">Holds Past Expected Date</span>
            <div className="text-2xl font-bold text-amber-400 font-mono mt-1">
              {holdBlockedData.overdueHoldCount}
            </div>
            <span className="text-[11px] text-theme-muted block mt-1">Requires follow-up</span>
          </div>

          <div className="p-3.5 rounded-xl bg-theme-bg/60 border border-theme-border">
            <span className="text-xs font-semibold text-theme-muted">Blockers Past Target</span>
            <div className="text-2xl font-bold text-rose-400 font-mono mt-1">
              {holdBlockedData.overdueBlockedCount}
            </div>
            <span className="text-[11px] text-theme-muted block mt-1">Critical escalation</span>
          </div>
        </div>

        {/* Common Reasons Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Most Common Hold Reasons */}
          <div className="p-3.5 rounded-xl bg-theme-bg/50 border border-theme-border space-y-2">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
              Most Common Hold Reasons
            </span>
            <div className="space-y-1.5 text-xs">
              {holdBlockedData.commonHoldReasons?.map((r: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between py-1 border-b border-theme-border/40">
                  <span className="text-theme-text truncate max-w-xs">{r.category}</span>
                  <span className="font-mono font-bold text-amber-400">{r.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Most Common Blocker Categories */}
          <div className="p-3.5 rounded-xl bg-theme-bg/50 border border-theme-border space-y-2">
            <span className="text-xs font-bold text-rose-300 uppercase tracking-wider block">
              Most Common Blocker Categories
            </span>
            <div className="space-y-1.5 text-xs">
              {holdBlockedData.commonBlockerReasons?.map((r: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between py-1 border-b border-theme-border/40">
                  <span className="text-theme-text truncate max-w-xs">{r.category}</span>
                  <span className="font-mono font-bold text-rose-400">{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Issues by Type & Issues by Priority Visuals (Matching screenshot) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Issues by Type */}
        <div className="rounded-2xl border border-theme-border bg-theme-surface p-5 space-y-4 shadow-sm">
          <h3 className="font-bold text-sm text-theme-text">Issues by Type</h3>
          <div className="space-y-2 text-xs">
            {reportsData.byType?.map((t: any) => {
              const pct = reportsData.total > 0 ? Math.round((t.count / reportsData.total) * 100) : 0;
              return (
                <div key={t.type} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-theme-text">{t.type}</span>
                    <span className="font-mono text-theme-muted">{t.count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-theme-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Issues by Priority */}
        <div className="rounded-2xl border border-theme-border bg-theme-surface p-5 space-y-4 shadow-sm">
          <h3 className="font-bold text-sm text-theme-text">Issues by Priority</h3>
          <div className="space-y-2 text-xs">
            {reportsData.byPriority?.map((p: any) => {
              const pct = reportsData.total > 0 ? Math.round((p.count / reportsData.total) * 100) : 0;
              return (
                <div key={p.priority} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-theme-text">{p.priority}</span>
                    <span className="font-mono text-theme-muted">{p.count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        p.priority === 'Critical'
                          ? 'bg-rose-500'
                          : p.priority === 'High'
                          ? 'bg-amber-400'
                          : p.priority === 'Medium'
                          ? 'bg-sky-400'
                          : 'bg-slate-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

