import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Shield, Zap, Eye, EyeOff, Lock, Check, ExternalLink, X, Sliders, Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUiControls } from '../../context/UiControlsContext';
import { useToast } from '../../context/ToastContext';

interface ContextMenuTarget {
  x: number;
  y: number;
  elementId: string;
  name: string;
  type?: string;
  location?: string;
}

interface DevContextMenuContextType {
  openContextMenu: (target: ContextMenuTarget) => void;
  closeContextMenu: () => void;
  activeMenu: ContextMenuTarget | null;
}

const DevContextMenuContext = createContext<DevContextMenuContextType | null>(null);

export const useDevContextMenu = () => {
  const ctx = useContext(DevContextMenuContext);
  if (!ctx) {
    throw new Error('useDevContextMenu must be used within DevContextMenuProvider');
  }
  return ctx;
};

export const DevContextMenuProvider: React.FC<{
  children: React.ReactNode;
  onNavigateToConsole?: (elementId?: string) => void;
}> = ({ children, onNavigateToConsole }) => {
  const { user } = useAuth();
  const { controlsMap, toggleControl } = useUiControls();
  const { success } = useToast();

  const isDevSession = Boolean(
    user && (user.isDevConsole || user.portalMode === 'developer_console' || user.sessionType === 'developer_console' || user.role === 'developer_console_admin')
  );

  const [activeMenu, setActiveMenu] = useState<ContextMenuTarget | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openContextMenu = (target: ContextMenuTarget) => {
    if (!isDevSession) return;
    setActiveMenu(target);
  };

  const closeContextMenu = () => {
    setActiveMenu(null);
  };

  // Close on Escape or click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeContextMenu();
      }
    };

    if (activeMenu) {
      window.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenu]);

  // Global right-click handler for any element with data-dev-id or interactive elements in Dev Mode
  useEffect(() => {
    if (!isDevSession) return;

    const handleGlobalContextMenu = (e: MouseEvent) => {
      // Find closest element with data-dev-id
      const targetEl = (e.target as HTMLElement)?.closest('[data-dev-id]') as HTMLElement;
      if (targetEl) {
        e.preventDefault();
        e.stopPropagation();

        const elementId = targetEl.getAttribute('data-dev-id') || 'unspecified_element';
        const name = targetEl.getAttribute('data-dev-name') || targetEl.getAttribute('title') || targetEl.innerText?.trim().slice(0, 30) || elementId;
        const type = targetEl.getAttribute('data-dev-type') || 'button';
        const location = targetEl.getAttribute('data-dev-location') || 'Live Workspace App';

        openContextMenu({
          x: e.clientX,
          y: e.clientY,
          elementId,
          name,
          type,
          location,
        });
      }
    };

    window.addEventListener('contextmenu', handleGlobalContextMenu);
    return () => window.removeEventListener('contextmenu', handleGlobalContextMenu);
  }, [isDevSession]);

  const isCurrentEnabled = activeMenu ? controlsMap[activeMenu.elementId] !== false : true;

  const handleSetDevOnly = async () => {
    if (!activeMenu) return;
    const { elementId, name, type, location } = activeMenu;
    await toggleControl(elementId, false, {
      name,
      element_type: type,
      target_location: location,
    });
    success('Developer Console UI Authority', `Turned ON ONLY for Developer Console: '${name}'. Hidden from normal website users.`);
    closeContextMenu();
  };

  const handleSetEveryone = async () => {
    if (!activeMenu) return;
    const { elementId, name, type, location } = activeMenu;
    await toggleControl(elementId, true, {
      name,
      element_type: type,
      target_location: location,
    });
    success('Developer Console UI Authority', `Turned ON for Normal Website: '${name}'. Now visible to all users.`);
    closeContextMenu();
  };

  // Clamp menu coordinates inside viewport
  const getCoordinates = () => {
    if (!activeMenu) return { top: 0, left: 0 };
    const menuWidth = 320;
    const menuHeight = 310;
    const padding = 12;

    let x = activeMenu.x;
    let y = activeMenu.y;

    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding;
    }
    if (y + menuHeight > window.innerHeight - padding) {
      y = window.innerHeight - menuHeight - padding;
    }
    if (x < padding) x = padding;
    if (y < padding) y = padding;

    return { top: y, left: x };
  };

  const coords = getCoordinates();

  return (
    <DevContextMenuContext.Provider value={{ openContextMenu, closeContextMenu, activeMenu }}>
      {children}

      {/* Floating Developer Authority Context Menu Portal */}
      {activeMenu && isDevSession && (
        <div
          ref={menuRef}
          style={{ top: coords.top, left: coords.left }}
          className="fixed z-[9999] w-80 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-cyan-500/50 shadow-2xl shadow-cyan-500/20 text-slate-100 p-3.5 space-y-3 font-sans animate-in fade-in zoom-in-95 duration-150 select-none"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-cyan-400 text-[10px] font-bold uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                <span>Developer Console Authority</span>
              </div>
              <h4 className="text-xs font-extrabold text-white truncate mt-0.5">
                {activeMenu.name}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-[9px] text-cyan-300 bg-cyan-950/80 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                  {activeMenu.elementId}
                </span>
                {activeMenu.location && (
                  <span className="text-[10px] text-slate-400 truncate">
                    {activeMenu.location}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={closeContextMenu}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Current Status Pill */}
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
            <div className="text-[10px] uppercase font-bold text-slate-400">Current Visibility Mode:</div>
            <div className="flex items-center gap-2">
              {isCurrentEnabled ? (
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Visible on Normal Website (Everyone)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Turned ON Only for Developer Console</span>
                </div>
              )}
            </div>
            <div className="text-[10px] text-slate-400">
              {isCurrentEnabled
                ? 'All normal website users can see and use this option.'
                : 'Hidden from normal website users (not found in DOM). Displayed only to Developer Console.'}
            </div>
          </div>

          {/* Action 1: Turn ON Only for Developer Console */}
          <button
            onClick={handleSetDevOnly}
            className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              !isCurrentEnabled
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-200 shadow-md shadow-amber-500/10'
                : 'bg-slate-900/70 border-slate-800 text-slate-200 hover:border-amber-500/40 hover:bg-amber-500/10'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <span>Turn ON Only for Developer Console</span>
                </div>
                <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                  Display exclusively in Developer Console. Normal website users cannot view or find it.
                </div>
              </div>
            </div>
            {!isCurrentEnabled && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </span>
            )}
          </button>

          {/* Action 2: Turn ON for Normal Website */}
          <button
            onClick={handleSetEveryone}
            className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              isCurrentEnabled
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 shadow-md shadow-emerald-500/10'
                : 'bg-slate-900/70 border-slate-800 text-slate-200 hover:border-emerald-500/40 hover:bg-emerald-500/10'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <Eye className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <span>Turn ON for Normal Website (All Users)</span>
                </div>
                <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                  Enable and display option on the normal website for all authenticated users.
                </div>
              </div>
            </div>
            {isCurrentEnabled && (
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </span>
            )}
          </button>

          {/* Footer Action: Manage in Developer Console */}
          {onNavigateToConsole && (
            <button
              onClick={() => {
                closeContextMenu();
                onNavigateToConsole(activeMenu.elementId);
              }}
              className="w-full py-1.5 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-[11px] font-semibold text-cyan-300 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>Manage in Developer Console Matrix</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </button>
          )}
        </div>
      )}
    </DevContextMenuContext.Provider>
  );
};

