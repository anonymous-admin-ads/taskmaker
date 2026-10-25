import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Bell, Moon, Sun, Sliders, LogOut, Layers, ChevronDown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useUiControls } from '../../context/UiControlsContext';
import { DevAuthorityControl } from '../common/DevAuthorityControl';
import { api } from '../../api/client';
import { Project, ThemeName } from '../../types';

interface TopNavProps {
  currentProject?: Project | null;
  projects?: Project[];
  onSelectProject?: (p: Project) => void;
  onOpenCreateTicket?: () => void;
  onOpenCreateProject?: () => void;
  onNavigate: (view: string) => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  onNavigate,
}) => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isButtonEnabled, controlsMap } = useUiControls();

  const isRoleOn = controlsMap['btn_role_enforcement'] !== false;

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const navRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (e) {}
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (e) {}
  };

  const themeCycle: Record<ThemeName, ThemeName> = {
    'midnight-cyan': 'ocean-blue',
    'ocean-blue': 'arctic-light',
    'arctic-light': 'midnight-cyan',
  };

  return (
    <header ref={navRef} className="h-14 border-b border-theme-border bg-theme-surface/95 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-40">
      {/* Left: Clean Branding Logo & Marked Destination Nav Links */}
      <div className="flex items-center gap-4">
        <div
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-theme-primary to-theme-secondary flex items-center justify-center shadow-lg shadow-theme-primary/20">
            <Layers className="w-5 h-5 text-slate-950 font-bold" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-tight text-theme-text group-hover:text-theme-primary transition">
              TaskFlow
            </span>
            <span className="text-[9px] uppercase tracking-wider text-theme-muted font-medium -mt-1">
              Organize • Track • Deliver
            </span>
          </div>
        </div>

        {/* TopNav Quick Nav Links (Controlled by Developer Console) */}
        <div className="hidden lg:flex items-center gap-1.5 ml-2">
          <DevAuthorityControl elementId="btn_nav_projects_dropdown" name="Projects Dropdown" inline>
            <button
              onClick={() => onNavigate('projects')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-theme-muted hover:text-theme-text hover:bg-theme-surface-hover transition cursor-pointer flex items-center gap-1"
            >
              <span>Projects</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
          </DevAuthorityControl>

          <DevAuthorityControl elementId="btn_nav_your_work" name="Your Work Dropdown" inline>
            <button
              onClick={() => onNavigate('my_work')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-theme-muted hover:text-theme-text hover:bg-theme-surface-hover transition cursor-pointer flex items-center gap-1"
            >
              <span>Your Work</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
          </DevAuthorityControl>

          <DevAuthorityControl elementId="btn_nav_dashboards" name="Dashboards Link" inline>
            <button
              onClick={() => onNavigate('dashboard')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-theme-muted hover:text-theme-text hover:bg-theme-surface-hover transition cursor-pointer"
            >
              <span>Dashboards</span>
            </button>
          </DevAuthorityControl>

          <DevAuthorityControl elementId="btn_nav_teams" name="Teams Link" inline>
            <button
              onClick={() => onNavigate('teams')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-theme-muted hover:text-theme-text hover:bg-theme-surface-hover transition cursor-pointer"
            >
              <span>Teams</span>
            </button>
          </DevAuthorityControl>
        </div>
      </div>

      {/* Center: Live Role Status Badge (Immediate Developer Console Sync) */}
      <div className="hidden md:flex items-center gap-2">
        {!isRoleOn ? (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold shadow-sm animate-in fade-in">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>⚡ Role-Free Mode: All Users Granted Universal Rights</span>
          </div>
        ) : (
          user && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme-bg/60 border border-theme-border text-theme-muted text-xs">
              <span className="text-[10px] uppercase font-bold text-theme-muted">Access Level:</span>
              <span className="text-xs font-semibold text-theme-primary capitalize">{user.role?.replace(/_/g, ' ')}</span>
            </div>
          )
        )}
      </div>

      {/* Right Controls: Search, Theme, Notifications, Avatar */}
      <div className="flex items-center gap-3">
        {/* Global Search Bar (Controlled In-Place by Developer Console) */}
        <DevAuthorityControl elementId="btn_filter_controls" name="Search Toolbar" inline>
          <div className="relative hidden lg:block w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
            <input
              type="text"
              placeholder="Search anything..."
              className="w-full bg-theme-bg/60 border border-theme-border rounded-lg pl-9 pr-10 py-1.5 text-xs text-theme-text placeholder:text-theme-muted focus:outline-none focus:border-theme-primary transition"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-theme-muted px-1.5 py-0.5 rounded border border-theme-border bg-theme-surface font-mono">
              ⌘K
            </kbd>
          </div>
        </DevAuthorityControl>

        {/* Quick Theme Toggle (Controlled In-Place by Developer Console) */}
        <DevAuthorityControl elementId="btn_theme_toggle" name="Theme Switcher" inline>
          <button
            onClick={() => setTheme(themeCycle[theme])}
            title={`Theme: ${theme}. Click to switch theme.`}
            className="p-2 rounded-lg border border-theme-border text-theme-muted hover:text-theme-text hover:bg-theme-surface-hover transition cursor-pointer"
          >
            {theme === 'arctic-light' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-theme-primary" />}
          </button>
        </DevAuthorityControl>

        {/* Notifications Bell */}
        <DevAuthorityControl elementId="btn_notifications" name="Notifications Center" inline>
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-2 rounded-lg border border-theme-border text-theme-muted hover:text-theme-text hover:bg-theme-surface-hover transition relative cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl border border-theme-border bg-theme-surface shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-2 border-b border-theme-border">
                  <span className="font-semibold text-xs text-theme-text">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-theme-primary hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-theme-border-subtle mt-2">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-theme-muted">No notifications</div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={`py-2 px-1 text-xs ${n.is_read ? 'opacity-70' : 'font-medium'}`}
                      >
                        <div className="text-theme-text">{n.title}</div>
                        <div className="text-theme-muted text-[11px] mt-0.5">{n.message}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </DevAuthorityControl>

        {/* User Profile Avatar Dropdown */}
        <DevAuthorityControl elementId="btn_user_profile" name="User Profile Menu" inline>
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-theme-surface-hover transition cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-600 to-teal-400 text-white font-bold text-xs flex items-center justify-center shadow-md">
                {user?.avatar || user?.name?.substring(0, 2).toUpperCase() || 'TF'}
              </div>
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-theme-border bg-theme-surface shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-theme-border">
                <div className="font-semibold text-xs text-theme-text">{user?.name}</div>
                <div className="text-[11px] text-theme-muted truncate">{user?.email}</div>
                <div className="mt-1.5">
                  {isRoleOn ? (
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-theme-primary/10 text-theme-primary border border-theme-primary/20">
                      {user?.role?.toUpperCase()}
                    </span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      NO ROLE (NORMAL USER)
                    </span>
                  )}
                </div>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    onNavigate('settings');
                    setUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-theme-text hover:bg-theme-surface-hover rounded-lg transition"
                >
                  <Sliders className="w-4 h-4 text-theme-muted" />
                  <span>Settings & Theme</span>
                </button>
              </div>
              <div className="border-t border-theme-border pt-1">
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </DevAuthorityControl>
    </div>
  </header>
  );
};
export default TopNav;
