import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { Ticket } from '../../types';

interface CalendarViewProps {
  tickets: Ticket[];
  onTicketClick: (ticketId: number) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  tickets,
  onTicketClick,
}) => {
  const [viewMode, setViewMode] = useState<'Month' | 'Week' | 'Day'>('Month');

  // October 2026 calendar days: 31 days. Oct 1, 2026 was a Thursday (index 4)
  const daysInMonth = 31;
  const startDayOffset = 4; // Thursday

  const calendarDays = Array.from({ length: 35 }, (_, i) => {
    const dayNumber = i - startDayOffset + 1;
    return dayNumber > 0 && dayNumber <= daysInMonth ? dayNumber : null;
  });

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-5 bg-theme-bg">
      {/* Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-theme-text tracking-tight">Calendar</h1>
          <p className="text-xs text-theme-muted mt-0.5">View your tasks, sprints and milestones.</p>
        </div>

        {/* View Mode Switcher & Date Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-theme-surface p-1 rounded-xl border border-theme-border text-xs">
            <button className="p-1 rounded hover:bg-theme-bg text-theme-muted hover:text-theme-text transition">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold px-2 text-theme-text">October 2026</span>
            <button className="p-1 rounded hover:bg-theme-bg text-theme-muted hover:text-theme-text transition">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1 bg-theme-surface p-1 rounded-xl border border-theme-border text-xs">
            {(['Month', 'Week', 'Day'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  viewMode === mode ? 'bg-theme-primary text-slate-950 shadow-sm' : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sprints Milestone Bar (Matching screenshot) */}
      <div className="p-3.5 rounded-xl border border-theme-border bg-theme-surface flex items-center gap-3 text-xs flex-wrap">
        <span className="font-bold text-theme-muted uppercase tracking-wider text-[10px]">Active Releases:</span>
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 font-semibold text-xs">
          <span>Sprint 1 (Oct 1 - Oct 25)</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold text-xs">
          <span>Release v1.0 (Oct 21)</span>
        </div>
      </div>

      {/* Calendar Grid (Matching screenshot layout) */}
      <div className="rounded-2xl border border-theme-border bg-theme-surface overflow-hidden shadow-sm">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-theme-border text-center text-xs font-bold text-theme-muted py-2.5 bg-theme-surface-hover/30">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-theme-border/50 text-xs">
          {calendarDays.map((day, idx) => {
            // Find tickets due on this day
            const dateStr = day ? `2026-10-${String(day).padStart(2, '0')}` : null;
            const dayTickets = dateStr ? tickets.filter(t => t.due_date === dateStr) : [];

            return (
              <div
                key={idx}
                className={`min-h-[105px] p-2 flex flex-col justify-between transition ${
                  day ? 'hover:bg-theme-surface-hover/50' : 'bg-theme-bg/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-semibold text-xs ${
                      day === 22
                        ? 'w-6 h-6 rounded-full bg-theme-primary text-slate-950 flex items-center justify-center font-bold'
                        : 'text-theme-muted'
                    }`}
                  >
                    {day || ''}
                  </span>
                </div>

                {/* Tickets on this date */}
                <div className="space-y-1 mt-1">
                  {dayTickets.map(t => (
                    <div
                      key={t.id}
                      onClick={() => onTicketClick(t.id)}
                      className={`p-1 rounded text-[10px] font-semibold cursor-pointer truncate ${
                        t.status === 'Hold Box'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : t.status === 'Blocked Box'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      }`}
                    >
                      {t.key}: {t.title}
                    </div>
                  ))}
                  {day === 15 && (
                    <div className="p-1 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 truncate">
                      Team Meeting (10:00 AM)
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

